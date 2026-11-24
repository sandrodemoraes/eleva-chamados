import { cabecalhoSair } from "../../../lib/acesso";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  return Response.json(
    { ok: true },
    {
      headers: {
        "cache-control": "private, no-store",
        "set-cookie": cabecalhoSair(request),
      },
    },
  );
}
