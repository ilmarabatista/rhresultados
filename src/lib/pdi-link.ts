import "server-only";
import { SignJWT, jwtVerify } from "jose";

/**
 * O link do PDI para mandar ao colaborador: abre sem login, só aquele plano,
 * e mostra o que foi combinado na conversa 1 a 1. É assinado com o mesmo
 * segredo da sessão, então não precisa de tabela; trocar o AUTH_SECRET
 * invalida todos. Vale 120 dias: os 3 meses do plano e uma folga.
 */

const PUBLICO = "pdi";
export const DIAS_DO_LINK_DO_PDI = 120;

function segredo() {
  const valor = process.env.AUTH_SECRET;
  if (!valor) throw new Error("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(valor);
}

export async function assinarPdi(planoId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(planoId)
    .setAudience(PUBLICO)
    .setIssuedAt()
    .setExpirationTime(`${DIAS_DO_LINK_DO_PDI}d`)
    .sign(segredo());
}

/** O plano do link, ou null se o link é falso ou venceu. */
export async function lerLinkDoPdi(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, segredo(), { audience: PUBLICO, algorithms: ["HS256"] });
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}
