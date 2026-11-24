import { sql } from "./db";

/** Limite no banco, compartilhado entre processos e reinícios. */
export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  const now = Date.now();
  const rows = await sql<{ contagem: number }>(
    `insert into limites (chave, contagem, zera_em) values ($1, 1, $2)
     on conflict (chave) do update set
       contagem = case when limites.zera_em <= $3 then 1 else limites.contagem + 1 end,
       zera_em = case when limites.zera_em <= $3 then $2 else limites.zera_em end
     returning contagem`,
    [key, now + windowMs, now],
  );
  return Number(rows[0]?.contagem ?? 1) <= limit;
}
