import "server-only";
import type { Horario, Regime, Totais, DiaCalculado, TipoOcorrencia } from "./ponto";

/**
 * A conversa com o sistema de ponto, que mora à parte (outro endereço, outro
 * banco). O RH só lê e ajusta pelo caminho /api/rh/empresas/<id da empresa>/...
 * de lá, com a chave INTEGRACAO_SECRET, a mesma configurada no ponto.
 */

export function enderecoDoPonto(): string | null {
  const url = process.env.PONTO_URL;
  return url ? url.replace(/\/$/, "") : null;
}

function chave(): string | null {
  const v = process.env.INTEGRACAO_SECRET;
  return v && v.length >= 16 ? v : null;
}

export function pontoConfigurado(): boolean {
  return Boolean(enderecoDoPonto() && chave());
}

export class ErroDoPonto extends Error {
  constructor(
    mensagem: string,
    readonly status: number,
  ) {
    super(mensagem);
  }
}

async function chamar(companyId: string, caminho: string, init?: RequestInit): Promise<Response> {
  const base = enderecoDoPonto();
  const segredo = chave();
  if (!base || !segredo) throw new ErroDoPonto("A ligação com o sistema de ponto não está configurada.", 503);
  const url = `${base}/api/rh/empresas/${encodeURIComponent(companyId)}${caminho}`;
  let r: Response;
  try {
    r = await fetch(url, {
      ...init,
      headers: { authorization: `Bearer ${segredo}`, "content-type": "application/json", ...init?.headers },
      cache: "no-store",
    });
  } catch {
    throw new ErroDoPonto("O sistema de ponto não respondeu. Tente de novo em instantes.", 503);
  }
  if (!r.ok) {
    const corpo = (await r.json().catch(() => null)) as { erro?: string } | null;
    throw new ErroDoPonto(corpo?.erro ?? `O sistema de ponto respondeu com erro (${r.status}).`, r.status);
  }
  return r;
}

export async function lerDoPonto<T>(companyId: string, caminho: string): Promise<T> {
  return (await chamar(companyId, caminho)).json() as Promise<T>;
}

/** Escreve no ponto. Devolve a mensagem de erro, ou null quando deu certo. */
export async function escreverNoPonto(
  companyId: string,
  caminho: string,
  metodo: "POST" | "PUT" | "DELETE",
  corpo?: unknown,
): Promise<string | null> {
  try {
    await chamar(companyId, caminho, { method: metodo, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    return null;
  } catch (e) {
    return e instanceof ErroDoPonto ? e.message : "Não foi possível falar com o sistema de ponto.";
  }
}

/** A foto ou o PDF do atestado que o colaborador mandou. */
export async function anexoDoPedido(companyId: string, pedidoId: string): Promise<Response> {
  return chamar(companyId, `/pedidos/${encodeURIComponent(pedidoId)}/anexo`);
}

/** A foto de uma batida, para o RH ver no espelho. */
export async function fotoDaBatida(companyId: string, marcacaoId: string): Promise<Response> {
  return chamar(companyId, `/marcacoes/${encodeURIComponent(marcacaoId)}/foto`);
}

/** A foto que o colaborador tirou ao aprovar o espelho do mês. */
export async function fotoDaAprovacao(companyId: string, colaboradorId: string, mes: string): Promise<Response> {
  return chamar(companyId, `/relatorios/${encodeURIComponent(colaboradorId)}/${encodeURIComponent(mes)}/foto`);
}

// ------------------------------------------------------------------- tipos

export type EmpresaNoPonto = {
  id: string;
  nome: string;
  ativo: boolean;
  regime: Regime;
  horario: Horario;
  tolerancia: number;
  intervaloMinimo: number;
  validadeBancoMeses: number;
  /** Banco por semana; ausente enquanto o ponto não tiver a opção. */
  bancoSemanal?: boolean;
  inicio: string;
};

export type ColaboradorNoPonto = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  trocarSenha: boolean;
  horario: Horario | null;
  admissao: string | null;
};

export type MarcacaoNoPonto = {
  id: string;
  nsr: number;
  minuto: number;
  origem: "APLICATIVO" | "MANUAL";
  motivo: string | null;
  anulada: boolean;
  anuladaMotivo: string | null;
  temFoto: boolean;
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
};

export type DiaNoPonto = DiaCalculado & {
  marcacoes: MarcacaoNoPonto[];
  ocorrenciaId: string | null;
  ocorrenciaDescricao: string | null;
  foraDoPeriodo: boolean;
};

export type CalculoNoPonto = { pessoa: ColaboradorNoPonto; dias: DiaNoPonto[]; totais: Totais };
export type SaldoNoPonto = { dias: number; lancamentos: number; total: number };

export type OcorrenciaNoPonto = {
  id: string;
  dia: string;
  tipo: TipoOcorrencia;
  descricao: string | null;
  colaborador: string | null;
  criadoPor: string | null;
  criadoEm: string;
};

export type LancamentoNoPonto = { id: string; dia: string; minutos: number; descricao: string; criadoPor: string | null };
export type RelatorioNoPonto = {
  colaboradorId: string;
  enviadoEm: string;
  enviadoPor: string | null;
  /** Quando o colaborador conferiu e aprovou o mês. */
  cienteEm: string | null;
  /** Aprovou com foto; ausente enquanto o ponto não tiver a aprovação com foto. */
  temFoto?: boolean;
};

/** O que o colaborador pediu pelo aplicativo: atestado ou correção de batida. */
export type PedidoNoPonto = {
  id: string;
  tipo: "ATESTADO" | "CORRECAO";
  situacao: "PENDENTE" | "APROVADO" | "RECUSADO";
  colaboradorId: string;
  colaborador: string;
  dia: string;
  ate: string | null;
  marcacaoId: string | null;
  minutos: number | null;
  era: string | null;
  motivo: string | null;
  anexo: { nome: string; tipo: string } | null;
  criadoEm: string;
  decididoEm: string | null;
  decididoPor: string | null;
  resposta: string | null;
};

/**
 * A empresa no ponto e os colaboradores dela; null quando o ponto dela ainda
 * não foi criado. `pedidosPendentes` falta enquanto o ponto não tiver pedidos.
 */
export async function empresaNoPonto(companyId: string) {
  try {
    return await lerDoPonto<{ empresa: EmpresaNoPonto; colaboradores: ColaboradorNoPonto[]; pedidosPendentes?: number }>(companyId, "");
  } catch (e) {
    if (e instanceof ErroDoPonto && e.status === 404) return null;
    throw e;
  }
}

export async function calculosNoPonto(companyId: string, desde: string, ate: string, colaboradorId?: string) {
  const q = new URLSearchParams({ desde, ate, ...(colaboradorId ? { colaborador: colaboradorId } : {}) });
  return (await lerDoPonto<{ calculos: CalculoNoPonto[] }>(companyId, `/calculo?${q}`)).calculos;
}

export async function saldosNoPonto(companyId: string, colaboradorId?: string) {
  const q = colaboradorId ? `?colaborador=${encodeURIComponent(colaboradorId)}` : "";
  return (await lerDoPonto<{ saldos: Record<string, SaldoNoPonto> }>(companyId, `/saldos${q}`)).saldos;
}

export async function presentesNoPonto(companyId: string) {
  return lerDoPonto<{ presentes: { nome: string; desde: string }[]; bateramHoje: number }>(companyId, "/presentes");
}

export async function ocorrenciasNoPonto(companyId: string, desde: string, ate: string) {
  return (await lerDoPonto<{ ocorrencias: OcorrenciaNoPonto[] }>(companyId, `/ocorrencias?${new URLSearchParams({ desde, ate })}`)).ocorrencias;
}

export async function lancamentosNoPonto(companyId: string, colaboradorId: string) {
  return (await lerDoPonto<{ lancamentos: LancamentoNoPonto[] }>(companyId, `/lancamentos?colaborador=${encodeURIComponent(colaboradorId)}`))
    .lancamentos;
}

export async function relatoriosNoPonto(companyId: string, mes: string) {
  return (await lerDoPonto<{ relatorios: RelatorioNoPonto[] }>(companyId, `/relatorios?mes=${mes}`)).relatorios;
}

export async function pedidosNoPonto(companyId: string) {
  return lerDoPonto<{ pendentes: PedidoNoPonto[]; decididos: PedidoNoPonto[] }>(companyId, "/pedidos");
}
