import { podeGerirUsuarios, requireAcesso } from "../../../lib/acesso";
import { rateLimit } from "../../../lib/rate-limit";
import { tooLarge } from "../../../lib/server-utils";
import {
  atualizarUsuario,
  contarAdmins,
  definirSenha,
  excluirUsuario,
  listarUsuarios,
  usuarioPorId,
  usuarioPorNome,
  type UsuarioRow,
} from "../../../lib/usuarios";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };
const PAPEIS = new Set(["campo", "escritorio", "admin"]);

function senhaInvalida(senha: string): string | undefined {
  if (senha.length < 4 || senha.length > 80) return "A senha precisa ter de 4 a 80 caracteres.";
}

export async function GET(request: Request) {
  const usuario = await requireAcesso(request);
  if (usuario instanceof Response) return usuario;
  if (!podeGerirUsuarios(usuario)) {
    return Response.json({ error: "Sem permissão." }, { status: 403, headers: noStore });
  }
  const rows = await listarUsuarios();
  return Response.json(
    {
      usuarios: rows.map((row) => ({
        id: row.id,
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
  if (!podeGerirUsuarios(usuario)) {
    return Response.json({ error: "Sem permissão." }, { status: 403, headers: noStore });
  }
  if (!rateLimit(`senha:${usuario.sub}`, 30, 60_000)) {
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
  const erro = senhaInvalida(senha);
  if (erro) return Response.json({ error: erro }, { status: 400, headers: noStore });
  const ok = await definirSenha(nome, senha);
  if (!ok) return Response.json({ error: "Usuário não encontrado." }, { status: 404, headers: noStore });
  return Response.json({ ok: true }, { headers: noStore });
}

export async function PATCH(request: Request) {
  if (tooLarge(request, 4_000)) {
    return Response.json({ error: "Pedido grande demais." }, { status: 413, headers: noStore });
  }
  const usuario = await requireAcesso(request);
  if (usuario instanceof Response) return usuario;
  if (!podeGerirUsuarios(usuario)) {
    return Response.json({ error: "Sem permissão." }, { status: 403, headers: noStore });
  }

  let body: { id?: unknown; nome?: unknown; papel?: unknown; senha?: unknown; limparSenha?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: noStore });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const nome = typeof body.nome === "string" ? body.nome.trim() : "";
  const papel = typeof body.papel === "string" ? body.papel : "";
  const senha = typeof body.senha === "string" ? body.senha : "";
  const limparSenha = body.limparSenha === true;
  if (!id || nome.length < 2 || nome.length > 80) {
    return Response.json({ error: "Informe o nome." }, { status: 400, headers: noStore });
  }
  if (!PAPEIS.has(papel)) {
    return Response.json({ error: "Papel inválido." }, { status: 400, headers: noStore });
  }
  if (senha && senhaInvalida(senha)) {
    return Response.json({ error: senhaInvalida(senha) }, { status: 400, headers: noStore });
  }
  const atual = await usuarioPorId(id);
  if (!atual) return Response.json({ error: "Usuário não encontrado." }, { status: 404, headers: noStore });
  if (atual.papel === "admin" && papel !== "admin" && (await contarAdmins()) <= 1) {
    return Response.json({ error: "Tem que ficar pelo menos um administrador." }, { status: 400, headers: noStore });
  }
  const outro = await usuarioPorNome(nome);
  if (outro && outro.id !== id) {
    return Response.json({ error: "Já existe um usuário com esse nome." }, { status: 409, headers: noStore });
  }
  const salvo = await atualizarUsuario(id, {
    nome,
    papel: papel as UsuarioRow["papel"],
    senha: senha || undefined,
    limparSenha,
  });
  if (!salvo) return Response.json({ error: "Usuário não encontrado." }, { status: 404, headers: noStore });
  return Response.json(
    { ok: true, id: salvo.id, nome: salvo.nome, papel: salvo.papel, temSenha: salvo.senha_hash !== "" },
    { headers: noStore },
  );
}

export async function DELETE(request: Request) {
  if (tooLarge(request, 2_000)) {
    return Response.json({ error: "Pedido grande demais." }, { status: 413, headers: noStore });
  }
  const usuario = await requireAcesso(request);
  if (usuario instanceof Response) return usuario;
  if (!podeGerirUsuarios(usuario)) {
    return Response.json({ error: "Sem permissão." }, { status: 403, headers: noStore });
  }

  let body: { id?: unknown };
  try {
    body = (await request.json()) as { id?: unknown };
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400, headers: noStore });
  }
  const id = typeof body.id === "string" ? body.id.trim() : "";
  const alvo = await usuarioPorId(id);
  if (!alvo) return Response.json({ error: "Usuário não encontrado." }, { status: 404, headers: noStore });
  if (usuario.sub === `usuario:${alvo.id}` || alvo.nome === "Sandro de Moraes") {
    return Response.json({ error: "Essa conta de administrador não pode ser excluída." }, { status: 400, headers: noStore });
  }
  if (alvo.papel === "admin" && (await contarAdmins()) <= 1) {
    return Response.json({ error: "Tem que ficar pelo menos um administrador." }, { status: 400, headers: noStore });
  }
  const ok = await excluirUsuario(id);
  if (!ok) return Response.json({ error: "Usuário não encontrado." }, { status: 404, headers: noStore });
  return Response.json({ ok: true }, { headers: noStore });
}
