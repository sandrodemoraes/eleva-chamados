export const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function nomeDe(identity: object): string {
  const rec = identity as { name?: unknown; email?: unknown };
  if (typeof rec.name === "string" && rec.name) return rec.name;
  if (typeof rec.email === "string" && rec.email) return rec.email;
  return "Equipe Eleva";
}

export function validId(id: string | undefined): id is string {
  return Boolean(id) && (id as string).length <= 80;
}

/** Recusa corpos maiores que `max` bytes antes de ler o JSON. */
export function tooLarge(request: Request, max: number): boolean {
  const len = Number(request.headers.get("content-length") ?? "0");
  return Number.isFinite(len) && len > max;
}
