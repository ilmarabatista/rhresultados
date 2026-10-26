import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * O link do dossiê para mandar ao cliente: abre sem login, só aquele
 * candidato, e vence em 30 dias. É assinado com o mesmo segredo da sessão,
 * então não precisa de tabela; trocar o AUTH_SECRET invalida todos.
 */

const PUBLICO = "dossie";
export const DIAS_DO_LINK = 30;

function segredo() {
  const valor = process.env.AUTH_SECRET;
  if (!valor) throw new Error("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(valor);
}

export async function assinarDossie(candidatoId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(candidatoId)
    .setAudience(PUBLICO)
    .setIssuedAt()
    .setExpirationTime(`${DIAS_DO_LINK}d`)
    .sign(segredo());
}

/** O candidato do link, ou null se o link é falso ou venceu. */
export async function lerLinkDoDossie(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, segredo(), { audience: PUBLICO, algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
