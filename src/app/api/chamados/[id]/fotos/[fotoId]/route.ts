import { requireAcesso } from "../../../../../../lib/acesso";
import { sql } from "../../../../../../lib/db";
import { validId } from "../../../../../../lib/server-utils";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; fotoId: string }> },
) {
  const identity = await requireAcesso(request);
  if (identity instanceof Response) return identity;
  const { id, fotoId } = await context.params;
  if (!validId(id) || !validId(fotoId)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }
  await sql(`delete from fotos where id = $1 and chamado_id = $2`, [fotoId, id]);
  return Response.json({ ok: true });
}
