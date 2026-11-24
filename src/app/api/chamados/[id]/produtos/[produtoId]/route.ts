import { requireAcesso } from "../../../../../../lib/acesso";
import { sql } from "../../../../../../lib/db";
import { validId } from "../../../../../../lib/server-utils";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string; produtoId: string }> },
) {
  const identity = await requireAcesso(request);
  if (identity instanceof Response) return identity;

  const { id, produtoId } = await context.params;
  if (!validId(id) || !validId(produtoId)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  await sql(`delete from produtos where id = $1 and chamado_id = $2`, [produtoId, id]);
  await sql(`update chamados set atualizado_em = now() where id = $1`, [id]);
  return new Response(null, { status: 204 });
}
