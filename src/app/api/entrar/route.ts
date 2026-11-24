import { cabecalhoSessao } from "../../../lib/acesso";
import { rateLimit } from "../../../lib/rate-limit";
import { tooLarge } from "../../../lib/server-utils";
import { emitirSessao, listarUsuarios, senhaConfereHash, usuarioPorNome } from "../../../lib/usuarios";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function GET() {
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
  if (!rateLimit("entrar:global", 60, 60_000)) {
    return Response.json(
      { error: "Muitas tentativas. Espere um minuto." },
      { status: 429, headers: noStore },
    );
  }

  let body: { nome?: unknown; senha?: unknown };
  try {
    body = (await request.json()) as { nome?: unknown; senha?: unknown };
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: noStore });
  }
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (!nome || nome.length > 120) {
    return Response.json({ error: "Escolha seu nome." }, { status: 400, headers: noStore });
  }
  if (!rateLimit(`entrar:${nome}`, 8, 10 * 60_000)) {
    return Response.json(
      { error: "Muitas tentativas para este nome. Espere um pouco." },
      { status: 429, headers: noStore },
    );
  }
  const usuario = await usuarioPorNome(nome);
  if (!usuario) {
    return Response.json({ error: "Usuário não encontrado." }, { status: 401, headers: noStore });
  }
  if (!usuario.senha_hash) {
    return Response.json(
      { error: "Esta pessoa ainda não tem senha. Crie a sua senha." },
      { status: 403, headers: noStore },
    );
  }
  if (!senhaConfereHash(senha, usuario.senha_hash)) {
    return Response.json({ error: "Senha incorreta." }, { status: 401, headers: noStore });
  }
  return Response.json(
    { ok: true, nome: usuario.nome, papel: usuario.papel },
    { headers: { ...noStore, "set-cookie": cabecalhoSessao(emitirSessao(usuario), request) } },
  );
}
