export type ItemChecklist = { texto: string; obrigatorio: boolean };

const FINAL: ItemChecklist[] = [
  { texto: "Local limpo e organizado", obrigatorio: true },
  { texto: "Cliente orientado sobre o uso", obrigatorio: true },
  { texto: "Fotos de antes e depois tiradas", obrigatorio: false },
];

export const CHECKLISTS: Record<string, ItemChecklist[]> = {
  "Câmeras": [
    { texto: "Todas as câmeras com imagem", obrigatorio: true },
    { texto: "Gravação testada no DVR/NVR", obrigatorio: true },
    { texto: "HD com espaço e data/hora corretas", obrigatorio: true },
    { texto: "Acesso remoto no celular do cliente funcionando", obrigatorio: true },
    { texto: "Visão noturna conferida", obrigatorio: false },
    { texto: "Fonte/nobreak e cabos conferidos", obrigatorio: false },
  ],
  Alarme: [
    { texto: "Todos os sensores testados", obrigatorio: true },
    { texto: "Sirene testada", obrigatorio: true },
    { texto: "Bateria da central conferida", obrigatorio: true },
    { texto: "Comunicação com app/monitoramento testada", obrigatorio: true },
    { texto: "Senhas/usuários repassados ao cliente", obrigatorio: false },
  ],
  "Elétrica": [
    { texto: "Circuito desligado antes da intervenção", obrigatorio: true },
    { texto: "Disjuntores identificados no quadro", obrigatorio: true },
    { texto: "Tensão medida após o serviço", obrigatorio: true },
    { texto: "Aterramento conferido", obrigatorio: false },
    { texto: "Sem aquecimento em conexões", obrigatorio: false },
  ],
  "Energia solar": [
    { texto: "Inversor online e sem alarmes", obrigatorio: true },
    { texto: "Geração conferida no app", obrigatorio: true },
    { texto: "String box/proteções conferidas", obrigatorio: true },
    { texto: "Módulos limpos e sem avarias", obrigatorio: false },
    { texto: "Estrutura e fixações conferidas", obrigatorio: false },
  ],
  Projeto: [
    { texto: "Medidas e levantamento do local feitos", obrigatorio: true },
    { texto: "Fotos do local tiradas", obrigatorio: true },
    { texto: "Necessidades do cliente anotadas", obrigatorio: true },
  ],
  "Manutenção": [
    { texto: "Defeito informado verificado", obrigatorio: true },
    { texto: "Causa identificada", obrigatorio: true },
    { texto: "Equipamento testado após o reparo", obrigatorio: true },
    { texto: "Peças trocadas anotadas", obrigatorio: false },
  ],
  Outro: [{ texto: "Serviço testado com o cliente", obrigatorio: true }],
};

export function checklistDo(servico: string): ItemChecklist[] {
  return [...(CHECKLISTS[servico] ?? CHECKLISTS.Outro), ...FINAL];
}

export function lerChecklist(raw?: string): Record<string, boolean> {
  try {
    const parsed = JSON.parse(raw || "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, boolean>)
      : {};
  } catch {
    return {};
  }
}

export function faltandoObrigatorios(servico: string, raw?: string): string[] {
  const marcados = lerChecklist(raw);
  return checklistDo(servico)
    .filter((i) => i.obrigatorio && !marcados[i.texto])
    .map((i) => i.texto);
}
