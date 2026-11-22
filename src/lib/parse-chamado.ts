import type { ChamadoInput, Urgencia } from "./types";
import { SERVICOS } from "./types";
import { EQUIPE, joinFuncionarios } from "./equipe";
import { checklistDo, lerChecklist } from "./checklists";

const SERVICO_ALIASES: { label: (typeof SERVICOS)[number]; terms: string[] }[] =
  [
    {
      label: "Câmeras",
      terms: ["camera", "câmera", "cameras", "câmeras", "cftv", "monitoramento"],
    },
    {
      label: "Alarme",
      terms: ["alarme", "cerca eletrica", "cerca elétrica", "sensor"],
    },
    {
      label: "Elétrica",
      terms: ["eletrica", "elétrica", "eletricista", "quadro", "disjuntor"],
    },
    {
      label: "Energia solar",
      terms: ["solar", "painel", "fotovolta", "inversor"],
    },
    { label: "Projeto", terms: ["projeto", "laudo", "planta"] },
    {
      label: "Manutenção",
      terms: [
        "manutencao",
        "manutenção",
        "reparo",
        "conserto",
        "visita tecnica",
        "visita técnica",
      ],
    },
  ];

function pickServico(text: string): string {
  const lower = text.toLowerCase();
  for (const entry of SERVICO_ALIASES) {
    if (entry.terms.some((t) => lower.includes(t))) return entry.label;
  }
  return "Outro";
}

function pickUrgencia(text: string): Urgencia {
  const lower = text.toLowerCase();
  if (
    /urg[eê]n|prioridade alta|hoje mesmo|emerg[eê]ncia|o quanto antes|asap/.test(
      lower,
    )
  ) {
    return "alta";
  }
  if (/sem pressa|quando puder|baixa prioridade/.test(lower)) return "baixa";
  return "normal";
}

function pickFuncionarios(text: string): string {
  const lower = text.toLowerCase();
  const found = EQUIPE.filter((n) => {
    const parts = n.toLowerCase().split(/\s+/);
    return parts.some((p) => p.length > 2 && lower.includes(p));
  });
  return joinFuncionarios(found);
}

function indexOfWord(haystack: string, term: string): number {
  let from = 0;
  while (from <= haystack.length) {
    const idx = haystack.indexOf(term, from);
    if (idx === -1) return -1;
    if (idx === 0 || !/[\p{L}\d]/u.test(haystack[idx - 1])) return idx;
    from = idx + 1;
  }
  return -1;
}

const SERVICO_STOP_TERMS = new Set([
  "instalação",
  "instalacao",
  "manutenção",
  "manutencao",
  "camera",
  "câmera",
  "alarme",
  "elétrica",
  "eletrica",
  "solar",
]);

function captureAfter(
  text: string,
  labels: string[],
  stopLabels: string[],
): string {
  const lower = text.toLowerCase();
  for (const label of labels) {
    const idx = indexOfWord(lower, label);
    if (idx === -1) continue;
    let rest = text.slice(idx + label.length).replace(/^[\s:,-]+/, "");
    let cut = rest.length;
    const restLower = rest.toLowerCase();
    for (const stop of stopLabels) {
      const s = indexOfWord(restLower, stop);
      if (s !== -1 && s < cut) cut = s;
    }
    rest = rest.slice(0, cut).replace(/[.,;]\s*$/, "").trim();
    if (rest) return rest;
  }
  return "";
}

/** Extrai campos estruturados de uma fala em português. */
export function parseChamadoFromSpeech(transcricao: string): ChamadoInput {
  const text = transcricao.trim().replace(/\s+/g, " ");
  const stop = [
    "cliente",
    "quem chamou",
    "ligou",
    "telefone",
    "fone",
    "whatsapp",
    "endereço",
    "endereco",
    "serviço",
    "servico",
    "funcionário",
    "funcionario",
    "técnico",
    "tecnico",
    "horário",
    "horario",
    "às ",
    "instalação",
    "instalacao",
    "manutenção",
    "manutencao",
    "urgência",
    "urgencia",
    "defeito",
    "problema",
    "observação",
    "observacao",
    "obs",
    "camera",
    "câmera",
    "alarme",
    "elétrica",
    "eletrica",
    "solar",
  ];

  const cliente =
    captureAfter(
      text,
      ["cliente ", "cliente:", "para o cliente ", "do cliente ", "dona ", "dono "],
      stop.filter((s) => !s.startsWith("cliente")),
    ) || "";

  const quem_chamou =
    captureAfter(
      text,
      [
        "quem chamou ",
        "quem chamou:",
        "chamou ",
        "ligou ",
        "falou com ",
        "atendeu ",
      ],
      stop.filter((s) => s !== "quem chamou" && s !== "ligou"),
    ) || "";

  const telefone =
    captureAfter(
      text,
      ["telefone ", "telefone:", "fone ", "whatsapp ", "celular "],
      stop.filter((s) => !["telefone", "fone", "whatsapp"].includes(s)),
    ) ||
    (text.match(
      /(?:\+?55\s?)?(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}/,
    )?.[0] ?? "");

  const endereco =
    captureAfter(
      text,
      [
        "endereço ",
        "endereco ",
        "endereço:",
        "endereco:",
        "na rua ",
        "no bairro ",
      ],
      stop.filter((s) => !s.includes("endere")),
    ) || "";

  const horario =
    captureAfter(
      text,
      ["horário ", "horario ", "às ", "as ", "para as ", "marcar para "],
      stop.filter((s) => !s.includes("hor")),
    ) || "";

  const defeito =
    captureAfter(
      text,
      [
        "defeito informado ",
        "defeito:",
        "defeito ",
        "problema:",
        "problema ",
        "reclamou que ",
        "reclamação ",
        "reclamacao ",
      ],
      stop.filter(
        (s) =>
          s !== "defeito" && s !== "problema" && !SERVICO_STOP_TERMS.has(s),
      ),
    ) || "";

  return {
    cliente: cliente.slice(0, 120),
    defeito: defeito.slice(0, 2000),
    quem_chamou: quem_chamou.slice(0, 120),
    telefone: telefone.slice(0, 40),
    endereco: endereco.slice(0, 200),
    servico: pickServico(text),
    urgencia: pickUrgencia(text),
    descricao: text,
    transcricao: text,
    audio_base64: "",
    funcionarios: pickFuncionarios(text),
    horario: horario.slice(0, 80),
    inicio: "",
    termino: "",
    marcado: false,
  };
}

export function textoParaNota(c: {
  cliente: string;
  quem_chamou?: string;
  telefone: string;
  endereco: string;
  servico: string;
  defeito?: string;
  urgencia: string;
  descricao: string;
  funcionarios?: string;
  horario?: string;
  produtos?: string;
  inicio?: string;
  termino?: string;
  marcado?: boolean;
  checklist?: string;
  fotos_count?: number;
  assinado_nome?: string;
  assinado_em?: string | null;
}): string {
  const itens = checklistDo(c.servico);
  const marcados = lerChecklist(c.checklist);
  const feitos = itens.filter((i) => marcados[i.texto]).map((i) => i.texto);
  const assinatura = c.assinado_nome
    ? `${c.assinado_nome}${c.assinado_em ? ` em ${dataHoraBR(c.assinado_em)}` : ""}`
    : "—";
  const defeitos = listaDefeitos(c.defeito);
  return [
    `Cliente: ${c.cliente || "—"}`,
    `Quem chamou: ${c.quem_chamou || "—"}`,
    `Telefone: ${c.telefone || "—"}`,
    `Endereço: ${c.endereco || "—"}`,
    `Serviço: ${c.servico || "—"}`,
    defeitos.length
      ? `Defeito informado pelo cliente:\n${defeitos.map((d) => `- ${d}`).join("\n")}`
      : "Defeito informado pelo cliente: —",
    `Funcionários: ${c.funcionarios || "—"}`,
    `Horário marcado: ${formatHorarioLabel(c.horario || "")}`,
    c.produtos?.trim()
      ? `Produtos usados:\n${c.produtos
          .split("\n")
          .map((p) => p.trim())
          .filter(Boolean)
          .map((p) => `- ${p}`)
          .join("\n")}`
      : "Produtos usados: —",
    `Início: ${formatHorarioLabel(c.inicio || "")}`,
    `Término: ${formatHorarioLabel(c.termino || "")}`,
    ...(duracaoLabel(c.inicio, c.termino)
      ? [`Duração: ${duracaoLabel(c.inicio, c.termino)}`]
      : []),
    `Marcado: ${c.marcado ? "Sim" : "Não"}`,
    feitos.length
      ? `Checklist (${feitos.length}/${itens.length}):\n${feitos.map((t) => `- ${t}`).join("\n")}`
      : `Checklist: 0/${itens.length}`,
    `Fotos: ${c.fotos_count ?? 0}`,
    `Assinado por: ${assinatura}`,
    `Urgência: ${c.urgencia || "—"}`,
    `Detalhes: ${c.descricao || "—"}`,
  ].join("\n");
}

export function listaDefeitos(value?: string): string[] {
  return (value ?? "")
    .split(/\n|;/)
    .map((d) => d.replace(/^\s*[-•*]\s*/, "").trim())
    .filter(Boolean);
}

export function formatHorarioLabel(value: string): string {
  if (!value) return "—";
  // datetime-local: 2026-11-21T14:30
  const m = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/,
  );
  if (m) {
    return `${m[3]}/${m[2]}/${m[1]} ${m[4]}:${m[5]}`;
  }
  return value;
}

function parseLocal(value?: string): number | null {
  const m = (value ?? "").match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

export function duracaoLabel(inicio?: string, termino?: string): string {
  const a = parseLocal(inicio);
  const b = parseLocal(termino);
  if (a === null || b === null || b < a) return "";
  const min = Math.round((b - a) / 60000);
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} min`;
  return m ? `${h}h ${m}min` : `${h}h`;
}

/** Data/hora atual em Brasília no formato do input datetime-local. */
export function agoraLocal(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function dataHoraBR(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
