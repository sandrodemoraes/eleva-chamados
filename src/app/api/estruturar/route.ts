import { requireAcesso } from "../../../lib/acesso";
import { estruturarTexto } from "../../../lib/estruturar";
import { rateLimit } from "../../../lib/rate-limit";
import { tooLarge } from "../../../lib/server-utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const identity = await requireAcesso(request);
  if (identity instanceof Response) return identity;
  if (tooLarge(request, 20_000)) {
    return Response.json({ error: "Texto grande demais" }, { status: 413 });
  }
  if (!(await rateLimit(`ia:${identity.sub}`, 10, 60_000)) || !(await rateLimit("ia:global", 30, 60 * 60_000))) {
    return Response.json({ error: "Muitos pedidos. Aguarde um minuto." }, { status: 429 });
  }

  let body: { texto?: unknown };
  try {
    body = (await request.json()) as { texto?: unknown };
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const texto = typeof body.texto === "string" ? body.texto.trim() : "";
  if (texto.length < 5) {
    return Response.json({ error: "Texto curto demais" }, { status: 400 });
  }

  const result = await estruturarTexto(texto);
  if (result.needsKey) {
    return Response.json({ needs_key: true }, { status: 503 });
  }
  if (!result.campos) {
    return Response.json({ error: result.error ?? "Falha na IA" }, { status: 502 });
  }
  return Response.json(
    { campos: result.campos },
    { headers: { "cache-control": "private, no-store" } },
  );
}
