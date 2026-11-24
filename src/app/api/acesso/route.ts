import { getIdentity } from "../../../../cursor/identity";
import { senhaDoEscritorio, sessaoValida } from "../../../lib/acesso";

export const dynamic = "force-dynamic";

const noStore = { "cache-control": "private, no-store" };

export async function GET(request: Request) {
  const identity = await getIdentity(request);
  if (identity.verified) {
    return Response.json({ liberado: true, por: "conta" }, { headers: noStore });
  }
  if (await sessaoValida(request)) {
    return Response.json({ liberado: true, por: "senha" }, { headers: noStore });
  }
  return Response.json(
    { liberado: false, senhaConfigurada: senhaDoEscritorio() !== "" },
    { status: 401, headers: noStore },
  );
}
