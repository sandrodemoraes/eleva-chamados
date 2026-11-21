import webpush from "web-push";
import { sql } from "./db";
import type { Chamado } from "./types";

type Keys = { publicKey: string; privateKey: string };

let cached: Promise<Keys> | undefined;

/** Chaves VAPID geradas uma vez e guardadas no banco do próprio app. */
export function vapidKeys(): Promise<Keys> {
  cached ??= loadKeys().catch((error: unknown) => {
    cached = undefined;
    throw error;
  });
  return cached;
}

async function loadKeys(): Promise<Keys> {
  const read = async () => {
    const rows = await sql<{ valor: string }>(
      `select valor from app_config where chave = 'vapid'`,
    );
    return rows[0] ? (JSON.parse(rows[0].valor) as Keys) : null;
  };
  const existing = await read();
  if (existing) return existing;
  const fresh = webpush.generateVAPIDKeys();
  await sql(
    `insert into app_config (chave, valor) values ('vapid', $1)
     on conflict (chave) do nothing`,
    [JSON.stringify(fresh)],
  );
  return (await read()) ?? fresh;
}

type Sub = { endpoint: string; p256dh: string; auth: string };

export async function enviarPush(
  payload: { title: string; body: string; url: string; tag: string },
  subject: string,
): Promise<number> {
  const subs = await sql<Sub>(`select endpoint, p256dh, auth from push_subs`);
  if (subs.length === 0) return 0;
  const keys = await vapidKeys();
  const json = JSON.stringify(payload);
  let enviados = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          json,
          {
            TTL: 60 * 60 * 6,
            urgency: "high",
            vapidDetails: {
              subject,
              publicKey: keys.publicKey,
              privateKey: keys.privateKey,
            },
          },
        );
        enviados += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await sql(`delete from push_subs where endpoint = $1`, [s.endpoint]);
        }
      }
    }),
  );
  return enviados;
}

export async function avisarChamadoAberto(
  c: Pick<Chamado, "id" | "cliente" | "servico" | "endereco">,
  subject = process.env.PUSH_SUBJECT?.trim() || "mailto:chamados@eleva.app",
): Promise<number> {
  const corpo = [c.cliente || "Cliente não informado", c.servico, c.endereco]
    .filter(Boolean)
    .join(" · ");
  return enviarPush(
    {
      title: "Chamado técnico em aberto",
      body: corpo,
      url: "/?aba=abertos",
      tag: `chamado-${c.id}`,
    },
    subject,
  );
}
