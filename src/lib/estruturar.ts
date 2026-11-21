import { EQUIPE } from "./equipe";
import { agoraLocal } from "./parse-chamado";
import { SERVICOS, type Urgencia } from "./types";

export type CamposIA = {
  cliente: string;
  quem_chamou: string;
  telefone: string;
  endereco: string;
  servico: string;
  defeitos: string[];
  urgencia: Urgencia;
  funcionarios: string[];
  horario: string;
  resumo: string;
};

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "cliente",
    "quem_chamou",
    "telefone",
    "endereco",
    "servico",
    "defeitos",
    "urgencia",
    "funcionarios",
    "horario",
    "resumo",
  ],
  properties: {
    cliente: { type: "string", description: "Nome do cliente ou empresa. Vazio se não foi dito." },
    quem_chamou: { type: "string", description: "Pessoa que ligou/pediu o atendimento. Vazio se não foi dito." },
    telefone: { type: "string", description: "Telefone/WhatsApp como foi dito, só dígitos e separadores." },
    endereco: { type: "string", description: "Rua, número, bairro, cidade. Vazio se não foi dito." },
    servico: { type: "string", enum: [...SERVICOS] },
    defeitos: {
      type: "array",
      items: { type: "string" },
      description: "Cada defeito ou problema relatado pelo cliente, curto e objetivo.",
    },
    urgencia: { type: "string", enum: ["baixa", "normal", "alta"] },
    funcionarios: { type: "array", items: { type: "string", enum: [...EQUIPE] } },
    horario: {
      type: "string",
      description: "Horário marcado no formato AAAA-MM-DDTHH:MM (horário de Brasília). Vazio se não foi dito.",
    },
    resumo: { type: "string", description: "Resumo limpo do chamado em 1 a 3 frases, em português." },
  },
} as const;

export async function estruturarTexto(
  texto: string,
): Promise<{ campos?: CamposIA; needsKey?: boolean; error?: string }> {
  const key = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!key) return { needsKey: true };

  const agora = agoraLocal();
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
      temperature: 0,
      response_format: {
        type: "json_schema",
        json_schema: { name: "chamado", strict: true, schema: SCHEMA },
      },
      messages: [
        {
          role: "system",
          content:
            "Você organiza chamados técnicos da Eleva (câmeras, alarme, elétrica, energia solar, projetos). " +
            "Extraia os campos só do que foi dito no texto; nunca invente. Campo não mencionado fica vazio. " +
            `Agora é ${agora} (Brasília); converta "amanhã às 14h" e similares para AAAA-MM-DDTHH:MM. ` +
            `Funcionários da equipe: ${EQUIPE.join(", ")}. Use a grafia exata da lista.`,
        },
        { role: "user", content: texto.slice(0, 4000) },
      ],
    }),
  });

  if (!res.ok) {
    return { error: `IA indisponível (${res.status})` };
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  try {
    return { campos: JSON.parse(content) as CamposIA };
  } catch {
    return { error: "Resposta da IA inválida" };
  }
}
