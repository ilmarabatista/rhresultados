/**
 * Pesquisa de clima: as regras que não dependem do banco.
 *
 * A pesquisa é anônima. Quem responde escolhe um perfil (cargo, unidade, tempo
 * de casa, gênero) e dá notas de 1 a 10 às perguntas, agrupadas em dimensões.
 * A pergunta do eNPS ("recomendaria a empresa") vai de 0 a 10 e fica fora da
 * média da dimensão: ela vira um indicador próprio.
 *
 * Toda pergunta de nota é escrita para que nota alta seja bom. Por isso a conta
 * é sempre a mesma, sem inverter nada.
 *
 * Nenhum recorte por perfil mostra grupo com menos de MIN_GRUPO respostas: com
 * duas pessoas num grupo, cada uma sabe o que a outra respondeu.
 *
 * Puro: a tela da empresa, o link público, o relatório e os testes leem daqui.
 */

import { semAcento } from "./text";

export const MIN_GRUPO = 3;
export const REGUA_PADRAO = 6;

export const TIPOS = ["NOTA", "ESCOLHA", "MULTIPLA", "TEXTO"] as const;
export type TipoDePergunta = (typeof TIPOS)[number];

export const NOME_DO_TIPO: Record<TipoDePergunta, string> = {
  NOTA: "Nota de 1 a 10",
  ESCOLHA: "Escolha uma opção",
  MULTIPLA: "Escolha várias opções",
  TEXTO: "Texto livre",
};

export const STATUS_DA_PESQUISA = ["RASCUNHO", "ABERTA", "ENCERRADA", "HISTORICO"] as const;
export type StatusDaPesquisa = (typeof STATUS_DA_PESQUISA)[number];

export const NOME_DO_STATUS: Record<StatusDaPesquisa, string> = {
  RASCUNHO: "Rascunho",
  ABERTA: "Aberta",
  ENCERRADA: "Encerrada",
  HISTORICO: "Histórico",
};

export const STATUS_DA_ACAO = ["PENDENTE", "ANDAMENTO", "CONCLUIDA"] as const;
export type StatusDaAcao = (typeof STATUS_DA_ACAO)[number];

export const NOME_DO_STATUS_DA_ACAO: Record<StatusDaAcao, string> = {
  PENDENTE: "Pendente",
  ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
};

export function lerTipo(valor: unknown): TipoDePergunta {
  return (TIPOS as readonly string[]).includes(String(valor)) ? (valor as TipoDePergunta) : "NOTA";
}

export function lerStatus(valor: unknown): StatusDaPesquisa {
  return (STATUS_DA_PESQUISA as readonly string[]).includes(String(valor)) ? (valor as StatusDaPesquisa) : "RASCUNHO";
}

export function lerStatusDaAcao(valor: unknown): StatusDaAcao {
  return (STATUS_DA_ACAO as readonly string[]).includes(String(valor)) ? (valor as StatusDaAcao) : "PENDENTE";
}

/** As opções guardadas em JSON: só textos, sem vazios nem repetidos. */
export function lerOpcoes(valor: unknown): string[] {
  if (!Array.isArray(valor)) return [];
  const vistas = new Set<string>();
  const opcoes: string[] = [];
  for (const v of valor) {
    const t = typeof v === "string" ? v.trim() : "";
    if (!t || vistas.has(t)) continue;
    vistas.add(t);
    opcoes.push(t);
  }
  return opcoes;
}

/** Uma opção por linha, como a tela escreve. */
export function opcoesDoTexto(texto: string): string[] {
  return lerOpcoes(texto.split(/\r?\n/));
}

// ------------------------------------------------------------------ perfil

export type PerguntaDePerfil = { chave: string; rotulo: string; opcoes: string[] };

export const GENEROS = ["Feminino", "Masculino", "Outro", "Prefiro não informar"];

/**
 * O perfil de uma pesquisa nova: as unidades vêm das filiais cadastradas, e só
 * entram quando a empresa tem mais de uma.
 */
export function perfilPadrao(unidades: string[]): PerguntaDePerfil[] {
  const perfil: PerguntaDePerfil[] = [
    { chave: "cargo", rotulo: "Qual é o seu cargo?", opcoes: ["Cargo de gestão (supervisão, coordenação, gerência ou direção)", "Demais cargos"] },
  ];
  const lista = lerOpcoes(unidades);
  if (lista.length > 1) perfil.push({ chave: "unidade", rotulo: "Em qual unidade você trabalha?", opcoes: lista });
  perfil.push(
    { chave: "tempo", rotulo: "Há quanto tempo você trabalha na empresa?", opcoes: ["Menos de 1 ano", "De 1 a 5 anos", "Mais de 5 anos"] },
    { chave: "genero", rotulo: "Qual é o seu gênero?", opcoes: GENEROS },
  );
  return perfil;
}

export function lerPerfil(valor: unknown): PerguntaDePerfil[] {
  if (!Array.isArray(valor)) return [];
  const chaves = new Set<string>();
  const perfil: PerguntaDePerfil[] = [];
  for (const p of valor) {
    if (!p || typeof p !== "object") continue;
    const { chave, rotulo, opcoes } = p as Record<string, unknown>;
    const k = typeof chave === "string" ? chave.trim() : "";
    const r = typeof rotulo === "string" ? rotulo.trim() : "";
    const o = lerOpcoes(opcoes);
    if (!k || !r || o.length < 2 || chaves.has(k)) continue;
    chaves.add(k);
    perfil.push({ chave: k, rotulo: r, opcoes: o });
  }
  return perfil;
}

/** Uma chave curta e estável a partir do rótulo, para perfis criados na tela. */
export function chaveDoRotulo(rotulo: string, usadas: Iterable<string>): string {
  const base =
    semAcento(rotulo)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 24) || "perfil";
  const ja = new Set(usadas);
  let chave = base;
  for (let n = 2; ja.has(chave); n++) chave = `${base}-${n}`;
  return chave;
}

// --------------------------------------------------------------- perguntas

/** A pergunta como foi para a pesquisa (PerguntaDaPesquisa). */
export type PerguntaAplicada = {
  id: string;
  /** A pergunta da biblioteca de onde veio, para comparar ciclos. */
  origem: string | null;
  dimensao: string;
  dimensaoOrdem: number;
  enunciado: string;
  tipo: TipoDePergunta;
  opcoes: string[];
  maxEscolhas: number | null;
  enps: boolean;
  ordem: number;
};

export function ordenar<T extends { dimensaoOrdem: number; dimensao: string; ordem: number }>(perguntas: T[]): T[] {
  return [...perguntas].sort(
    (a, b) => a.dimensaoOrdem - b.dimensaoOrdem || a.dimensao.localeCompare(b.dimensao) || a.ordem - b.ordem,
  );
}

/** As perguntas agrupadas por dimensão, na ordem da pesquisa. */
export function porDimensao<T extends { dimensaoOrdem: number; dimensao: string; ordem: number }>(
  perguntas: T[],
): { dimensao: string; perguntas: T[] }[] {
  const grupos: { dimensao: string; perguntas: T[] }[] = [];
  for (const p of ordenar(perguntas)) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.dimensao === p.dimensao) ultimo.perguntas.push(p);
    else grupos.push({ dimensao: p.dimensao, perguntas: [p] });
  }
  return grupos;
}

export function escala(p: { tipo: TipoDePergunta; enps: boolean }): { min: number; max: number } | null {
  if (p.tipo !== "NOTA") return null;
  return p.enps ? { min: 0, max: 10 } : { min: 1, max: 10 };
}

/** Mesma dimensão em ciclos diferentes, mesmo com acento ou caixa diferente. */
export function chaveDaDimensao(nome: string): string {
  return semAcento(nome).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Mesma pergunta em ciclos diferentes: veio da mesma pergunta da biblioteca e
 * tem o mesmo texto. Texto mudou, é outra pergunta, e fica fora da comparação.
 */
export function chaveDaPergunta(p: { origem: string | null; enunciado: string }): string | null {
  if (!p.origem) return null;
  return `${p.origem}|${chaveDaDimensao(p.enunciado)}`;
}

// ---------------------------------------------------------------- respostas

export type ItemRespondido = { perguntaId: string; nota: number | null; escolhas: string[]; texto: string | null };
export type RespostaLida = { perfil: Record<string, string>; itens: ItemRespondido[] };

/**
 * Lê o formulário do link público. `ler` devolve os valores de um campo (o
 * FormData.getAll de quem chama), para este arquivo não depender do navegador.
 */
export function lerResposta(
  perguntas: PerguntaAplicada[],
  perfil: PerguntaDePerfil[],
  ler: (campo: string) => string[],
): RespostaLida {
  const doPerfil: Record<string, string> = {};
  for (const p of perfil) {
    const v = (ler(`perfil.${p.chave}`)[0] ?? "").trim();
    if (v) doPerfil[p.chave] = v;
  }

  const itens: ItemRespondido[] = perguntas.map((p) => {
    const valores = ler(`p.${p.id}`).map((v) => v.trim()).filter(Boolean);
    if (p.tipo === "NOTA") {
      const n = valores.length ? Number(valores[0]) : NaN;
      return { perguntaId: p.id, nota: Number.isInteger(n) ? n : null, escolhas: [], texto: null };
    }
    if (p.tipo === "TEXTO") {
      return { perguntaId: p.id, nota: null, escolhas: [], texto: (valores[0] ?? "").slice(0, 4000) || null };
    }
    return { perguntaId: p.id, nota: null, escolhas: [...new Set(valores)], texto: null };
  });

  return { perfil: doPerfil, itens };
}

/** Todas as perguntas são obrigatórias, como no formulário de origem. */
export function conferirResposta(
  perguntas: PerguntaAplicada[],
  perfil: PerguntaDePerfil[],
  resposta: RespostaLida,
): string | null {
  for (const p of perfil) {
    const v = resposta.perfil[p.chave];
    if (!v || !p.opcoes.includes(v)) return `Responda: ${p.rotulo}`;
  }

  const porId = new Map(resposta.itens.map((i) => [i.perguntaId, i]));
  for (const [n, p] of ordenar(perguntas).entries()) {
    const item = porId.get(p.id);
    const qual = `a pergunta ${n + 1}`;
    if (!item) return `Responda ${qual}.`;
    const faixa = escala(p);
    if (faixa) {
      if (item.nota === null || item.nota < faixa.min || item.nota > faixa.max) return `Dê uma nota para ${qual}.`;
    } else if (p.tipo === "TEXTO") {
      if (!item.texto) return `Escreva a sua resposta para ${qual}.`;
    } else {
      if (item.escolhas.length === 0) return `Escolha uma opção em ${qual}.`;
      if (item.escolhas.some((e) => !p.opcoes.includes(e))) return `Escolha uma das opções de ${qual}.`;
      const max = p.tipo === "ESCOLHA" ? 1 : p.maxEscolhas ?? p.opcoes.length;
      if (item.escolhas.length > max) return `Em ${qual}, escolha no máximo ${max}.`;
    }
  }
  return null;
}

// ------------------------------------------------------------------ apuração

export type RespostaGuardada = { perfil: Record<string, string>; itens: ItemRespondido[] };

export type ResultadoDaPergunta = {
  pergunta: PerguntaAplicada;
  respostas: number;
  /** Só nas perguntas de nota. */
  media: number | null;
  dentro: number;
  abaixo: number;
  /** Quantas vezes cada nota apareceu, da menor para a maior. */
  notas: number[];
  /** Nas de escolha: quantas vezes cada opção foi marcada, da mais marcada. */
  opcoes: { opcao: string; vezes: number }[];
  textos: string[];
};

export type ResultadoDaDimensao = {
  dimensao: string;
  ordem: number;
  /** A média das médias das perguntas de nota, como na tabulação de origem. */
  media: number | null;
  /** Notas na régua ou acima, e abaixo dela, somando todas as perguntas. */
  dentro: number;
  abaixo: number;
  perguntas: ResultadoDaPergunta[];
};

export type Enps = { valor: number; promotores: number; neutros: number; detratores: number; respostas: number };

export type Apuracao = {
  respostas: number;
  /** A média das dimensões que têm nota. */
  geral: number | null;
  dimensoes: ResultadoDaDimensao[];
  enps: Enps | null;
};

function media(valores: number[]): number | null {
  if (valores.length === 0) return null;
  return valores.reduce((a, b) => a + b, 0) / valores.length;
}

export function classificar(valor: number | null, regua: number): "DENTRO" | "ABAIXO" | null {
  if (valor === null) return null;
  // Arredonda antes de comparar: 5,96 aparece como 6,0 e não pode cair abaixo.
  return Math.round(valor * 10) / 10 >= regua ? "DENTRO" : "ABAIXO";
}

/**
 * eNPS: quem dá 9 ou 10 promove, de 0 a 6 critica. O índice é a diferença entre
 * as duas fatias, em pontos, de -100 a 100.
 */
export function calcularEnps(notas: number[]): Enps | null {
  if (notas.length === 0) return null;
  const promotores = notas.filter((n) => n >= 9).length;
  const detratores = notas.filter((n) => n <= 6).length;
  const neutros = notas.length - promotores - detratores;
  const valor = Math.round(((promotores - detratores) / notas.length) * 100);
  return { valor, promotores, neutros, detratores, respostas: notas.length };
}

export function apurar(perguntas: PerguntaAplicada[], respostas: RespostaGuardada[], regua: number): Apuracao {
  const itensPorPergunta = new Map<string, ItemRespondido[]>();
  for (const r of respostas) {
    for (const i of r.itens) {
      const lista = itensPorPergunta.get(i.perguntaId) ?? [];
      lista.push(i);
      itensPorPergunta.set(i.perguntaId, lista);
    }
  }

  let enps: Enps | null = null;
  const grupos = porDimensao(perguntas);
  const dimensoes: ResultadoDaDimensao[] = [];

  for (const g of grupos) {
    const resultados: ResultadoDaPergunta[] = [];
    const mediasDasPerguntas: number[] = [];
    let dentro = 0;
    let abaixo = 0;

    for (const p of g.perguntas) {
      const itens = itensPorPergunta.get(p.id) ?? [];
      const faixa = escala(p);
      const r: ResultadoDaPergunta = {
        pergunta: p,
        respostas: 0,
        media: null,
        dentro: 0,
        abaixo: 0,
        notas: faixa ? Array.from({ length: faixa.max - faixa.min + 1 }, () => 0) : [],
        opcoes: [],
        textos: [],
      };

      if (faixa) {
        const notas = itens.map((i) => i.nota).filter((n): n is number => n !== null && n >= faixa.min && n <= faixa.max);
        r.respostas = notas.length;
        r.media = media(notas);
        for (const n of notas) r.notas[n - faixa.min]++;
        if (p.enps) {
          enps = calcularEnps(notas);
        } else {
          r.dentro = notas.filter((n) => n >= regua).length;
          r.abaixo = notas.length - r.dentro;
          dentro += r.dentro;
          abaixo += r.abaixo;
          if (r.media !== null) mediasDasPerguntas.push(r.media);
        }
      } else if (p.tipo === "TEXTO") {
        r.textos = itens.map((i) => i.texto ?? "").filter(Boolean);
        r.respostas = r.textos.length;
      } else {
        const vezes = new Map(p.opcoes.map((o) => [o, 0]));
        for (const i of itens) for (const e of i.escolhas) if (vezes.has(e)) vezes.set(e, (vezes.get(e) ?? 0) + 1);
        r.respostas = itens.filter((i) => i.escolhas.length > 0).length;
        r.opcoes = [...vezes].map(([opcao, v]) => ({ opcao, vezes: v })).sort((a, b) => b.vezes - a.vezes);
      }
      resultados.push(r);
    }

    dimensoes.push({
      dimensao: g.dimensao,
      ordem: g.perguntas[0]?.dimensaoOrdem ?? 0,
      media: media(mediasDasPerguntas),
      dentro,
      abaixo,
      perguntas: resultados,
    });
  }

  const comNota = dimensoes.map((d) => d.media).filter((m): m is number => m !== null);
  return { respostas: respostas.length, geral: media(comNota), dimensoes, enps };
}

// ----------------------------------------------------------------- recortes

export type Filtro = Record<string, string>;

export function filtrar<T extends { perfil: Record<string, string> }>(respostas: T[], filtro: Filtro): T[] {
  const pares = Object.entries(filtro).filter(([, v]) => v);
  if (pares.length === 0) return respostas;
  return respostas.filter((r) => pares.every(([k, v]) => r.perfil[k] === v));
}

/** Um recorte só aparece com pelo menos MIN_GRUPO respostas. */
export function recortePermitido(quantas: number, filtro: Filtro): boolean {
  if (Object.values(filtro).every((v) => !v)) return true;
  return quantas >= MIN_GRUPO;
}

/** Quantas respostas cada opção do perfil teve, para a tela dos recortes. */
export function contagemDoPerfil(
  perfil: PerguntaDePerfil[],
  respostas: { perfil: Record<string, string> }[],
): { chave: string; rotulo: string; opcoes: { opcao: string; vezes: number }[] }[] {
  return perfil.map((p) => ({
    chave: p.chave,
    rotulo: p.rotulo,
    opcoes: p.opcoes.map((o) => ({ opcao: o, vezes: respostas.filter((r) => r.perfil[p.chave] === o).length })),
  }));
}

// --------------------------------------------------------------- comparativo

export type Ciclo = { id: string; nome: string; medias: Map<string, number> };

/** As médias digitadas de um ciclo de histórico: { dimensão: média }. */
export function lerMediasDigitadas(valor: unknown): { dimensao: string; media: number }[] {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return [];
  const lista: { dimensao: string; media: number }[] = [];
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (k.trim() && Number.isFinite(n) && n >= 0 && n <= 10) lista.push({ dimensao: k.trim(), media: n });
  }
  return lista;
}

/**
 * A tabela do comparativo: uma linha por dimensão, uma coluna por ciclo, na
 * ordem em que os ciclos foram passados (do mais antigo ao mais novo). A linha
 * leva o nome como apareceu no ciclo mais recente.
 */
export function comparativo(ciclos: Ciclo[]): { dimensao: string; valores: (number | null)[] }[] {
  const nomes = new Map<string, string>();
  const ordem: string[] = [];
  for (const c of [...ciclos].reverse()) {
    for (const nome of c.medias.keys()) {
      const k = chaveDaDimensao(nome);
      if (!nomes.has(k)) {
        nomes.set(k, nome);
        ordem.push(k);
      }
    }
  }
  return ordem.map((k) => ({
    dimensao: nomes.get(k) ?? k,
    valores: ciclos.map((c) => {
      for (const [nome, m] of c.medias) if (chaveDaDimensao(nome) === k) return m;
      return null;
    }),
  }));
}

export function variacao(atual: number | null, anterior: number | null): number | null {
  if (atual === null || anterior === null) return null;
  return Math.round((atual - anterior) * 10) / 10;
}

// -------------------------------------------------------------------- texto

export function formatarNota(valor: number | null): string {
  if (valor === null) return "—";
  return valor.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

export function porcentagem(parte: number, total: number): string {
  if (total === 0) return "—";
  return `${Math.round((parte / total) * 100)}%`;
}

/** A conclusão que o relatório sugere, como no modelo de origem. */
export function conclusaoSugerida(valor: number | null, regua: number): string {
  const c = classificar(valor, regua);
  if (c === "DENTRO") return "Não serão necessárias ações para esta dimensão.";
  if (c === "ABAIXO") return "Serão necessárias ações para esta dimensão.";
  return "";
}

export function lerConclusoes(valor: unknown): Record<string, string> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor as Record<string, unknown>)) if (typeof v === "string") saida[k] = v;
  return saida;
}
