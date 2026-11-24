import { podeDefinirSenhas, requireAcesso } from "../../../lib/acesso";
import { rateLimit } from "../../../lib/rate-limit";
import { tooLarge } from "../../../lib/server-utils";
import { definirSenha, listarUsuarios } from "../../../lib/usuarios";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const usuario = await requireAcesso(request);
  if (usuario instanceof Response) return usuario;
  if (!podeDefinirSenhas(usuario)) {
    return Response.json({ error: "Sem permissão." }, { status: 403, headers: noStore });
  }
  const rows = await listarUsuarios();
  return Response.json(
    {
      usuarios: rows.map((row) => ({
        nome: row.nome,
        papel: row.papel,
        temSenha: row.senha_hash !== "",
      })),
    },
    { headers: noStore },
  );
}

export async function POST(request: Request) {
  if (tooLarge(request, 2_000)) {
    return Response.json({ error: "Pedido grande demais." }, { status: 413, headers: noStore });
  }
  const usuario = await requireAcesso(request);
  if (usuario instanceof Response) return usuario;
  if (!podeDefinirSenhas(usuario)) {
    return Response.json({ error: "Sem permissão." }, { status: 403, headers: noStore });
  }
  if (!(await rateLimit(`senha:${usuario.sub}`, 30, 60_000))) {
    return Response.json({ error: "Muitas alterações. Espere um minuto." }, { status: 429, headers: noStore });
  }

  let body: { nome?: unknown; senha?: unknown };
  try {
    body = (await request.json()) as { nome?: unknown; senha?: unknown };
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: noStore });
  }
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (senha.length < 8 || senha.length > 80) {
    return Response.json({ error: "A senha precisa ter de 8 a 80 caracteres." }, { status: 400, headers: noStore });
  }
  const ok = await definirSenha(nome, senha);
  if (!ok) {
    return Response.json({ error: "Usuário não encontrado." }, { status: 404, headers: noStore });
  }
  return Response.json({ ok: true }, { headers: noStore });
}
