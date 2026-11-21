import { requireIdentity } from "../../../../../../cursor/identity";
import { sql } from "../../../../../lib/db";
import { tooLarge, validId } from "../../../../../lib/server-utils";

export const dynamic = "force-dynamic";

const MAX_ASSINATURA = 300_000;
const PNG_RE = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;

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
  const rows = await sql<{
    assinatura_base64: string;
    assinado_nome: string;
    assinado_em: string | null;
  }>(
    `select assinatura_base64, assinado_nome, assinado_em from chamados where id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return Response.json({ error: "não encontrado" }, { status: 404 });
  }
  return Response.json(rows[0], {
    headers: { "cache-control": "private, no-store" },
  });
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (tooLarge(request, MAX_ASSINATURA + 5_000)) {
    return Response.json({ error: "Assinatura grande demais" }, { status: 413 });
  }
  const { id } = await context.params;
  if (!validId(id)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  let body: { assinatura_base64?: unknown; nome?: unknown; assinado_em?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const img = typeof body.assinatura_base64 === "string" ? body.assinatura_base64 : "";
  const nome = typeof body.nome === "string" ? body.nome.trim().slice(0, 120) : "";
  if (!img || img.length > MAX_ASSINATURA || !PNG_RE.test(img)) {
    return Response.json({ error: "Assinatura inválida" }, { status: 400 });
  }
  if (!nome) {
    return Response.json({ error: "Informe o nome de quem assinou" }, { status: 400 });
  }
  const quando =
    typeof body.assinado_em === "string" && !Number.isNaN(Date.parse(body.assinado_em))
      ? new Date(body.assinado_em).toISOString()
      : new Date().toISOString();

  const rows = await sql<{ id: string }>(
    `update chamados
     set assinatura_base64 = $1, assinado_nome = $2, assinado_em = $3, atualizado_em = now()
     where id = $4 returning id`,
    [img, nome, quando, id],
  );
  if (rows.length === 0) {
    return Response.json({ error: "não encontrado" }, { status: 404 });
  }
  return Response.json({ ok: true });
}
