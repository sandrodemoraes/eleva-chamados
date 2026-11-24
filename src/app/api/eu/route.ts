import { podeDefinirSenhas, requireAcesso } from "../../../lib/acesso";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await requireAcesso(request);
  if (identity instanceof Response) return identity;

  return Response.json(
    {
      name: identity.name,
      email: identity.kind === "person" ? identity.email : "",
      por: identity.sub.startsWith("usuario:") ? "senha" : "conta",
      papel: identity.papel,
      podeSenhas: podeDefinirSenhas(identity),
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
