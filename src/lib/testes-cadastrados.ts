/**
 * Os testes cadastrados pela consultoria: um questionário com a chave de cada
 * alternativa, aplicado por link e apurado sozinho.
 *
 * Serve aos instrumentos que a consultoria tem o direito de aplicar e que não
 * são do sistema — um tipológico, por exemplo. O sistema não traz questão
 * nenhuma: a estrutura é colada ou digitada na tela, num formato simples:
 *
 *   FATORES
 *   E = Extroversão | energia voltada para fora
 *   PARES
 *   E/I
 *   QUESTÕES
 *   1. Enunciado
 *   a) Alternativa [E]
 *
 * Também aceita a tabela colada de uma planilha: pergunta, alternativa e fator
 * em três colunas.
 *
 * Duas formas de responder: ESCOLHA (uma alternativa por questão, que soma 1 no
 * fator dela) e NOTAS (numerar as alternativas de 1 a quantas houver, sem
 * empate, como o DISC). Cada par de fatores dá uma letra do tipo: o fator que
 * somou mais.
 *
 * Puro: a tela de cadastro, o link do candidato, a ficha e os testes leem daqui.
 */

export type ModoDoTeste = "ESCOLHA" | "NOTAS";

export const MODOS_DO_TESTE: { valor: ModoDoTeste; rotulo: string; explicacao: string }[] = [
  {
    valor: "ESCOLHA",
    rotulo: "Escolher uma alternativa",
    explicacao: "Em cada questão a pessoa marca uma alternativa, que soma 1 no fator dela.",
  },
  {
    valor: "NOTAS",
    rotulo: "Numerar as alternativas",
    explicacao:
      "Em cada questão a pessoa numera as alternativas, de 1 a quantas houver, sem empate; cada nota soma no fator da alternativa.",
  },
];

export type FatorDoTeste = { codigo: string; nome: string; descricao: string };
export type AlternativaCadastrada = { texto: string; fator: string };
export type QuestaoCadastrada = { enunciado: string; opcoes: AlternativaCadastrada[] };
export type EstruturaDoTeste = { fatores: FatorDoTeste[]; pares: [string, string][]; questoes: QuestaoCadastrada[] };
export type TesteCadastrado = EstruturaDoTeste & { nome: string; instrucoes: string; modo: ModoDoTeste };

export const LIMITES_DO_TESTE = { questoes: 300, alternativas: 8, fatores: 20 } as const;

const CODIGO = "[A-Za-z0-9]{1,6}";
const LETRAS = "abcdefgh";

export const MODELO_DE_ESTRUTURA = [
  "FATORES",
  "A = Nome do fator A | o que ele descreve (opcional)",
  "B = Nome do fator B",
  "",
  "PARES",
  "A/B",
  "",
  "QUESTÕES",
  "1. Enunciado da primeira questão",
  "a) Primeira alternativa [A]",
  "b) Segunda alternativa [B]",
  "",
  "2. Enunciado da segunda questão",
  "a) Primeira alternativa [B]",
  "b) Segunda alternativa [A]",
].join("\n");

function semAcento(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

function cortar(s: string, max = 50): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function secaoDaLinha(linha: string): "FATORES" | "PARES" | "QUESTOES" | null {
  const t = semAcento(linha).toUpperCase().replace(/[:\s]+$/, "").trim();
  if (t === "FATORES" || t === "DIMENSOES") return "FATORES";
  if (t === "PARES" || t === "PARES DO TIPO") return "PARES";
  if (t === "QUESTOES" || t === "PERGUNTAS" || t === "ITENS") return "QUESTOES";
  return null;
}

/**
 * Lê a estrutura colada na tela. Devolve o que entendeu e a lista do que não
 * entendeu ou não confere — com a linha, para achar e corrigir.
 */
export function lerEstrutura(texto: string): { estrutura: EstruturaDoTeste; erros: string[] } {
  const linhas = texto.replace(/\r\n?/g, "\n").split("\n");
  const erros: string[] = [];
  const declarados: FatorDoTeste[] = [];
  const pares: [string, string][] = [];
  const questoes: QuestaoCadastrada[] = [];
  const temSecoes = linhas.some((l) => secaoDaLinha(l));

  if (!temSecoes && linhas.some((l) => l.split("\t").length >= 3)) {
    // Tabela colada de planilha: pergunta, alternativa, fator. Pergunta vazia é a mesma de cima.
    let atual: QuestaoCadastrada | null = null;
    linhas.forEach((l, i) => {
      if (!l.trim()) return;
      const [pergunta = "", alternativa = "", fator = ""] = l.split("\t").map((c) => c.trim());
      if (pergunta && (!atual || atual.enunciado !== pergunta)) {
        atual = { enunciado: pergunta, opcoes: [] };
        questoes.push(atual);
      }
      if (!atual) return void erros.push(`Linha ${i + 1}: alternativa sem pergunta.`);
      if (!alternativa) return;
      if (!new RegExp(`^${CODIGO}$`).test(fator)) {
        return void erros.push(`Linha ${i + 1}: a alternativa "${cortar(alternativa)}" está sem a chave (o fator).`);
      }
      atual.opcoes.push({ texto: alternativa, fator: fator.toUpperCase() });
    });
  } else {
    let secao: "FATORES" | "PARES" | "QUESTOES" | null = temSecoes ? null : "QUESTOES";
    let atual: QuestaoCadastrada | null = null;

    linhas.forEach((bruta, i) => {
      const l = bruta.trim();
      if (!l) return;
      const nova = secaoDaLinha(l);
      if (nova) {
        secao = nova;
        return;
      }

      if (secao === null) {
        erros.push(`Linha ${i + 1}: escreva FATORES, PARES ou QUESTÕES antes de "${cortar(l)}".`);
      } else if (secao === "FATORES") {
        const m = l.match(new RegExp(`^(${CODIGO})\\s*[=:–-]\\s*(.+)$`));
        if (!m) return void erros.push(`Linha ${i + 1}: escreva o fator como "E = Extroversão".`);
        const [nome, ...descricao] = m[2].split("|");
        declarados.push({ codigo: m[1].toUpperCase(), nome: nome.trim(), descricao: descricao.join("|").trim() });
      } else if (secao === "PARES") {
        const achados = [...l.matchAll(new RegExp(`(${CODIGO})\\s*\\/\\s*(${CODIGO})`, "g"))];
        if (achados.length === 0) return void erros.push(`Linha ${i + 1}: escreva o par como "E/I".`);
        for (const a of achados) pares.push([a[1].toUpperCase(), a[2].toUpperCase()]);
      } else {
        const questao = l.match(/^(\d{1,3})\s*[.)–-]\s*(.+)$/);
        if (questao) {
          atual = { enunciado: questao[2].trim(), opcoes: [] };
          questoes.push(atual);
          return;
        }
        const alternativa = l.match(new RegExp(`^(?:[a-zA-Z]\\s*[).–-]\\s*)?(.+?)\\s*[\\[(]\\s*(${CODIGO})\\s*[\\])]\\s*$`));
        if (alternativa) {
          if (!atual) return void erros.push(`Linha ${i + 1}: alternativa antes da primeira questão.`);
          atual.opcoes.push({ texto: alternativa[1].trim(), fator: alternativa[2].toUpperCase() });
          return;
        }
        const semChave = l.match(/^[a-zA-Z]\s*[).–-]\s*(.+)$/);
        if (semChave && atual) {
          return void erros.push(
            `Questão ${questoes.length}: a alternativa "${cortar(semChave[1])}" está sem a chave — escreva o fator entre colchetes no fim, como [E].`,
          );
        }
        // Enunciado de mais de uma linha: continua a questão enquanto não vieram alternativas.
        if (atual && atual.opcoes.length === 0) {
          atual.enunciado = `${atual.enunciado}\n${l}`;
          return;
        }
        erros.push(`Linha ${i + 1}: não entendi "${cortar(l)}".`);
      }
    });
  }

  // Sem FATORES, os fatores são as chaves que apareceram, na ordem.
  const fatores: FatorDoTeste[] =
    declarados.length > 0
      ? declarados
      : [...new Set(questoes.flatMap((q) => q.opcoes.map((o) => o.fator)))].map((codigo) => ({ codigo, nome: codigo, descricao: "" }));

  const estrutura = { fatores, pares, questoes };
  return { estrutura, erros: [...erros, ...conferirEstrutura(estrutura)] };
}

/** O que não confere na estrutura, já lida. */
export function conferirEstrutura(e: EstruturaDoTeste): string[] {
  const erros: string[] = [];
  const codigos = e.fatores.map((f) => f.codigo);
  const conhecidos = new Set(codigos);

  if (e.questoes.length === 0) erros.push("Nenhuma questão encontrada.");
  if (e.questoes.length > LIMITES_DO_TESTE.questoes) erros.push(`São no máximo ${LIMITES_DO_TESTE.questoes} questões.`);
  if (e.fatores.length > LIMITES_DO_TESTE.fatores) erros.push(`São no máximo ${LIMITES_DO_TESTE.fatores} fatores.`);
  if (conhecidos.size !== codigos.length) erros.push("Há fator repetido em FATORES.");

  e.questoes.forEach((q, i) => {
    if (q.opcoes.length < 2) erros.push(`Questão ${i + 1} tem menos de duas alternativas.`);
    if (q.opcoes.length > LIMITES_DO_TESTE.alternativas) {
      erros.push(`Questão ${i + 1} tem mais de ${LIMITES_DO_TESTE.alternativas} alternativas.`);
    }
    for (const o of q.opcoes) {
      if (!conhecidos.has(o.fator)) erros.push(`Questão ${i + 1}: a chave [${o.fator}] não está em FATORES.`);
    }
  });

  for (const [a, b] of e.pares) {
    if (!conhecidos.has(a) || !conhecidos.has(b)) erros.push(`O par ${a}/${b} usa fator que não está em FATORES.`);
    if (a === b) erros.push(`O par ${a}/${b} repete o mesmo fator.`);
  }
  return erros;
}

/** A estrutura escrita de volta no formato da tela, para editar. */
export function escreverEstrutura(e: EstruturaDoTeste): string {
  return [
    "FATORES",
    ...e.fatores.map((f) => `${f.codigo} = ${f.nome}${f.descricao ? ` | ${f.descricao}` : ""}`),
    "",
    ...(e.pares.length ? ["PARES", e.pares.map(([a, b]) => `${a}/${b}`).join(", "), ""] : []),
    "QUESTÕES",
    ...e.questoes.flatMap((q, i) => [
      `${i + 1}. ${q.enunciado}`,
      ...q.opcoes.map((o, j) => `${LETRAS[j] ?? "-"}) ${o.texto} [${o.fator}]`),
      "",
    ]),
  ]
    .join("\n")
    .trim();
}

function textoDe(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** O teste gravado (no cadastro ou na cópia do candidato), ou null quando não tem o formato esperado. */
export function lerTesteCadastrado(valor: unknown): TesteCadastrado | null {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return null;
  const v = valor as Record<string, unknown>;

  const fatores = (Array.isArray(v.fatores) ? v.fatores : [])
    .map((f) => (f && typeof f === "object" ? (f as Record<string, unknown>) : {}))
    .map((f) => ({ codigo: textoDe(f.codigo).toUpperCase(), nome: textoDe(f.nome), descricao: textoDe(f.descricao) }))
    .filter((f) => f.codigo);
  const pares = (Array.isArray(v.pares) ? v.pares : [])
    .filter((p): p is unknown[] => Array.isArray(p) && p.length === 2)
    .map((p) => [String(p[0]).toUpperCase(), String(p[1]).toUpperCase()] as [string, string]);
  const questoes = (Array.isArray(v.questoes) ? v.questoes : [])
    .map((q) => (q && typeof q === "object" ? (q as Record<string, unknown>) : {}))
    .map((q) => ({
      enunciado: textoDe(q.enunciado),
      opcoes: (Array.isArray(q.opcoes) ? q.opcoes : [])
        .map((o) => (o && typeof o === "object" ? (o as Record<string, unknown>) : {}))
        .map((o) => ({ texto: textoDe(o.texto), fator: textoDe(o.fator).toUpperCase() }))
        .filter((o) => o.texto && o.fator),
    }))
    .filter((q) => q.enunciado && q.opcoes.length >= 2);

  if (fatores.length === 0 || questoes.length === 0) return null;
  return {
    nome: textoDe(v.nome) || "Teste",
    instrucoes: textoDe(v.instrucoes),
    modo: v.modo === "NOTAS" ? "NOTAS" : "ESCOLHA",
    fatores,
    pares,
    questoes,
  };
}

/** As questões como o candidato vê: sem a chave. */
export function semChave(t: TesteCadastrado): { enunciado: string; alternativas: string[] }[] {
  return t.questoes.map((q) => ({ enunciado: q.enunciado, alternativas: q.opcoes.map((o) => o.texto) }));
}

/** A escolha (índice) ou as notas de cada alternativa, na ordem. */
export type RespostaCadastrada = number | number[];

/** Lê o formulário: `q-0` com o índice escolhido, ou `q-0-0`, `q-0-1`… com as notas. */
export function lerRespostasCadastradas(formData: FormData, t: TesteCadastrado): (RespostaCadastrada | null)[] {
  return t.questoes.map((q, i) => {
    if (t.modo === "ESCOLHA") {
      const v = formData.get(`q-${i}`);
      return v === null || v === "" ? null : Number(v);
    }
    const notas = q.opcoes.map((_, o) => formData.get(`q-${i}-${o}`));
    return notas.some((n) => n === null || n === "") ? null : notas.map((n) => Number(n));
  });
}

/** Mensagem de erro, ou null quando todas as questões foram respondidas direito. */
export function conferirRespostasCadastradas(respostas: (RespostaCadastrada | null)[], t: TesteCadastrado): string | null {
  if (respostas.length !== t.questoes.length) return "Responda todas as questões.";
  for (let i = 0; i < t.questoes.length; i++) {
    const r = respostas[i];
    const k = t.questoes[i].opcoes.length;
    if (t.modo === "ESCOLHA") {
      if (typeof r !== "number" || !Number.isInteger(r) || r < 0 || r >= k) return `Falta responder a questão ${i + 1}.`;
    } else {
      if (!Array.isArray(r) || r.length !== k || r.some((n) => !Number.isInteger(n))) {
        return `Falta numerar as alternativas da questão ${i + 1}.`;
      }
      if (r.some((n) => n < 1 || n > k)) return `Na questão ${i + 1}, use os números de 1 a ${k}.`;
      if (new Set(r).size !== k) return `Na questão ${i + 1}, cada número vale uma vez só.`;
    }
  }
  return null;
}

export type ResultadoCadastrado = {
  nome: string;
  modo: ModoDoTeste;
  fatores: FatorDoTeste[];
  pares: [string, string][];
  /** O que cada fator somou. */
  pontos: Record<string, number>;
  /** De 0 a 100, dentro do que cada fator podia somar: é o que se compara entre fatores. */
  percentuais: Record<string, number>;
  /** Os códigos, do fator mais forte para o mais fraco. */
  ordem: string[];
  /** Uma letra por par: "ESTJ". Null quando o teste não tem pares. */
  tipo: string | null;
};

/** A apuração a partir das respostas já conferidas. */
export function apurar(t: TesteCadastrado, respostas: RespostaCadastrada[]): ResultadoCadastrado {
  const zerado = () => Object.fromEntries(t.fatores.map((f) => [f.codigo, 0])) as Record<string, number>;
  const pontos = zerado();
  const minimo = zerado();
  const maximo = zerado();
  const somar = (alvo: Record<string, number>, fator: string, n: number) => {
    alvo[fator] = (alvo[fator] ?? 0) + n;
  };

  t.questoes.forEach((q, i) => {
    const r = respostas[i];
    if (t.modo === "ESCOLHA") {
      for (const f of new Set(q.opcoes.map((o) => o.fator))) somar(maximo, f, 1);
      const escolhida = typeof r === "number" ? q.opcoes[r] : undefined;
      if (escolhida) somar(pontos, escolhida.fator, 1);
    } else {
      const k = q.opcoes.length;
      q.opcoes.forEach((o, j) => {
        somar(minimo, o.fator, 1);
        somar(maximo, o.fator, k);
        somar(pontos, o.fator, Array.isArray(r) ? (r[j] ?? 0) : 0);
      });
    }
  });

  const percentuais = Object.fromEntries(
    t.fatores.map((f) => {
      const faixa = maximo[f.codigo] - minimo[f.codigo];
      return [f.codigo, faixa > 0 ? Math.round(((pontos[f.codigo] - minimo[f.codigo]) / faixa) * 100) : 0];
    }),
  ) as Record<string, number>;

  // Empate fica na ordem em que os fatores foram cadastrados.
  const ordem = t.fatores
    .map((f) => f.codigo)
    .sort((a, b) => percentuais[b] - percentuais[a] || pontos[b] - pontos[a]);

  const tipo = t.pares.length
    ? t.pares
        .map(([a, b]) =>
          percentuais[b] > percentuais[a] || (percentuais[b] === percentuais[a] && pontos[b] > pontos[a]) ? b : a,
        )
        .join("")
    : null;

  return { nome: t.nome, modo: t.modo, fatores: t.fatores, pares: t.pares, pontos, percentuais, ordem, tipo };
}

/** O resultado gravado, ou null quando o Json não tem o formato esperado. */
export function lerResultadoCadastrado(valor: unknown): ResultadoCadastrado | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as Partial<ResultadoCadastrado>;
  if (typeof v.nome !== "string" || !Array.isArray(v.fatores) || !Array.isArray(v.ordem) || !v.percentuais || !v.pontos) {
    return null;
  }
  return {
    nome: v.nome,
    modo: v.modo === "NOTAS" ? "NOTAS" : "ESCOLHA",
    fatores: v.fatores,
    pares: Array.isArray(v.pares) ? v.pares : [],
    pontos: v.pontos,
    percentuais: v.percentuais,
    ordem: v.ordem,
    tipo: typeof v.tipo === "string" ? v.tipo : null,
  };
}
