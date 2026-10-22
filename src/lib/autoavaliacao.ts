/**
 * Autoavaliação do PDI: as regras, sem banco, para serem testadas.
 *
 * A empresa monta um modelo por função, com perguntas de cinco tipos: as
 * competências técnicas e as comportamentais têm nota de 1 a 4, as tarefas
 * dizem quanto a pessoa já faz sozinha, as condutas dizem com que frequência
 * algo aconteceu no último mês, e as abertas são texto livre. A pessoa
 * responde pelo link; as respostas viram a avaliação do PDI, já com a nota
 * "como a pessoa se vê" em cada item, e o RH completa a dele internamente.
 */

import { textoSeguro } from "./texto-seguro";

// ---------------------------------------------------------------- perguntas

export const TIPOS_DE_PERGUNTA = ["TECNICA", "COMPORTAMENTAL", "TAREFA", "CONDUTA", "ABERTA"] as const;
export type TipoDePergunta = (typeof TIPOS_DE_PERGUNTA)[number];

export function lerTipoDePergunta(valor: unknown): TipoDePergunta | null {
  return (TIPOS_DE_PERGUNTA as readonly string[]).includes(String(valor)) ? (valor as TipoDePergunta) : null;
}

/** Cada tipo é uma seção da ficha, sempre nesta ordem. */
export const SECAO_DO_TIPO: Record<TipoDePergunta, { titulo: string; curto: string; ajuda?: string }> = {
  TECNICA: { titulo: "Competências técnicas da função", curto: "Técnica" },
  COMPORTAMENTAL: { titulo: "Competências comportamentais", curto: "Comportamental" },
  TAREFA: { titulo: "Tarefas da função", curto: "Tarefa" },
  CONDUTA: {
    titulo: "Condutas da função",
    curto: "Conduta",
    ajuda: "Responda com sinceridade. Isso não é uma advertência: é para entendermos juntos onde está a dificuldade. No último mês, eu...",
  },
  ABERTA: { titulo: "Perguntas abertas", curto: "Aberta" },
};

export type Opcao = { valor: string; rotulo: string; nivel: number | null };

const ESCALA: Opcao[] = [
  { valor: "1", rotulo: "Ainda não faço sem ajuda", nivel: 1 },
  { valor: "2", rotulo: "Faço, mas com erros ou supervisão", nivel: 2 },
  { valor: "3", rotulo: "Faço bem, no padrão", nivel: 3 },
  { valor: "4", rotulo: "Faço muito bem e sirvo de exemplo", nivel: 4 },
];

/**
 * As opções de cada tipo e o nível que cada uma vira na avaliação do PDI, na
 * escala de 1 a 5 de lá. A nota de 1 a 4 da ficha bate com os quatro primeiros
 * níveis do PDI (1 ainda não faz sozinho, 2 faz com ajuda, 3 faz sozinho no
 * padrão, 4 faz com excelência). "Não faço" fica sem nota: pode ser tarefa
 * que não é dela, e quem decide é o RH.
 */
export const OPCOES: Record<Exclude<TipoDePergunta, "ABERTA">, Opcao[]> = {
  TECNICA: ESCALA,
  COMPORTAMENTAL: ESCALA,
  TAREFA: [
    { valor: "SOZINHO", rotulo: "Faço sozinho(a)", nivel: 3 },
    { valor: "COM_AJUDA", rotulo: "Faço com ajuda", nivel: 2 },
    { valor: "NAO_FACO", rotulo: "Não faço", nivel: null },
    { valor: "QUERO_APRENDER", rotulo: "Quero aprender", nivel: 1 },
  ],
  CONDUTA: [
    { valor: "NUNCA", rotulo: "Nunca", nivel: 3 },
    { valor: "AS_VEZES", rotulo: "Às vezes", nivel: 2 },
    { valor: "FREQUENTE", rotulo: "Frequentemente", nivel: 1 },
  ],
};

/** O nível que o PDI espera de cada item que sai da autoavaliação: faz sozinho, no padrão. */
export const ESPERADO = 3;

export const LEGENDA_DA_ESCALA = ESCALA.map((o) => `${o.valor} = ${o.rotulo.toLowerCase()}`).join(" · ");

export const INSTRUCOES_PADRAO =
  "Olhe para o seu trabalho com sinceridade: não existe resposta certa. Esta ficha é o ponto de partida para montarmos juntos o seu plano de desenvolvimento.";

// ---------------------------------------------------------------- destinos

/** Para onde vai a resposta aberta na avaliação do PDI. */
export const DESTINOS = ["pontosFortes", "querDesenvolver", "apoio", "carreira"] as const;
export type Destino = (typeof DESTINOS)[number];

export const ROTULO_DO_DESTINO: Record<Destino, string> = {
  pontosFortes: "Pontos fortes",
  querDesenvolver: "O que quer desenvolver",
  apoio: "Apoio de que precisa",
  carreira: "Aspirações e resultados",
};

export function lerDestino(valor: unknown): Destino | null {
  return (DESTINOS as readonly string[]).includes(String(valor)) ? (valor as Destino) : null;
}

// ------------------------------------------------------------ o que foi mandado

export type PerguntaEnviada = { id: string; tipo: TipoDePergunta; texto: string; destino: Destino | null };

/** As perguntas copiadas no envio, lidas do JSON com cuidado. */
export function lerPerguntas(cru: unknown): PerguntaEnviada[] {
  if (!Array.isArray(cru)) return [];
  return cru.flatMap((p) => {
    const tipo = lerTipoDePergunta(p?.tipo);
    const id = typeof p?.id === "string" ? p.id : "";
    const texto = typeof p?.texto === "string" ? p.texto : "";
    if (!tipo || !id || !texto) return [];
    return [{ id, tipo, texto, destino: tipo === "ABERTA" ? lerDestino(p?.destino) : null }];
  });
}

/** As perguntas agrupadas nas seções da ficha, na ordem dos tipos. */
export function emSecoes<T extends { tipo: TipoDePergunta }>(perguntas: T[]): { tipo: TipoDePergunta; perguntas: T[] }[] {
  return TIPOS_DE_PERGUNTA.map((tipo) => ({ tipo, perguntas: perguntas.filter((p) => p.tipo === tipo) })).filter(
    (s) => s.perguntas.length > 0,
  );
}

export type Respostas = Record<string, string>;

const TETO_DA_ABERTA = 4000;

/** Fica só o que é resposta válida a uma pergunta mandada. */
export function lerRespostas(perguntas: PerguntaEnviada[], cru: unknown): Respostas {
  const obj = cru && typeof cru === "object" && !Array.isArray(cru) ? (cru as Record<string, unknown>) : {};
  const r: Respostas = {};
  for (const p of perguntas) {
    const v = obj[p.id];
    if (typeof v !== "string") continue;
    if (p.tipo === "ABERTA") {
      const t = textoSeguro(v).slice(0, TETO_DA_ABERTA);
      if (t.trim()) r[p.id] = t;
    } else if (OPCOES[p.tipo].some((o) => o.valor === v)) {
      r[p.id] = v;
    }
  }
  return r;
}

/** O que falta para enviar: todas as marcações. As abertas podem ficar em branco. */
export function conferirParaEnviar(perguntas: PerguntaEnviada[], respostas: Respostas): string | null {
  const faltam = perguntas.filter((p) => p.tipo !== "ABERTA" && !respostas[p.id]).length;
  if (faltam === 0) return null;
  return faltam === 1 ? "Falta marcar 1 item." : `Faltam marcar ${faltam} itens.`;
}

export function opcaoDaResposta(p: { tipo: TipoDePergunta }, valor: string | undefined): Opcao | null {
  if (p.tipo === "ABERTA" || !valor) return null;
  return OPCOES[p.tipo].find((o) => o.valor === valor) ?? null;
}

/** Um item que pede atenção: ficou abaixo do esperado. */
export function pedeAtencao(p: { tipo: TipoDePergunta }, valor: string | undefined): boolean {
  const o = opcaoDaResposta(p, valor);
  return o?.nivel != null && o.nivel < ESPERADO;
}

// ---------------------------------------------------------- para a avaliação

export type NotaDaAutoavaliacao = {
  nome: string;
  tipo: "TECNICA" | "COMPORTAMENTAL";
  esperado: number;
  pessoa: number | null;
  comentario: string | null;
};

/** O nome que o item ganha na avaliação: a tarefa e a conduta dizem o que são. */
export function nomeNaAvaliacao(p: { tipo: TipoDePergunta; texto: string }): string {
  if (p.tipo === "TAREFA") return `Tarefa: ${p.texto}`;
  if (p.tipo === "CONDUTA") return `Conduta: ${p.texto}`;
  return p.texto;
}

/**
 * Cada marcação vira um item da avaliação, com a nota da pessoa já posta. O
 * que ela respondeu fica no comentário, para o RH ler a resposta original.
 */
export function notasDaAutoavaliacao(perguntas: PerguntaEnviada[], respostas: Respostas): NotaDaAutoavaliacao[] {
  return perguntas
    .filter((p) => p.tipo !== "ABERTA")
    .map((p) => {
      const o = opcaoDaResposta(p, respostas[p.id]);
      return {
        nome: nomeNaAvaliacao(p),
        tipo: p.tipo === "TECNICA" || p.tipo === "TAREFA" ? ("TECNICA" as const) : ("COMPORTAMENTAL" as const),
        esperado: ESPERADO,
        pessoa: o?.nivel ?? null,
        comentario: o ? `Na autoavaliação: ${o.rotulo.toLowerCase()}.` : null,
      };
    });
}

/** As respostas abertas juntadas nos campos da conversa da avaliação. */
export function camposAbertos(perguntas: PerguntaEnviada[], respostas: Respostas): Record<Destino, string | null> {
  const campos: Record<Destino, string[]> = { pontosFortes: [], querDesenvolver: [], apoio: [], carreira: [] };
  for (const p of perguntas) {
    if (p.tipo !== "ABERTA") continue;
    const r = respostas[p.id]?.trim();
    if (!r) continue;
    campos[p.destino ?? "querDesenvolver"].push(`${p.texto}\n${r}`);
  }
  return {
    pontosFortes: campos.pontosFortes.join("\n\n") || null,
    querDesenvolver: campos.querDesenvolver.join("\n\n") || null,
    apoio: campos.apoio.join("\n\n") || null,
    carreira: campos.carreira.join("\n\n") || null,
  };
}

export type ResumoDaAutoavaliacao = { itens: number; respondidos: number; atencao: number };

export function resumoDaAutoavaliacao(perguntas: PerguntaEnviada[], respostas: Respostas): ResumoDaAutoavaliacao {
  const marcar = perguntas.filter((p) => p.tipo !== "ABERTA");
  return {
    itens: marcar.length,
    respondidos: marcar.filter((p) => respostas[p.id]).length,
    atencao: marcar.filter((p) => pedeAtencao(p, respostas[p.id])).length,
  };
}

// --------------------------------------------------------------- 3 meses

/** O PDI que nasce da autoavaliação dura 3 meses, com uma conversa por mês. */
export const MESES_DO_PDI = 3;

function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** O fim do plano e as conversas de 30, 60 e 90 dias, a partir do início. */
export function calendarioDoPdi(inicio: string): { fim: string; conversas: string[] } {
  return { fim: somarDias(inicio, 90), conversas: [somarDias(inicio, 30), somarDias(inicio, 60), somarDias(inicio, 90)] };
}
