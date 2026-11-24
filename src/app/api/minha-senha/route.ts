import { requireAcesso } from "../../../lib/acesso";
import { tooLarge } from "../../../lib/server-utils";
import { definirSenha } from "../../../lib/usuarios";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  if (tooLarge(request, 2_000)) {
    return Response.json({ error: "Pedido grande demais." }, { status: 413, headers: noStore });
  }
  const usuario = await requireAcesso(request);
  if (usuario instanceof Response) return usuario;
  if (!usuario.sub.startsWith("usuario:")) {
    return Response.json({ error: "Entre com seu usuário para trocar a senha." }, { status: 403, headers: noStore });
  }

  let body: { senha?: unknown };
  try {
    body = (await request.json()) as { senha?: unknown };
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: noStore });
  }
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (senha.length < 4 || senha.length > 80) {
    return Response.json({ error: "A senha precisa ter de 4 a 80 caracteres." }, { status: 400, headers: noStore });
  }
  const ok = await definirSenha(usuario.name, senha);
  if (!ok) return Response.json({ error: "Usuário não encontrado." }, { status: 404, headers: noStore });
  return Response.json({ ok: true }, { headers: noStore });
}
