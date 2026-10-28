/**
 * Regra da Ilmara (28/10/2026): nada que alguém respondeu por link some sem
 * ela confirmar. Valem como resposta: o questionário de cargo e a
 * autoavaliação respondidos, o mapeamento de rotinas que a pessoa enviou, cada
 * resposta da pesquisa de clima e a ficha de solicitação preenchida.
 *
 * Quem exclui algo que leva respostas junto (o cargo, a pessoa, a pesquisa, a
 * vaga, a empresa ou o próprio envio) primeiro conta o que vai junto; se tiver
 * resposta, devolve a descrição e só apaga quando a tela pede de novo, já
 * confirmado. No banco, um gatilho recusa apagar resposta fora dessa
 * confirmação (migration 20261028120000_respostas_protegidas).
 */

export type ContagemDeRespostas = {
  questionarios: number;
  autoavaliacoes: number;
  mapeamentos: number;
  clima: number;
  fichas: number;
};

export const SEM_RESPOSTAS: ContagemDeRespostas = { questionarios: 0, autoavaliacoes: 0, mapeamentos: 0, clima: 0, fichas: 0 };

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

/** "1 questionário de cargo e 3 respostas da pesquisa de clima", ou null se não há nenhuma. */
export function descreverRespostas(c: ContagemDeRespostas): string | null {
  const partes = [
    c.questionarios ? plural(c.questionarios, "questionário de cargo respondido", "questionários de cargo respondidos") : "",
    c.autoavaliacoes ? plural(c.autoavaliacoes, "autoavaliação respondida", "autoavaliações respondidas") : "",
    c.mapeamentos ? plural(c.mapeamentos, "mapeamento de rotinas enviado", "mapeamentos de rotinas enviados") : "",
    c.clima ? plural(c.clima, "resposta da pesquisa de clima", "respostas da pesquisa de clima") : "",
    c.fichas ? plural(c.fichas, "ficha de solicitação preenchida", "fichas de solicitação preenchidas") : "",
  ].filter(Boolean);
  if (partes.length === 0) return null;
  if (partes.length === 1) return partes[0];
  return `${partes.slice(0, -1).join(", ")} e ${partes[partes.length - 1]}`;
}

/** A pergunta que a tela faz antes de apagar. */
export function pedidoParaApagar(respostas: string): string {
  return `Isto apaga para sempre ${respostas} pelo link. Não há como recuperar depois. Apagar mesmo assim?`;
}
