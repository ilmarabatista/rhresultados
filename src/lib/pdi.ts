/**
 * PDI — Plano de Desenvolvimento Individual: as regras, sem banco, para serem
 * testadas.
 *
 * O caminho é sempre o mesmo: a descrição do cargo diz que competências ele
 * pede e em que nível; a avaliação, feita junto com a pessoa, diz onde ela
 * está; a diferença é o gap. Os gaps escolhidos viram metas SMART com ações, e
 * as conversas de acompanhamento registram o avanço até o plano fechar.
 */

// ------------------------------------------------------------ competências

export const TIPOS_DE_COMPETENCIA = ["TECNICA", "COMPORTAMENTAL"] as const;
export type TipoDeCompetencia = (typeof TIPOS_DE_COMPETENCIA)[number];

export const ROTULO_DO_TIPO: Record<TipoDeCompetencia, string> = {
  TECNICA: "Técnica",
  COMPORTAMENTAL: "Comportamental",
};

export function lerTipoDeCompetencia(valor: string): TipoDeCompetencia {
  return valor === "COMPORTAMENTAL" ? "COMPORTAMENTAL" : "TECNICA";
}

/** A escala de 1 a 5, igual para o cargo e para a avaliação. */
export const NIVEIS = [1, 2, 3, 4, 5] as const;

export const ROTULO_DO_NIVEL: Record<number, string> = {
  1: "Não conhece",
  2: "Conhece, precisa de ajuda",
  3: "Faz sozinho",
  4: "Faz com excelência",
  5: "Ensina os outros",
};

/** Um nível de 1 a 5, ou null para "ainda sem nota". */
export function lerNivel(valor: unknown): number | null {
  const n = typeof valor === "number" ? valor : Number(String(valor ?? "").trim());
  if (!Number.isInteger(n) || n < 1 || n > 5) return null;
  return n;
}

// ---------------------------------------------------------------- gaps

export type Nota = {
  nome: string;
  esperado: number;
  pessoa: number | null;
  avaliador: number | null;
  acordado: number | null;
};

/**
 * O nível que vale: o acordado entre os dois. Enquanto a conversa não chegou
 * nele, vale o do avaliador, e na falta dele o da pessoa.
 */
export function nivelFinal(n: Nota): number | null {
  return n.acordado ?? n.avaliador ?? n.pessoa ?? null;
}

/** Quanto falta para o nível do cargo. Zero ou negativo é sem gap. */
export function gap(n: Nota): number | null {
  const f = nivelFinal(n);
  return f == null ? null : n.esperado - f;
}

/** Os gaps a trabalhar, do maior para o menor. */
export function gapsPrioritarios<T extends Nota>(notas: T[]): T[] {
  return notas
    .filter((n) => (gap(n) ?? 0) > 0)
    .sort((a, b) => (gap(b) ?? 0) - (gap(a) ?? 0) || a.esperado - b.esperado);
}

/** Onde a pessoa e o avaliador discordam em dois níveis ou mais: pede conversa. */
export function divergencias<T extends Nota>(notas: T[]): T[] {
  return notas.filter((n) => n.pessoa != null && n.avaliador != null && Math.abs(n.pessoa - n.avaliador) >= 2);
}

export type ResumoDaAvaliacao = {
  competencias: number;
  avaliadas: number;
  comGap: number;
  /** Quanto do esperado pelo cargo a pessoa já entrega, de 0 a 100. */
  aderencia: number | null;
};

export function resumoDaAvaliacao(notas: Nota[]): ResumoDaAvaliacao {
  const avaliadas = notas.filter((n) => nivelFinal(n) != null);
  const esperado = avaliadas.reduce((s, n) => s + n.esperado, 0);
  const entregue = avaliadas.reduce((s, n) => s + Math.min(nivelFinal(n)!, n.esperado), 0);
  return {
    competencias: notas.length,
    avaliadas: avaliadas.length,
    comGap: avaliadas.filter((n) => gap(n)! > 0).length,
    aderencia: esperado > 0 ? Math.round((entregue / esperado) * 100) : null,
  };
}

/** Antes e depois de cada competência, entre duas avaliações (pelo nome). */
export function comparar(
  anterior: Nota[],
  atual: Nota[],
): { nome: string; antes: number | null; depois: number | null; mudou: number | null }[] {
  const chave = (s: string) => s.trim().toLowerCase();
  const antes = new Map(anterior.map((n) => [chave(n.nome), nivelFinal(n)]));
  return atual.map((n) => {
    const a = antes.get(chave(n.nome)) ?? null;
    const d = nivelFinal(n);
    return { nome: n.nome, antes: a, depois: d, mudou: a != null && d != null ? d - a : null };
  });
}

// ---------------------------------------------------------------- metas

export const STATUS_DA_META = ["NAO_INICIADA", "EM_ANDAMENTO", "ATINGIDA", "NAO_ATINGIDA", "CANCELADA"] as const;
export type StatusDaMeta = (typeof STATUS_DA_META)[number];

export const ROTULO_DA_META: Record<StatusDaMeta, string> = {
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  ATINGIDA: "Atingida",
  NAO_ATINGIDA: "Não atingida",
  CANCELADA: "Cancelada",
};

export const TOM_DA_META: Record<StatusDaMeta, "neutro" | "azul" | "bom" | "atencao" | "ruim"> = {
  NAO_INICIADA: "neutro",
  EM_ANDAMENTO: "azul",
  ATINGIDA: "bom",
  NAO_ATINGIDA: "ruim",
  CANCELADA: "neutro",
};

export function lerStatusDaMeta(valor: string): StatusDaMeta {
  return (STATUS_DA_META as readonly string[]).includes(valor) ? (valor as StatusDaMeta) : "NAO_INICIADA";
}

/** Progresso de 0 a 100, em passos inteiros. */
export function lerProgresso(valor: unknown): number {
  const n = Math.round(Number(valor));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

/**
 * O status que combina com o progresso, quando ninguém escolheu outro: 100%
 * é atingida; algum avanço é em andamento. Atingida, não atingida e cancelada
 * são decisões da conversa e não mudam sozinhas.
 */
export function statusPeloProgresso(status: StatusDaMeta, progresso: number): StatusDaMeta {
  if (status === "NAO_ATINGIDA" || status === "CANCELADA") return status;
  if (progresso >= 100) return "ATINGIDA";
  if (status === "ATINGIDA") return "EM_ANDAMENTO";
  return progresso > 0 ? "EM_ANDAMENTO" : status;
}

export type MetaSmart = {
  titulo: string;
  indicador: string | null;
  recursos: string | null;
  relevancia: string | null;
  prazo: Date | string | null;
};

export const LETRAS_SMART = [
  { letra: "S", nome: "Específica", dica: "O que exatamente vai mudar, em uma frase clara." },
  { letra: "M", nome: "Mensurável", dica: "O indicador: como as duas partes vão saber que chegou lá." },
  { letra: "A", nome: "Atingível", dica: "O apoio e os recursos que tornam a meta possível." },
  { letra: "R", nome: "Relevante", dica: "Por que importa para o cargo e para a pessoa." },
  { letra: "T", nome: "Temporal", dica: "Até quando." },
] as const;

const preenchido = (t: string | null | undefined, minimo = 3) => (t ?? "").trim().length >= minimo;

/** Quais letras do SMART a meta já cumpre. */
export function checarSmart(m: MetaSmart): Record<"S" | "M" | "A" | "R" | "T", boolean> {
  return {
    // Uma palavra solta ("Excel") não é específica.
    S: preenchido(m.titulo, 12) && m.titulo.trim().split(/\s+/).length >= 3,
    M: preenchido(m.indicador),
    A: preenchido(m.recursos),
    R: preenchido(m.relevancia),
    T: m.prazo != null && m.prazo !== "",
  };
}

export function metaCompleta(m: MetaSmart): boolean {
  return Object.values(checarSmart(m)).every(Boolean);
}

/** O ponto de partida de uma meta para um gap: ela edita antes de valer. */
export function metaSugerida(n: Nota & { tipo?: string }): {
  titulo: string;
  indicador: string;
  relevancia: string;
} {
  const atual = nivelFinal(n);
  return {
    titulo:
      atual == null
        ? `Desenvolver ${n.nome} até o nível ${n.esperado}`
        : `Levar ${n.nome} do nível ${atual} para o nível ${n.esperado}`,
    indicador: `Na reavaliação, chegar ao nível ${n.esperado} (${ROTULO_DO_NIVEL[n.esperado].toLowerCase()}).`,
    relevancia: `O cargo pede ${n.nome} no nível ${n.esperado}.`,
  };
}

/** O progresso do plano: a média das metas que contam (cancelada não conta). */
export function progressoDoPlano(metas: { status: string; progresso: number }[]): number | null {
  const contam = metas.filter((m) => m.status !== "CANCELADA");
  if (contam.length === 0) return null;
  const soma = contam.reduce((s, m) => s + (m.status === "ATINGIDA" ? 100 : lerProgresso(m.progresso)), 0);
  return Math.round(soma / contam.length);
}

// ----------------------------------------------------------------- ações

/** O 70-20-10: aprender fazendo, com os outros e estudando. */
export const TIPOS_DE_ACAO = ["PRATICA", "TROCA", "FORMAL"] as const;
export type TipoDeAcao = (typeof TIPOS_DE_ACAO)[number];

export const ROTULO_DA_ACAO: Record<TipoDeAcao, string> = {
  PRATICA: "Prática (70%)",
  TROCA: "Troca (20%)",
  FORMAL: "Formal (10%)",
};

export const DICA_DA_ACAO: Record<TipoDeAcao, string> = {
  PRATICA: "No dia a dia: projeto, tarefa nova, responsabilidade a mais.",
  TROCA: "Com os outros: mentoria, acompanhar um colega, feedback.",
  FORMAL: "Estudo: curso, treinamento, leitura.",
};

export function lerTipoDeAcao(valor: string): TipoDeAcao {
  return (TIPOS_DE_ACAO as readonly string[]).includes(valor) ? (valor as TipoDeAcao) : "PRATICA";
}

/** Quanto do plano é de cada tipo, em %. */
export function distribuicao(acoes: { tipo: string }[]): Record<TipoDeAcao, number> {
  const total = acoes.length;
  const conta = (t: TipoDeAcao) => acoes.filter((a) => lerTipoDeAcao(a.tipo) === t).length;
  return {
    PRATICA: total ? Math.round((conta("PRATICA") / total) * 100) : 0,
    TROCA: total ? Math.round((conta("TROCA") / total) * 100) : 0,
    FORMAL: total ? Math.round((conta("FORMAL") / total) * 100) : 0,
  };
}

// -------------------------------------------------------- acompanhamento

export type SituacaoDaConversa = "SEM_DATA" | "ATRASADA" | "PROXIMA" | "EM_DIA";

/**
 * A próxima conversa, comparada com hoje (as duas em "AAAA-MM-DD"): passou é
 * atrasada; nos próximos sete dias é próxima.
 */
export function situacaoDaConversa(proxima: string | null, hoje: string): SituacaoDaConversa {
  if (!proxima) return "SEM_DATA";
  if (proxima < hoje) return "ATRASADA";
  const dias = (Date.parse(`${proxima}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)) / 86_400_000;
  return dias <= 7 ? "PROXIMA" : "EM_DIA";
}

// ------------------------------------------------- ação como combinado

/**
 * Cada ação do PDI é um combinado: tem responsável e prazo, e é cobrada por
 * ele. Só que, em vez de feito ou não feito, mede o quanto foi feito.
 */
export const QUANTO_FEITO = [0, 25, 50, 75, 100] as const;

export const ROTULO_DO_QUANTO: Record<number, string> = {
  0: "Não feito",
  25: "Começou",
  50: "Metade",
  75: "Quase",
  100: "Feito",
};

/** Arredonda para o degrau mais próximo da escala (0, 25, 50, 75, 100). */
export function lerQuantoFeito(valor: unknown): number {
  const n = Number(valor);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, Math.round(n / 25) * 25));
}

export type SituacaoDaAcao = "FEITA" | "ATRASADA" | "HOJE" | "NO_PRAZO" | "SEM_DATA";

/** Igual ao combinado da reunião: só sai da cobrança quando está 100%. */
export function situacaoDaAcao(a: { quantoFeito: number; prazo: string | null }, hoje: string): SituacaoDaAcao {
  if (a.quantoFeito >= 100) return "FEITA";
  if (!a.prazo) return "SEM_DATA";
  if (a.prazo < hoje) return "ATRASADA";
  if (a.prazo === hoje) return "HOJE";
  return "NO_PRAZO";
}

/** O quanto as ações de uma meta já andaram, de 0 a 100; null sem ações. */
export function execucaoDasAcoes(acoes: { quantoFeito: number }[]): number | null {
  if (acoes.length === 0) return null;
  return Math.round(acoes.reduce((s, a) => s + lerQuantoFeito(a.quantoFeito), 0) / acoes.length);
}
