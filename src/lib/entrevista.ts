import { textoSeguro } from "./texto-seguro";

/**
 * A entrevista do candidato, organizada pelas perguntas da vaga.
 *
 * O roteiro fica na vaga. Quando a entrevista é organizada, as perguntas são
 * copiadas para dentro dela: mudar o roteiro depois não bagunça o que já foi
 * registrado. Daqui sai também o pedido à IA e a leitura do que ela devolve;
 * a chamada em si fica em `ai-entrevista.ts`.
 */

export type RespostaDaEntrevista = { pergunta: string; resposta: string };

export type Entrevista = {
  /** O texto colado, guardado para conferir depois. */
  transcricao: string;
  respostas: RespostaDaEntrevista[];
  /** O que o candidato falou fora das perguntas. */
  outros: string;
  /** A avaliação de quem entrevistou: escrita por ela, nunca pela IA. */
  avaliacao: string;
  /** Quando a IA organizou (ISO), ou vazio se foi escrito à mão. */
  organizadaEm: string;
};

/** Quanto texto de transcrição aceitamos: uma entrevista longa cabe com folga. */
export const TETO_DA_TRANSCRICAO = 80_000;

/** O que a IA escreve quando a pergunta não foi feita ou não teve resposta. */
export const SEM_RESPOSTA = "Não respondida na transcrição.";

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? textoSeguro(v).trim().slice(0, max) : "";
}

/** O roteiro da vaga, lido do banco ou do formulário: uma pergunta por item, sem repetidas. */
export function lerPerguntas(cru: unknown): string[] {
  const lista = Array.isArray(cru) ? cru : typeof cru === "string" ? cru.split(/\r?\n/) : [];
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const item of lista) {
    const p = texto(item, 500).replace(/^\s*(\d+[.)-]|[-•*])\s*/, "");
    const chave = p.toLowerCase();
    if (!p || vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(p);
  }
  return saida.slice(0, 60);
}

export function entrevistaVazia(perguntas: string[]): Entrevista {
  return {
    transcricao: "",
    respostas: perguntas.map((pergunta) => ({ pergunta, resposta: "" })),
    outros: "",
    avaliacao: "",
    organizadaEm: "",
  };
}

export function lerEntrevista(cru: unknown): Entrevista | null {
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return null;
  const o = cru as Record<string, unknown>;
  const respostas = (Array.isArray(o.respostas) ? o.respostas : [])
    .map((r) => {
      const x = (r && typeof r === "object" ? r : {}) as Record<string, unknown>;
      return { pergunta: texto(x.pergunta, 500), resposta: texto(x.resposta, 10_000) };
    })
    .filter((r) => r.pergunta);
  return {
    transcricao: texto(o.transcricao, TETO_DA_TRANSCRICAO),
    respostas,
    outros: texto(o.outros, 10_000),
    avaliacao: texto(o.avaliacao, 10_000),
    organizadaEm: typeof o.organizadaEm === "string" ? o.organizadaEm : "",
  };
}

// ------------------------------------------------------------------- a IA

export const SYSTEM_DA_ENTREVISTA = [
  "Você organiza a transcrição de uma entrevista de emprego para a consultora de RH que conduziu a conversa.",
  "Recebe o roteiro de perguntas da vaga e a transcrição. Para cada pergunta do roteiro, encontre na conversa o que o CANDIDATO respondeu.",
  "Regras:",
  "- Use as palavras do candidato. Pode tirar vícios de fala, repetições e hesitações (\"né\", \"tipo\", \"é...\") e juntar trechos espalhados, mas não acrescente nada que ele não disse.",
  "- Não avalie, não elogie, não critique, não tire conclusões sobre o candidato. Quem avalia é a consultora.",
  "- A pergunta pode ter sido feita com outras palavras ou fora de ordem. Procure pelo sentido.",
  "- Se a resposta a uma pergunta aparecer em mais de um momento, junte tudo naquela pergunta.",
  `- Se a pergunta não foi feita ou não teve resposta, escreva exatamente: "${SEM_RESPOSTA}"`,
  "- O que o candidato contou de relevante e não responde a nenhuma pergunta vai em \"outros\", em tópicos curtos. Se não houver, deixe vazio.",
  "- A transcrição pode não indicar quem fala. Deduza pelo contexto: quem pergunta é a entrevistadora.",
  "- Escreva em português do Brasil, sem emoji e sem markdown.",
  "",
  "Responda SOMENTE com um JSON neste formato, com as perguntas na mesma ordem e com o mesmo número de itens do roteiro:",
  '{"respostas": [{"numero": 1, "resposta": "..."}], "outros": "..."}',
].join("\n");

export function pedidoDaEntrevista(perguntas: string[], transcricao: string): string {
  return [
    "<roteiro>",
    ...perguntas.map((p, i) => `${i + 1}. ${p}`),
    "</roteiro>",
    "",
    "<transcricao>",
    transcricao,
    "</transcricao>",
  ].join("\n");
}

/**
 * Lê o que a IA devolveu e casa com o roteiro pela posição.
 *
 * A ordem e o texto das perguntas são sempre os do roteiro: a IA só preenche
 * as respostas. O que ela não devolveu fica como não respondido.
 */
export function respostasDaIA(lido: unknown, perguntas: string[]): { respostas: RespostaDaEntrevista[]; outros: string } {
  const o = (lido && typeof lido === "object" ? lido : {}) as Record<string, unknown>;
  const crus = Array.isArray(o.respostas) ? o.respostas : [];
  const porNumero = new Map<number, string>();
  crus.forEach((c, i) => {
    const x = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
    const n = Number(x.numero);
    const numero = Number.isInteger(n) && n >= 1 && n <= perguntas.length ? n : i + 1;
    const resposta = texto(x.resposta, 10_000);
    if (resposta && !porNumero.has(numero)) porNumero.set(numero, resposta);
  });
  return {
    respostas: perguntas.map((pergunta, i) => ({ pergunta, resposta: porNumero.get(i + 1) ?? SEM_RESPOSTA })),
    outros: texto(o.outros, 10_000),
  };
}
