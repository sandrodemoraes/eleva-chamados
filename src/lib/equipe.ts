/** Técnicos de campo — quem vai no chamado. */
export const EQUIPE = [
  "Sandro de Moraes",
  "Fabio Nuernberg",
  "Crhistian",
  "Ramalho",
  "Joares",
  "Kassandra Oliveira Coelho",
] as const;

/** Escritório — quem abre o chamado para o técnico. */
export const ESCRITORIO = [
  "Bruna de Moraes",
  "Sandra Beatris de Moraes",
  "Bianca de Moraes",
] as const;

export function ehDaEquipe(nome: string): boolean {
  return (EQUIPE as readonly string[]).includes(nome);
}

export function ehDoEscritorio(nome: string): boolean {
  return (ESCRITORIO as readonly string[]).includes(nome);
}

export function ehPessoa(nome: string): boolean {
  return ehDaEquipe(nome) || ehDoEscritorio(nome);
}

export function parseFuncionarios(value: string): string[] {
  return value
    .split(/[,;/|]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function joinFuncionarios(names: string[]): string {
  return [...new Set(names.map((n) => n.trim()).filter(Boolean))].join(", ");
}
