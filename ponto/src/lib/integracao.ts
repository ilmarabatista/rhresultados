import "server-only";
import { timingSafeEqual } from "node:crypto";

/**
 * A conversa com o RH Resultados. Os dois lados usam a mesma chave,
 * INTEGRACAO_SECRET, mandada no cabeçalho Authorization: Bearer.
 *
 * Momento 1: o ponto pede ao RH a lista de empresas, para criar o ponto de uma
 * delas. Momento 2: o RH lê e ajusta as batidas aqui, em /api/rh/...
 */

export const SENHA_PADRAO = "12345";

function chave(): string | null {
  const v = process.env.INTEGRACAO_SECRET;
  return v && v.length >= 16 ? v : null;
}

/** Confere a chave de quem chama a API. Sem chave configurada, ninguém entra. */
export function chamadaDoRh(request: Request): boolean {
  const esperada = chave();
  if (!esperada) return false;
  const recebida = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type EmpresaDoRh = { id: string; nome: string };

/** Momento 1: as empresas cadastradas no RH. */
export async function empresasDoRh(): Promise<{ ok: true; empresas: EmpresaDoRh[] } | { ok: false; erro: string }> {
  const url = process.env.RH_URL;
  const segredo = chave();
  if (!url || !segredo) return { ok: false, erro: "A ligação com o RH não está configurada (RH_URL e INTEGRACAO_SECRET)." };
  try {
    const r = await fetch(`${url.replace(/\/$/, "")}/api/integracao/empresas`, {
      headers: { authorization: `Bearer ${segredo}` },
      cache: "no-store",
    });
    if (!r.ok) return { ok: false, erro: `O RH respondeu com erro (${r.status}).` };
    const corpo = (await r.json()) as { empresas?: EmpresaDoRh[] };
    return { ok: true, empresas: corpo.empresas ?? [] };
  } catch {
    return { ok: false, erro: "Não foi possível falar com o RH agora." };
  }
}
