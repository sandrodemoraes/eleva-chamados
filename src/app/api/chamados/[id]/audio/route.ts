import { requireAcesso } from "../../../../../lib/acesso";
import { sql } from "../../../../../lib/db";
import { validId } from "../../../../../lib/server-utils";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const identity = await requireAcesso(request);
  if (identity instanceof Response) return identity;
  const { id } = await context.params;
  if (!validId(id)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }
  const rows = await sql<{ audio_base64: string }>(
    `select audio_base64 from chamados where id = $1`,
    [id],
  );
  if (rows.length === 0) {
    return Response.json({ error: "não encontrado" }, { status: 404 });
  }
  return Response.json(
    { audio_base64: rows[0].audio_base64 },
    { headers: { "cache-control": "private, max-age=3600" } },
  );
}
