import { cabecalhoSessao, senhaConfere, senhaDoEscritorio } from "../../../lib/acesso";
import { rateLimit } from "../../../lib/rate-limit";
import { tooLarge } from "../../../lib/server-utils";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  if (tooLarge(request, 2_000)) {
    return Response.json({ error: "Pedido grande demais." }, { status: 413, headers: noStore });
  }
  if (!rateLimit("entrar:global", 30, 60_000)) {
    return Response.json(
      { error: "Muitas tentativas. Espere um minuto." },
      { status: 429, headers: noStore },
    );
  }
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0]?.trim() || "local";
  if (!rateLimit(`entrar:${ip}`, 8, 10 * 60_000)) {
    return Response.json(
      { error: "Muitas tentativas. Espere um pouco e tente de novo." },
      { status: 429, headers: noStore },
    );
  }

  let body: { senha?: unknown };
  try {
    body = (await request.json()) as { senha?: unknown };
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: noStore });
  }
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (!senhaDoEscritorio()) {
    return Response.json(
      { error: "A senha do escritório ainda não foi gravada." },
      { status: 503, headers: noStore },
    );
  }
  if (!senhaConfere(senha)) {
    return Response.json({ error: "Senha incorreta." }, { status: 401, headers: noStore });
  }
  return Response.json(
    { ok: true },
    { headers: { ...noStore, "set-cookie": cabecalhoSessao(senhaDoEscritorio(), request) } },
  );
}
