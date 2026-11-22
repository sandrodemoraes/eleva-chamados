import { randomUUID } from "node:crypto";
import { requireIdentity } from "../../../../../../cursor/identity";
import { sql } from "../../../../../lib/db";
import { rateLimit } from "../../../../../lib/rate-limit";
import { UUID_RE, nomeDe, tooLarge, validId } from "../../../../../lib/server-utils";
import type { Produto } from "../../../../../lib/types";

export const dynamic = "force-dynamic";

const MAX_IMAGEM = 700_000;
const MAX_PRODUTOS = 40;
const IMAGEM_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const { id } = await context.params;
  if (!validId(id)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  const produtos = await sql<Produto>(
    `select id, chamado_id, texto, imagem_base64, criado_em, criado_por_nome
     from produtos where chamado_id = $1 order by criado_em`,
    [id],
  );
  return Response.json(
    { produtos },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (tooLarge(request, MAX_IMAGEM + 20_000)) {
    return Response.json({ error: "Produto grande demais" }, { status: 413 });
  }
  if (!rateLimit(`produtos:${identity.sub}`, 40, 60_000)) {
    return Response.json({ error: "Muitos produtos. Aguarde um minuto." }, { status: 429 });
  }

  const { id } = await context.params;
  if (!validId(id)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  let body: { id?: unknown; texto?: unknown; imagem_base64?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const texto = typeof body.texto === "string" ? body.texto.trim().slice(0, 500) : "";
  const imagem = typeof body.imagem_base64 === "string" ? body.imagem_base64 : "";
  if (!texto && !imagem) {
    return Response.json({ error: "Fale, digite ou fotografe o produto" }, { status: 400 });
  }
  if (imagem && (imagem.length > MAX_IMAGEM || !IMAGEM_RE.test(imagem))) {
    return Response.json({ error: "Foto inválida" }, { status: 400 });
  }

  const chamado = await sql<{ n: number }>(
    `select (select count(*)::int from produtos where chamado_id = $1) as n
     from chamados where id = $1`,
    [id],
  );
  if (chamado.length === 0) {
    return Response.json({ error: "não encontrado" }, { status: 404 });
  }
  if (chamado[0].n >= MAX_PRODUTOS) {
    return Response.json(
      { error: `Limite de ${MAX_PRODUTOS} produtos por chamado` },
      { status: 400 },
    );
  }

  const produtoId =
    typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : randomUUID();

  await sql(
    `insert into produtos (id, chamado_id, texto, imagem_base64, criado_por, criado_por_nome)
     values ($1,$2,$3,$4,$5,$6)
     on conflict (id) do nothing`,
    [produtoId, id, texto, imagem, identity.sub, nomeDe(identity)],
  );
  await sql(`update chamados set atualizado_em = now() where id = $1`, [id]);

  return Response.json(
    { id: produtoId },
    { status: 201, headers: { "cache-control": "private, no-store" } },
  );
}
