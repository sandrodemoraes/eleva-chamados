import { randomUUID } from "node:crypto";
import { requireAcesso } from "../../../../../lib/acesso";
import { sql } from "../../../../../lib/db";
import { rateLimit } from "../../../../../lib/rate-limit";
import {
  UUID_RE,
  nomeDe,
  tooLarge,
  validId,
} from "../../../../../lib/server-utils";
import type { Foto } from "../../../../../lib/types";

export const dynamic = "force-dynamic";

const MAX_IMAGEM = 700_000;
const MAX_FOTOS = 30;
const IMAGEM_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;

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
  const fotos = await sql<Foto>(
    `select id, chamado_id, tipo, imagem_base64, legenda, latitude, longitude,
            tirada_em, criado_por_nome
     from fotos where chamado_id = $1 order by tirada_em`,
    [id],
  );
  return Response.json(
    { fotos },
    { headers: { "cache-control": "private, no-store" } },
  );
}

type Body = {
  id?: unknown;
  tipo?: unknown;
  imagem_base64?: unknown;
  legenda?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  tirada_em?: unknown;
};

function coord(value: unknown, limit: number): number | null {
  return typeof value === "number" && Number.isFinite(value) && Math.abs(value) <= limit
    ? value
    : null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const identity = await requireAcesso(request);
  if (identity instanceof Response) return identity;
  if (tooLarge(request, MAX_IMAGEM + 10_000)) {
    return Response.json({ error: "Foto grande demais" }, { status: 413 });
  }
  if (!(await rateLimit(`fotos:${identity.sub}`, 60, 60_000))) {
    return Response.json({ error: "Muitas fotos. Aguarde um minuto." }, { status: 429 });
  }
  const { id } = await context.params;
  if (!validId(id)) {
    return Response.json({ error: "id inválido" }, { status: 400 });
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const imagem = typeof body.imagem_base64 === "string" ? body.imagem_base64 : "";
  if (!imagem || imagem.length > MAX_IMAGEM || !IMAGEM_RE.test(imagem)) {
    return Response.json({ error: "Imagem inválida" }, { status: 400 });
  }

  const chamado = await sql<{ n: number }>(
    `select (select count(*)::int from fotos where chamado_id = $1) as n
     from chamados where id = $1`,
    [id],
  );
  if (chamado.length === 0) {
    return Response.json({ error: "não encontrado" }, { status: 404 });
  }
  if (chamado[0].n >= MAX_FOTOS) {
    return Response.json(
      { error: `Limite de ${MAX_FOTOS} fotos por chamado` },
      { status: 400 },
    );
  }

  const fotoId =
    typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : randomUUID();
  const tipo = body.tipo === "depois" ? "depois" : "antes";
  const legenda = typeof body.legenda === "string" ? body.legenda.trim().slice(0, 200) : "";
  const tirada = typeof body.tirada_em === "string" && !Number.isNaN(Date.parse(body.tirada_em))
    ? new Date(body.tirada_em).toISOString()
    : new Date().toISOString();

  await sql(
    `insert into fotos (id, chamado_id, tipo, imagem_base64, legenda, latitude, longitude,
                        tirada_em, criado_por, criado_por_nome)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict (id) do nothing`,
    [
      fotoId,
      id,
      tipo,
      imagem,
      legenda,
      coord(body.latitude, 90),
      coord(body.longitude, 180),
      tirada,
      identity.sub,
      nomeDe(identity),
    ],
  );
  await sql(`update chamados set atualizado_em = now() where id = $1`, [id]);

  return Response.json({ id: fotoId }, { status: 201 });
}
