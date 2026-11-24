import { cabecalhoSessao } from "../../../lib/acesso";
import { rateLimit } from "../../../lib/rate-limit";
import { tooLarge } from "../../../lib/server-utils";
import { criarSenhaInicial, emitirSessao, usuarioPorNome } from "../../../lib/usuarios";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function POST(request: Request) {
  if (tooLarge(request, 2_000)) {
    return Response.json({ error: "Pedido grande demais." }, { status: 413, headers: noStore });
  }
  if (!rateLimit("criar-senha:global", 30, 60_000)) {
    return Response.json({ error: "Muitas tentativas. Espere um minuto." }, { status: 429, headers: noStore });
  }

  let body: { nome?: unknown; senha?: unknown };
  try {
    body = (await request.json()) as { nome?: unknown; senha?: unknown };
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: noStore });
  }
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  if (!nome) return Response.json({ error: "Escolha seu nome." }, { status: 400, headers: noStore });
  if (senha.length < 4 || senha.length > 80) {
    return Response.json({ error: "A senha precisa ter de 4 a 80 caracteres." }, { status: 400, headers: noStore });
  }
  if (!rateLimit(`criar-senha:${nome}`, 8, 10 * 60_000)) {
    return Response.json({ error: "Muitas tentativas para este nome. Espere um pouco." }, { status: 429, headers: noStore });
  }
  const existente = await usuarioPorNome(nome);
  if (!existente) return Response.json({ error: "Usuário não encontrado." }, { status: 404, headers: noStore });
  if (existente.senha_hash) {
    return Response.json({ error: "Esta pessoa já tem senha. Entre com ela." }, { status: 409, headers: noStore });
  }
  const usuario = await criarSenhaInicial(nome, senha);
  if (!usuario) {
    return Response.json({ error: "Esta pessoa já tem senha. Entre com ela." }, { status: 409, headers: noStore });
  }
  return Response.json(
    { ok: true, nome: usuario.nome, papel: usuario.papel },
    { headers: { ...noStore, "set-cookie": cabecalhoSessao(emitirSessao(usuario), request) } },
  );
}
