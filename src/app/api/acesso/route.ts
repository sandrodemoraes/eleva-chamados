import { lerAcesso } from "../../../lib/acesso";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const usuario = await lerAcesso(request);
  if (!usuario) {
    return Response.json({ liberado: false }, { status: 401, headers: noStore });
  }
  return Response.json(
    {
      liberado: true,
      por: usuario.sub.startsWith("usuario:") ? "senha" : "conta",
      nome: usuario.name,
      papel: usuario.papel,
    },
    { headers: noStore },
  );
}
