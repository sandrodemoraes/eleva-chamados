import { randomUUID } from "node:crypto";
import { requireAcesso } from "../../../lib/acesso";
import { sql } from "../../../lib/db";
import { transcribeAudioDataUrl } from "../../../lib/transcribe";
import { rateLimit } from "../../../lib/rate-limit";
import { avisarChamadoAberto } from "../../../lib/push";
import { ehPessoa } from "../../../lib/equipe";
import { UUID_RE, nomeDe, tooLarge } from "../../../lib/server-utils";
import type { Chamado, ChamadoInput, Urgencia } from "../../../lib/types";

export const dynamic = "force-dynamic";

function asString(value: unknown, max = 2000): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

function asUrgencia(value: unknown): Urgencia {
  if (value === "baixa" || value === "alta" || value === "normal") return value;
  return "normal";
}

const LIST_COLUMNS = `
  id, cliente, quem_chamou, telefone, endereco, servico, defeito, urgencia,
  descricao, transcricao, funcionarios, horario, inicio, termino, marcado,
  valor_minimo, horas_extra, valores_hora, deslocamento, deslocamento_km, deslocamento_valor,
  status, assumido_por, assumido_em, criado_por, criado_por_nome, criado_em,
  atualizado_em, checklist, assinado_nome, assinado_em,
  (audio_base64 <> '') as tem_audio,
  (assinatura_base64 <> '') as tem_assinatura,
  (select count(*)::int from fotos f where f.chamado_id = c.id) as fotos_count,
  (select count(*)::int from produtos p where p.chamado_id = c.id) as produtos_count,
  (select coalesce(string_agg(
     (case when texto <> '' then texto else 'Foto do produto' end)
     || case
          when valor is null then ''
          else ' — R$ ' || replace(trim(to_char(valor, 'FM999999990.00')), '.', ',')
        end,
     chr(10) order by criado_em
   ), '') from produtos p where p.chamado_id = c.id) as produtos,
  (select sum(valor) from produtos p where p.chamado_id = c.id) as produtos_total`;

export async function GET(request: Request) {
  const identity = await requireAcesso(request);
  if (identity instanceof Response) return identity;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const cliente = url.searchParams.get("cliente")?.trim().slice(0, 120) ?? "";
  const resumo = url.searchParams.get("resumo") === "1";
  const cols = resumo
    ? "id, cliente, servico, endereco, urgencia, status, criado_em"
    : LIST_COLUMNS;

  const where: string[] = [];
  const params: unknown[] = [];
  if (status) {
    params.push(status);
    where.push(`status = $${params.length}`);
  }
  if (cliente) {
    params.push(cliente.toLowerCase());
    where.push(`lower(trim(cliente)) = $${params.length}`);
  }
  const limit = cliente ? 30 : 200;

  const rows = await sql<Chamado>(
    `select ${cols} from chamados c
     ${where.length ? `where ${where.join(" and ")}` : ""}
     order by criado_em desc limit ${limit}`,
    params,
  );

  return Response.json(
    { chamados: rows },
    { headers: { "cache-control": "private, no-store" } },
  );
}

export async function POST(request: Request) {
  const identity = await requireAcesso(request);
  if (identity instanceof Response) return identity;

  if (tooLarge(request, 1_200_000)) {
    return Response.json({ error: "Chamado grande demais" }, { status: 413 });
  }
  if (!rateLimit(`criar:${identity.sub}`, 30, 60_000)) {
    return Response.json(
      { error: "Muitos chamados seguidos. Aguarde um minuto." },
      { status: 429 },
    );
  }

  let body: Partial<ChamadoInput>;
  try {
    body = (await request.json()) as Partial<ChamadoInput>;
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }

  const cliente = asString(body.cliente, 120);
  const quem_chamou = asString(body.quem_chamou, 120);
  const telefone = asString(body.telefone, 40);
  const endereco = asString(body.endereco, 200);
  const servico = asString(body.servico, 80);
  const defeito = asString(body.defeito, 2000);
  const urgencia = asUrgencia(body.urgencia);
  const aberto = body.aberto === true;
  const funcionarios = aberto ? "" : asString(body.funcionarios, 300);
  const status = aberto ? "aberto" : "aguardando_nota";
  const horario = asString(body.horario, 80);
  const inicio = asString(body.inicio, 40);
  const termino = asString(body.termino, 40);
  const marcado = body.marcado === true;
  let descricao = asString(body.descricao, 4000);
  let transcricao = asString(body.transcricao, 4000);
  const audioRaw = asString(body.audio_base64, 900_000);
  const audio_base64 = audioRaw.startsWith("data:audio/") ? audioRaw : "";

  if (audio_base64 && !transcricao.trim()) {
    const whispered = await transcribeAudioDataUrl(audio_base64);
    if (whispered.text) {
      transcricao = whispered.text.slice(0, 4000);
      if (!descricao) descricao = transcricao;
    }
  }

  if (!descricao && !transcricao && !cliente && !defeito && !audio_base64) {
    return Response.json(
      { error: "Informe áudio, cliente ou descrição" },
      { status: 400 },
    );
  }

  // Id vindo do aparelho permite reenviar da fila offline sem duplicar.
  const id =
    typeof body.id === "string" && UUID_RE.test(body.id) ? body.id : randomUUID();
  const pedido = asString(body.aberto_por, 120);
  const nome = ehPessoa(pedido) ? pedido : nomeDe(identity);

  const inserted = await sql(
    `insert into chamados (
      id, cliente, quem_chamou, telefone, endereco, servico, urgencia, descricao, transcricao,
      audio_base64, funcionarios, horario, marcado, status, criado_por, criado_por_nome, defeito, inicio, termino
    ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$16,$14,$15,$17,$18,$19)
    on conflict (id) do nothing
    returning id`,
    [
      id,
      cliente,
      quem_chamou,
      telefone,
      endereco,
      servico || "Outro",
      urgencia,
      descricao || transcricao,
      transcricao,
      audio_base64,
      funcionarios,
      horario,
      marcado,
      identity.sub,
      nome,
      status,
      defeito,
      inicio,
      termino,
    ],
  );

  const [criado] = await sql<Chamado>(
    `select * from chamados where id = $1`,
    [id],
  );

  if (inserted.length > 0 && criado?.status === "aberto") {
    await avisarChamadoAberto(criado).catch(() => undefined);
  }

  return Response.json(
    { chamado: criado },
    { status: 201, headers: { "cache-control": "private, no-store" } },
  );
}
