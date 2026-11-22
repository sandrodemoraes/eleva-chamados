import { requireIdentity } from "../../../../cursor/identity";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;

  return Response.json(
    {
      name: identity.name,
      email: identity.kind === "person" ? identity.email : "",
    },
    { headers: { "cache-control": "private, no-store" } },
  );
}
