/**
 * Regras dos roteiros de vídeo curto, no método de Ray Edwards.
 *
 * Sem banco e sem React — é o que os testes cobrem. Duas decisões moram aqui,
 * e não no prompt, porque são determinísticas e caras de errar: qual
 * framework usar, e se falta informação para escrever.
 */

export type Objetivo =
  | "VENDA"
  | "LEAD"
  | "ENGAJAMENTO"
  | "EDUCAR"
  | "ENTRETER";

export type Framework = "PASTOR" | "HVC";

export const OBJETIVOS: {
  valor: Objetivo;
  label: string;
  /** Objetivo com oferta pede PASTOR e exige oferta e CTA. */
  temOferta: boolean;
}[] = [
  { valor: "VENDA", label: "Venda direta", temOferta: true },
  { valor: "LEAD", label: "Captura de lead", temOferta: true },
  { valor: "ENGAJAMENTO", label: "Engajamento / crescimento", temOferta: false },
  { valor: "EDUCAR", label: "Educar", temOferta: false },
  { valor: "ENTRETER", label: "Entreter", temOferta: false },
];

/**
 * O que não muda mais de vídeo para vídeo.
 *
 * Os roteiros aqui são sempre de venda, sempre para empresário, sempre de 30
 * segundos. Perguntar isso de novo a cada roteiro só atrasa quem escreve —
 * e o método continua inteiro: PASTOR pede oferta e CTA, e esses dois
 * continuam sendo perguntados.
 */
export const OBJETIVO_PADRAO: Objetivo = "VENDA";
export const PUBLICO_PADRAO = "Empresários e donos de empresa";
export const DURACAO_PADRAO = 30;

export function rotuloDoObjetivo(valor: string): string {
  return OBJETIVOS.find((o) => o.valor === valor)?.label ?? valor;
}

/**
 * PASTOR quando há oferta; HVC leve quando é conteúdo puro.
 *
 * A escolha sai do objetivo, e não de uma pergunta a mais: vídeo que pede
 * ação de compra precisa da estrutura de persuasão completa; vídeo de
 * conteúdo fica mais leve sem o fechamento de venda.
 */
export function escolherFramework(objetivo: Objetivo): Framework {
  return OBJETIVOS.find((o) => o.valor === objetivo)?.temOferta
    ? "PASTOR"
    : "HVC";
}

/** Os blocos que cada framework tem, na ordem em que são falados. */
export const BLOCOS: Record<Framework, string[]> = {
  PASTOR: [
    "GANCHO",
    "PROBLEMA/DOR",
    "AMPLIFICAÇÃO",
    "HISTÓRIA/SOLUÇÃO",
    "TRANSFORMAÇÃO/PROVA",
    "OFERTA",
    "CTA",
  ],
  HVC: ["GANCHO", "VALOR", "CONVITE"],
};

export const MODELOS_DE_GANCHO = [
  "Como Fazer — “Como [resultado] sem [obstáculo]”",
  "Transacional — “Faça [ação simples] e ganhe [resultado grande]”",
  "Razão-Porquê — “X razões pelas quais [crença] está errada”",
  "Pergunta de Sondagem — pergunta que nomeia a dor exata",
  "Se-Então — “Se você consegue [ação fácil], consegue [resultado]”",
];

/**
 * Quantas palavras cabem na duração, a ~150 palavras faladas por minuto.
 *
 * A tabela do método é dada em faixas fechadas até 90 segundos; acima disso a
 * conta proporcional serve, porque formato longo não tem o mesmo aperto.
 */
export function faixaDePalavras(segundos: number): { min: number; max: number } {
  const tabela: Record<number, [number, number]> = {
    15: [35, 40],
    30: [70, 80],
    60: [150, 160],
    90: [220, 240],
  };

  if (tabela[segundos]) {
    const [min, max] = tabela[segundos];
    return { min, max };
  }

  const centro = Math.round((segundos / 60) * 150);
  return { min: Math.round(centro * 0.9), max: Math.round(centro * 1.1) };
}

/** Palavras de fato faladas: rótulo de bloco não conta. */
export function contarPalavras(texto: string): number {
  const limpo = texto
    .replace(/^[A-ZÀ-Ú/ ]{3,}:/gm, " ")
    .replace(/[^\p{L}\p{N}\s'’-]/gu, " ");

  return limpo.split(/\s+/).filter((p) => /[\p{L}\p{N}]/u.test(p)).length;
}

export type Ajuste = "CURTO" | "OK" | "LONGO";

/** O roteiro cabe na duração pedida? */
export function conferirTamanho(
  palavras: number,
  segundos: number,
): { ajuste: Ajuste; min: number; max: number } {
  const { min, max } = faixaDePalavras(segundos);
  if (palavras < min) return { ajuste: "CURTO", min, max };
  if (palavras > max) return { ajuste: "LONGO", min, max };
  return { ajuste: "OK", min, max };
}

/** Quantos segundos aquele texto leva, a 150 palavras por minuto. */
export function segundosFalados(palavras: number): number {
  return Math.round((palavras / 150) * 60);
}

export type Inputs = {
  tema?: string;
  publico?: string;
  objetivo?: string;
  oferta?: string;
  cta?: string;
};

/**
 * O que falta antes de escrever.
 *
 * O método manda perguntar em vez de inventar: público, objetivo e — quando
 * há oferta — o que é e qual o CTA. Sem isso, o roteiro sai com promessa
 * inventada, que é o erro mais caro.
 */
export function faltando(inputs: Inputs): string[] {
  const perguntas: string[] = [];

  if (!inputs.tema?.trim()) {
    perguntas.push("Sobre o que é o vídeo? (tema, produto ou serviço)");
  }
  if (!inputs.publico?.trim()) {
    perguntas.push("Para quem é o vídeo? (o avatar, na linguagem dele)");
  }

  const objetivo = OBJETIVOS.find((o) => o.valor === inputs.objetivo);
  if (!objetivo) {
    perguntas.push(
      "Qual o objetivo do vídeo? (vender, capturar lead, engajar, educar, entreter)",
    );
    return perguntas;
  }

  if (objetivo.temOferta) {
    if (!inputs.oferta?.trim()) {
      perguntas.push(
        "Qual é a oferta? (o que é, e o que está incluído — sem inventar preço ou garantia)",
      );
    }
    if (!inputs.cta?.trim()) {
      perguntas.push("Qual a ação única que a pessoa deve fazer no final?");
    }
  }

  return perguntas;
}

/** Junta os blocos num texto contínuo, como será falado. */
export function textoFalado(blocos: { rotulo: string; texto: string }[]): string {
  return blocos
    .map((b) => b.texto.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Ângulos possíveis para o mesmo tema.
 *
 * Cinco roteiros do mesmo assunto só valem a pena se atacarem por lados
 * diferentes — senão são cinco versões do mesmo vídeo. A lista força essa
 * variedade, e o nome do ângulo fica visível no roteiro, para se saber o que
 * já foi tentado.
 */
export const ANGULOS = [
  "Risco e consequência — o que se perde por não agir (multa, processo, custo)",
  "Erro comum — o que quase todo mundo faz errado sem perceber",
  "Mito × verdade — uma crença do setor que não se sustenta",
  "Caso real — uma história curta, sem citar nome de cliente",
  "Número que para o feed — um dado concreto e verificável",
  "Pergunta que expõe a dor — o espectador se reconhece na pergunta",
  "Bastidor — como a coisa funciona por dentro, o que ninguém mostra",
  "Contra-intuitivo — o oposto do conselho que todo mundo dá",
];

/** Quantos roteiros por geração. Cinco é o padrão pedido. */
export const QUANTIDADES = [3, 5, 8];

/**
 * O roteiro em texto completo, com os rótulos dos blocos.
 * É o formato de conferência: dá para ver a estrutura enquanto se lê.
 */
export function textoCompleto(
  blocos: { rotulo: string; texto: string }[],
): string {
  return blocos
    .filter((b) => b.texto.trim())
    .map((b) => `${b.rotulo}: ${b.texto.trim()}`)
    .join("\n\n");
}

/**
 * Os ângulos que fazem sentido oferecer.
 *
 * Sem prova social informada, o ângulo do número sai da lista. Não adianta
 * pedir à IA para "não inventar dado" e ao mesmo tempo oferecer um ângulo cujo
 * gancho é um dado: na prática ela inventa. Foi o que aconteceu num teste —
 * saiu "afastamento por saúde mental subiu 38%", com fonte atribuída.
 */
export function angulosDisponiveis(temProvaSocial: boolean): string[] {
  if (temProvaSocial) return ANGULOS;
  return ANGULOS.filter((a) => !a.startsWith("Número que para o feed"));
}

/**
 * Trechos que parecem dado inventado: porcentagem, "X vezes", número grande,
 * ou fonte atribuída. Serve de aviso na tela quando não houve prova informada.
 *
 * É heurística, e erra para o lado de avisar demais — conferir um número a
 * mais custa menos do que publicar um número errado.
 */
export function numerosSuspeitos(texto: string): string[] {
  const achados = new Set<string>();

  const padroes = [
    /\d+\s?%/g,
    /\d+\s?(mil|milh(ão|ões)|bilh(ão|ões))/gi,
    /R\$\s?[\d.,]+/g,
    /\d+\s?vezes\s+(mais|menos)/gi,
    /segundo\s+(o|a|os|as)\s+[A-ZÀ-Ú][\p{L}\s]{2,40}/gu,
    /(dados|pesquisa|estudo|levantamento)\s+d[oae]s?\s+[A-ZÀ-Ú][\p{L}\s]{2,40}/gu,
  ];

  for (const p of padroes) {
    for (const m of texto.matchAll(p)) achados.add(m[0].trim());
  }

  return [...achados];
}

// ------------------------------------------------------ linguagem simples

/**
 * Palavras que afastam quem está do outro lado, e o que dizer no lugar.
 *
 * Vídeo curto não tem espaço para o espectador traduzir jargão: ele rola o
 * feed. A lista cobre o jargão de consultoria, de RH e o juridiquês que mais
 * aparecem — e é para crescer conforme o uso mostrar outros.
 */
export const TERMOS_DIFICEIS: Record<string, string> = {
  // Consultoria e corporativo
  assertividade: "acerto",
  expertise: "experiência",
  otimizar: "melhorar",
  alavancar: "aumentar",
  mindset: "jeito de pensar",
  disruptivo: "diferente",
  sinergia: "trabalho junto",
  holístico: "completo",
  proatividade: "iniciativa",
  stakeholder: "quem é afetado",
  compliance: "estar em dia com as regras",
  benchmarking: "comparação com o mercado",
  "know-how": "conhecimento",
  insight: "descoberta",
  entregável: "resultado",
  mensurar: "medir",
  escalabilidade: "capacidade de crescer",
  performance: "desempenho",
  metodologia: "jeito de fazer",
  framework: "estrutura",
  "solução integrada": "solução completa",
  robusto: "sólido",
  // RH
  turnover: "rotatividade",
  headcount: "número de funcionários",
  onboarding: "integração de quem entra",
  "employer branding": "reputação como empregador",
  "gestão de pessoas": "cuidar da equipe",
  // Jurídico
  reclamatória: "processo na justiça",
  autuação: "multa",
  "passivo trabalhista": "conta a pagar na justiça",
  "dano moral presumido": "culpa dada como certa",
  "ação civil pública": "processo movido pelo Ministério Público",
  normativo: "regra",
  "dispositivo legal": "artigo da lei",
  conformidade: "estar em dia",
  aderência: "seguir a regra",
  // Técnico da própria norma
  psicossocial: "o que estressa e adoece no trabalho",
  "inventário de riscos": "lista dos riscos",
  "gerenciamento de riscos": "cuidado com os riscos",
};

export type TermoDificil = { termo: string; sugestao: string };

/** Os termos difíceis que aparecem no texto, com o que dizer no lugar. */
export function palavrasDificeis(texto: string): TermoDificil[] {
  const alvo = texto.toLowerCase();
  const achados: TermoDificil[] = [];

  for (const [termo, sugestao] of Object.entries(TERMOS_DIFICEIS)) {
    // Palavra inteira, para um termo curto não casar dentro de outra palavra.
    const escapado = termo.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
    const cerca = String.raw`[^\p{L}]`;
    if (new RegExp(`(^|${cerca})${escapado}(${cerca}|$)`, "u").test(alvo)) {
      achados.push({ termo, sugestao });
    }
  }

  return achados;
}

/**
 * Média de palavras por frase.
 *
 * Frase falada longa perde o ouvinte. Acima de vinte palavras já é sinal de
 * que a frase precisa virar duas.
 */
export function mediaPalavrasPorFrase(texto: string): number {
  const frases = texto
    .split(/[.!?]+/)
    .map((f) => f.trim())
    .filter((f) => contarPalavras(f) > 0);

  if (frases.length === 0) return 0;

  const total = frases.reduce((s, f) => s + contarPalavras(f), 0);
  return Math.round((total / frases.length) * 10) / 10;
}

export const LIMITE_PALAVRAS_POR_FRASE = 20;

/** A linguagem está simples o bastante para vídeo curto? */
export function linguagemSimples(texto: string): {
  simples: boolean;
  media: number;
  dificeis: TermoDificil[];
} {
  const media = mediaPalavrasPorFrase(texto);
  const dificeis = palavrasDificeis(texto);
  return {
    simples: media <= LIMITE_PALAVRAS_POR_FRASE && dificeis.length === 0,
    media,
    dificeis,
  };
}
