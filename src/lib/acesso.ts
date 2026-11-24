import { getIdentity, requireTeamRole } from "../../cursor/identity";
import { lerSessao } from "./usuarios";

const COOKIE = "eleva_acesso";

export type PapelAcesso = "campo" | "escritorio" | "conta";

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

export function podeDefinirSenhas(usuario: Usuario): boolean {
  return usuario.papel === "conta" || usuario.papel === "escritorio";
}

/** Sessão de uma pessoa da equipe, ou a conta Cursor de quem já passou no portão privado ou do time. */
export async function lerAcesso(request: Request): Promise<Usuario | undefined> {
  const token = lerCookie(request, COOKIE);
  if (token) {
    const sessao = await lerSessao(token);
    if (sessao) {
      return {
        sub: `usuario:${sessao.id}`,
        name: sessao.nome,
        email: "",
        kind: "person",
        papel: sessao.papel,
      };
    }
  }

  const identity = await getIdentity(request);
  if (!identity.verified || identity.kind !== "person") return undefined;
  if (identity.appVisibility === "private") {
    return {
      sub: identity.sub,
      name: identity.name,
      email: identity.email,
      kind: "person",
      papel: "conta",
    };
  }
  if (identity.appVisibility === "team") {
    const membro = requireTeamRole(identity, ["admin", "member"]);
    if (membro instanceof Response) return undefined;
    return {
      sub: identity.sub,
      name: identity.name,
      email: identity.email,
      kind: "person",
      papel: "conta",
    };
  }
  return undefined;
}

export async function requireAcesso(request: Request): Promise<Usuario | Response> {
  const usuario = await lerAcesso(request);
  if (usuario) return usuario;
  return Response.json(
    { error: "Entre com seu usuário." },
    { status: 401, headers: noStore },
  );
}
