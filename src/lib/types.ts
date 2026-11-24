export type Urgencia = "baixa" | "normal" | "alta";
export type ChamadoStatus =
  | "aberto"
  | "em_andamento"
  | "aguardando_nota"
  | "nota_feita"
  | "concluido"
  | "cancelado";

export const STATUS_LABEL: Record<ChamadoStatus, string> = {
  aberto: "Em aberto",
  em_andamento: "Em andamento",
  aguardando_nota: "Aguardando nota",
  nota_feita: "Nota feita",
  concluido: "Concluído",
  cancelado: "Cancelado",
};

export type Chamado = {
  id: string;
  cliente: string;
  quem_chamou: string;
  telefone: string;
  endereco: string;
  servico: string;
  defeito: string;
  urgencia: Urgencia;
  descricao: string;
  transcricao: string;
  audio_base64?: string;
  tem_audio?: boolean;
  fotos_count?: number;
  tem_assinatura?: boolean;
  assinado_nome?: string;
  assinado_em?: string | null;
  checklist?: string;
  funcionarios: string;
  horario: string;
  produtos?: string;
  produtos_count?: number;
  produtos_total?: number | string | null;
  valor_minimo?: number | string | null;
  horas_extra?: number | string | null;
  valores_hora?: string;
  deslocamento?: boolean;
  deslocamento_km?: number | string | null;
  deslocamento_valor?: number | string | null;
  inicio: string;
  termino: string;
  marcado: boolean;
  status: ChamadoStatus;
  assumido_por?: string;
  assumido_em?: string | null;
  criado_por: string;
  criado_por_nome: string;
  criado_em: string;
  atualizado_em: string;
};

export type ChamadoInput = {
  cliente: string;
  quem_chamou: string;
  telefone: string;
  endereco: string;
  servico: string;
  defeito: string;
  urgencia: Urgencia;
  descricao: string;
  transcricao: string;
  audio_base64: string;
  funcionarios: string;
  horario: string;
  inicio: string;
  termino: string;
  marcado: boolean;
  aberto?: boolean;
  aberto_por?: string;
  id?: string;
};

export type ChamadoEdit = {
  cliente?: string;
  quem_chamou?: string;
  telefone?: string;
  endereco?: string;
  servico?: string;
  defeito?: string;
  urgencia?: Urgencia;
  descricao?: string;
  transcricao?: string;
  funcionarios?: string;
  horario?: string;
  horas_extra?: number | null;
  valores_hora?: Record<string, number | null>;
  deslocamento?: boolean;
  deslocamento_km?: number | null;
  deslocamento_valor?: number | null;
  inicio?: string;
  termino?: string;
  marcado?: boolean;
  checklist?: Record<string, boolean>;
  status?: ChamadoStatus;
};

export const SERVICOS = [
  "Câmeras",
  "Alarme",
  "Elétrica",
  "Energia solar",
  "Projeto",
  "Manutenção",
  "Outro",
] as const;

export type Produto = {
  id: string;
  chamado_id: string;
  texto: string;
  valor?: number | string | null;
  imagem_base64?: string;
  criado_em: string;
  criado_por_nome: string;
};

export type Foto = {
  id: string;
  chamado_id: string;
  tipo: "antes" | "depois";
  imagem_base64?: string;
  legenda: string;
  latitude: number | null;
  longitude: number | null;
  tirada_em: string;
  criado_por_nome: string;
};
