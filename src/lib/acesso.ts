import { createHmac, timingSafeEqual } from "node:crypto";
import { getIdentity } from "../../cursor/identity";

const COOKIE = "eleva_acesso";
const SELO = "eleva-acesso-v1";

export type Usuario = {
  sub: string;
  name: string;
  email: string;
  kind: "person" | "key";
};

const noStore = { "cache-control": "private, no-store" };

export function senhaDoEscritorio(): string {
  return (process.env.ACESSO_SENHA ?? "").trim();
}

function selo(senha: string): Buffer {
  return createHmac("sha256", senha).update(SELO).digest();
}

function iguais(a: string, b: string): boolean {
  const ha = createHmac("sha256", SELO).update(a).digest();
  const hb = createHmac("sha256", SELO).update(b).digest();
  return timingSafeEqual(ha, hb);
}

function lerCookie(request: Request, nome: string): string {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [chave, ...resto] = part.trim().split("=");
    if (chave === nome) return decodeURIComponent(resto.join("="));
  }
  return "";
}

export async function sessaoValida(request: Request): Promise<boolean> {
  const senha = senhaDoEscritorio();
  const got = lerCookie(request, COOKIE);
  if (!senha || !got) return false;
  const esperado = selo(senha).toString("base64url");
  return iguais(got, esperado);
}

function seguro(request: Request): boolean {
  if (request.headers.get("x-forwarded-proto") === "https") return true;
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

export function cabecalhoSessao(senha: string, request: Request): string {
  const valor = selo(senha).toString("base64url");
  const partes = [
    `${COOKIE}=${valor}`,
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

export function senhaConfere(digitada: string): boolean {
  const esperada = senhaDoEscritorio();
  if (!esperada || !digitada) return false;
  return iguais(digitada, esperada);
}

/** Conta Cursor, quando existe, ou a senha do escritório no app público. */
export async function requireAcesso(request: Request): Promise<Usuario | Response> {
  const identity = await getIdentity(request);
  if (identity.verified) {
    return {
      sub: identity.sub,
      name: identity.name,
      email: identity.kind === "person" ? identity.email : "",
      kind: identity.kind,
    };
  }
  if (await sessaoValida(request)) {
    return {
      sub: "acesso:escritorio",
      name: "Equipe Eleva",
      email: "",
      kind: "person",
    };
  }
  return Response.json(
    { error: "Entre com a senha do escritório." },
    { status: 401, headers: noStore },
  );
}
