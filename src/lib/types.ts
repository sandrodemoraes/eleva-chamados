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
