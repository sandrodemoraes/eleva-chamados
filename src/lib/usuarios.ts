import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { sql } from "./db";

export type UsuarioRow = {
  id: string;
  nome: string;
  senha_hash: string;
  papel: "campo" | "escritorio" | "admin";
};

const SELO = "eleva-usuario-v2";

export function hashSenha(senha: string): string {
  const salt = randomBytes(16).toString("base64url");
  const hash = scryptSync(senha, salt, 32).toString("base64url");
  return `${salt}.${hash}`;
}

export function senhaConfereHash(senha: string, stored: string): boolean {
  const ponto = stored.indexOf(".");
  if (ponto <= 0) return false;
  const salt = stored.slice(0, ponto);
  const hash = stored.slice(ponto + 1);
  const calc = scryptSync(senha, salt, 32);
  const esperado = Buffer.from(hash, "base64url");
  if (calc.length !== esperado.length) return false;
  return timingSafeEqual(calc, esperado);
}

export async function listarUsuarios(): Promise<UsuarioRow[]> {
  return sql<UsuarioRow>(
    `select id, nome, senha_hash, papel from usuarios order by papel, nome`,
  );
}

export async function usuarioPorNome(nome: string): Promise<UsuarioRow | undefined> {
  const rows = await sql<UsuarioRow>(
    `select id, nome, senha_hash, papel from usuarios where nome = $1`,
    [nome],
  );
  return rows[0];
}

export async function usuarioPorId(id: string): Promise<UsuarioRow | undefined> {
  const rows = await sql<UsuarioRow>(
    `select id, nome, senha_hash, papel from usuarios where id = $1`,
    [id],
  );
  return rows[0];
}

export async function definirSenha(nome: string, senha: string): Promise<boolean> {
  const hash = hashSenha(senha);
  const rows = await sql<{ id: string }>(
    `update usuarios set senha_hash = $2 where nome = $1 returning id`,
    [nome, hash],
  );
  return rows.length > 0;
}

export function emitirSessao(usuario: UsuarioRow, agora = Date.now()): string {
  const exp = Math.floor(agora / 1000) + 60 * 60 * 24 * 30;
  const corpo = `${usuario.id}.${exp}`;
  const sig = createHmac("sha256", usuario.senha_hash).update(`${SELO}.${corpo}`).digest("base64url");
  return `v2.${corpo}.${sig}`;
}

export async function lerSessao(token: string): Promise<UsuarioRow | undefined> {
  const partes = token.split(".");
  if (partes.length !== 4 || partes[0] !== "v2") return undefined;
  const [, id, expRaw, sig] = partes;
  const exp = Number(expRaw);
  if (!id || !sig || !Number.isFinite(exp) || exp * 1000 < Date.now()) return undefined;
  const usuario = await usuarioPorId(id);
  if (!usuario?.senha_hash) return undefined;
  const esperado = createHmac("sha256", usuario.senha_hash)
    .update(`${SELO}.${id}.${expRaw}`)
    .digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return undefined;
  return usuario;
}
