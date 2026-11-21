import { requireIdentity } from "../../../../cursor/identity";
import { sql } from "../../../lib/db";
import { vapidKeys } from "../../../lib/push";
import { rateLimit } from "../../../lib/rate-limit";
import { tooLarge } from "../../../lib/server-utils";

const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

/** O servidor faz POST no endpoint; só serviços de push conhecidos. */
function pushEndpointPermitido(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    return (
      url.protocol === "https:" &&
      !url.port &&
      PUSH_HOSTS.some((re) => re.test(url.hostname))
    );
  } catch {
    return false;
  }
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  const { publicKey } = await vapidKeys();
  return Response.json(
    { publicKey },
    { headers: { "cache-control": "private, no-store" } },
  );
}

type Body = {
  endpoint?: unknown;
  keys?: { p256dh?: unknown; auth?: unknown };
  nome?: unknown;
};

export async function POST(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  if (tooLarge(request, 8_000)) {
    return Response.json({ error: "grande demais" }, { status: 413 });
  }
  if (!rateLimit(`push:${identity.sub}`, 10, 60_000)) {
    return Response.json({ error: "Aguarde um minuto." }, { status: 429 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  const p256dh = typeof body.keys?.p256dh === "string" ? body.keys.p256dh : "";
  const auth = typeof body.keys?.auth === "string" ? body.keys.auth : "";
  const nome = typeof body.nome === "string" ? body.nome.slice(0, 120) : "";

  if (!pushEndpointPermitido(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 200 || auth.length > 100) {
    return Response.json({ error: "inscrição inválida" }, { status: 400 });
  }

  await sql(
    `insert into push_subs (endpoint, p256dh, auth, nome, criado_por)
     values ($1, $2, $3, $4, $5)
     on conflict (endpoint) do update
       set p256dh = excluded.p256dh, auth = excluded.auth,
           nome = excluded.nome, criado_por = excluded.criado_por`,
    [endpoint, p256dh, auth, nome, identity.sub],
  );
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const identity = await requireIdentity(request);
  if (identity instanceof Response) return identity;
  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
  if (endpoint) {
    await sql(`delete from push_subs where endpoint = $1`, [endpoint]);
  }
  return Response.json({ ok: true });
}
