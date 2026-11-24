import { getIdentity } from "../../cursor/identity";
import { lerSessao, revogarSessao } from "./usuarios";

const COOKIE = "eleva_acesso";

export type PapelAcesso = "campo" | "escritorio" | "admin" | "conta";

export type Usuario = {
  sub: string;
  name: string;
  email: string;
  kind: "person" | "key";
  papel: PapelAcesso;
};

const noStore = { "cache-control": "private, no-store" };

function lerCookie(request: Request, nome: string): string {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [chave, ...resto] = part.trim().split("=");
    if (chave === nome) return decodeURIComponent(resto.join("="));
  }
  return "";
}

function seguro(request: Request): boolean {
  if (request.headers.get("x-forwarded-proto") === "https") return true;
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function cabecalhoSessao(token: string, request: Request): string {
  const partes = [
    `${COOKIE}=${token}`,
    "HttpOnly",
    "SameSite=Lax",
    "Path=/",
    `Max-Age=${60 * 60 * 24 * 30}`,
  ];
  if (seguro(request)) partes.push("Secure");
  return partes.join("; ");
}

export function cabecalhoSair(request: Request): string {
  const partes = [`${COOKIE}=`, "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (seguro(request)) partes.push("Secure");
  return partes.join("; ");
}

const DONOS = new Set(["sandro.demoraes@gmail.com"]);

export function ehDonoCursor(email: string): boolean {
  return DONOS.has(email.trim().toLowerCase());
}

export function podeDefinirSenhas(usuario: Usuario): boolean {
  if (usuario.papel === "admin" && usuario.sub.startsWith("usuario:")) return true;
  return usuario.papel === "conta" && ehDonoCursor(usuario.email);
}

/** Pessoa que entrou com o próprio nome e senha. */
export async function lerSessaoAcesso(request: Request): Promise<Usuario | undefined> {
  const token = lerCookie(request, COOKIE);
  if (!token) return undefined;
  const sessao = await lerSessao(token);
  if (!sessao) return undefined;
  return {
    sub: `usuario:${sessao.id}`,
    name: sessao.nome,
    email: "",
    kind: "person",
    papel: sessao.papel,
  };
}

/** Sessão da equipe, ou a conta Cursor do dono do app. */
export async function lerAcesso(request: Request): Promise<Usuario | undefined> {
  const sessao = await lerSessaoAcesso(request);
  if (sessao) return sessao;

  const identity = await getIdentity(request);
  if (!identity.verified || identity.kind !== "person") return undefined;
  if (!ehDonoCursor(identity.email)) return undefined;
  if (identity.appVisibility !== "private" && identity.appVisibility !== "team") return undefined;
  return {
    sub: identity.sub,
    name: identity.name,
    email: identity.email,
    kind: "person",
    papel: "conta",
  };
}

export async function encerrarSessao(request: Request): Promise<void> {
  const token = lerCookie(request, COOKIE);
  if (!token) return;
  const sessao = await lerSessao(token);
  if (sessao) await revogarSessao(sessao.id);
}

export async function requireAcesso(request: Request): Promise<Usuario | Response> {
  const usuario = await lerAcesso(request);
  if (usuario) return usuario;
  return Response.json(
    { error: "Entre com seu usuário." },
    { status: 401, headers: noStore },
  );
}
