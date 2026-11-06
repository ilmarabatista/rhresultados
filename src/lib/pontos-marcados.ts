/**
 * Os pontos marcados nas autoavaliações, separados pelo destino de cada um:
 *
 * - **Reunião geral de equipe**: o item foi marcado por pessoas de duas ou
 *   mais funções. É assunto de todos.
 * - **Treinamento de setor**: o item foi marcado por duas ou mais pessoas da
 *   mesma função, e só dela. É assunto daquele setor.
 * - **PDI**: o item foi marcado por uma pessoa só. É assunto da conversa 1 a 1.
 *
 * "Marcado" é o que pede atenção na ficha (nota 1 ou 2, tarefa "faço com
 * ajuda" ou "quero aprender", conduta "às vezes" ou "frequentemente"). O
 * mesmo item é reconhecido em fichas diferentes pela frase, sem o tema antes
 * dos dois-pontos, sem acento e sem pontuação: assim "Celular no atendimento:
 * usei o celular durante um atendimento" e a versão antiga "Usei o celular
 * durante um atendimento" contam juntas.
 */

import {
  SECAO_DO_TIPO,
  lerPerguntas,
  lerRespostas,
  opcaoDaResposta,
  pedeAtencao,
  type TipoDePergunta,
} from "./autoavaliacao";

export type Destino = "GERAL" | "SETOR" | "PDI";

export const SOBRE_O_DESTINO: Record<Destino, { titulo: string; regra: string }> = {
  GERAL: {
    titulo: "Reunião geral de equipe",
    regra: "Marcado por pessoas de duas ou mais funções. É assunto de todos.",
  },
  SETOR: {
    titulo: "Treinamento de setor",
    regra: "Marcado por duas ou mais pessoas da mesma função, e só dela. É assunto daquele setor.",
  },
  PDI: {
    titulo: "PDI (conversa 1 a 1)",
    regra: "Marcado por uma pessoa só. É assunto do plano individual dela.",
  },
};

/** Uma autoavaliação respondida, como vem do banco. */
export type Respondida = {
  pessoaId: string;
  nome: string;
  /** O nome da ficha (a função). */
  funcao: string;
  perguntas: unknown;
  respostas: unknown;
};

/** A chave que reconhece o mesmo item em fichas e versões diferentes. */
export function chaveDoItem(texto: string): string {
  const semTema = texto.includes(":") ? texto.slice(texto.indexOf(":") + 1) : texto;
  const base = semTema.trim() ? semTema : texto;
  return base
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export type Marcacao = { pessoaId: string; nome: string; funcao: string; resposta: string };

export type PorFuncao = { funcao: string; marcaram: number; de: number };

export type Ponto = {
  chave: string;
  texto: string;
  tipo: TipoDePergunta;
  secao: string;
  destino: Destino;
  /** Quantas pessoas marcaram. */
  marcaram: number;
  /** Quantas pessoas responderam a esse item. */
  de: number;
  porFuncao: PorFuncao[];
  /** Quem marcou. Só aparece no PDI, que é individual. */
  marcacoes: Marcacao[];
};

export type Separacao = {
  /** Quantas autoavaliações respondidas entraram na conta. */
  respondidas: number;
  funcoes: { funcao: string; pessoas: number }[];
  geral: Ponto[];
  /** Por função, na ordem das funções com mais itens. */
  setor: { funcao: string; pessoas: number; pontos: Ponto[] }[];
  /** Por pessoa, dentro de cada função. */
  pdi: { funcao: string; pessoas: { pessoaId: string; nome: string; pontos: Ponto[] }[] }[];
};

function porQuantidade(a: Ponto, b: Ponto): number {
  return b.marcaram - a.marcaram || b.marcaram / b.de - a.marcaram / a.de || a.texto.localeCompare(b.texto, "pt-BR");
}

/** Prefere a frase com tema ("Tema: frase"), que é o padrão atual das fichas. */
function melhorTexto(atual: string, novo: string): string {
  const temTema = (t: string) => /^[^:]{2,60}:\s*\S/.test(t);
  if (temTema(novo) && !temTema(atual)) return novo;
  return atual;
}

export function separarPontos(respondidas: Respondida[]): Separacao {
  const itens = new Map<
    string,
    { texto: string; tipo: TipoDePergunta; responderam: Map<string, string>; marcacoes: Marcacao[] }
  >();
  const pessoasPorFuncao = new Map<string, Set<string>>();

  for (const r of respondidas) {
    const perguntas = lerPerguntas(r.perguntas);
    const respostas = lerRespostas(perguntas, r.respostas);
    if (!pessoasPorFuncao.has(r.funcao)) pessoasPorFuncao.set(r.funcao, new Set());
    pessoasPorFuncao.get(r.funcao)!.add(r.pessoaId);

    const vistos = new Set<string>();
    for (const p of perguntas) {
      if (p.tipo === "ABERTA") continue;
      const valor = respostas[p.id];
      if (!valor) continue;
      const chave = chaveDoItem(p.texto);
      if (!chave || vistos.has(chave)) continue;
      vistos.add(chave);

      let item = itens.get(chave);
      if (!item) {
        item = { texto: p.texto, tipo: p.tipo, responderam: new Map(), marcacoes: [] };
        itens.set(chave, item);
      } else {
        item.texto = melhorTexto(item.texto, p.texto);
      }
      item.responderam.set(r.pessoaId, r.funcao);
      if (pedeAtencao(p, valor)) {
        item.marcacoes.push({
          pessoaId: r.pessoaId,
          nome: r.nome,
          funcao: r.funcao,
          resposta: opcaoDaResposta(p, valor)?.rotulo ?? valor,
        });
      }
    }
  }

  const pontos: Ponto[] = [];
  for (const [chave, item] of itens) {
    if (item.marcacoes.length === 0) continue;
    const funcoesQueMarcaram = [...new Set(item.marcacoes.map((m) => m.funcao))];
    const destino: Destino =
      funcoesQueMarcaram.length >= 2 ? "GERAL" : item.marcacoes.length >= 2 ? "SETOR" : "PDI";
    const funcoesQueResponderam = [...new Set(item.responderam.values())];
    const porFuncao = funcoesQueResponderam
      .map((funcao) => ({
        funcao,
        marcaram: item.marcacoes.filter((m) => m.funcao === funcao).length,
        de: [...item.responderam.values()].filter((f) => f === funcao).length,
      }))
      .sort((a, b) => b.marcaram - a.marcaram || a.funcao.localeCompare(b.funcao, "pt-BR"));
    pontos.push({
      chave,
      texto: item.texto,
      tipo: item.tipo,
      secao: SECAO_DO_TIPO[item.tipo].curto,
      destino,
      marcaram: item.marcacoes.length,
      de: item.responderam.size,
      porFuncao,
      marcacoes: item.marcacoes,
    });
  }

  const funcoes = [...pessoasPorFuncao]
    .map(([funcao, s]) => ({ funcao, pessoas: s.size }))
    .sort((a, b) => b.pessoas - a.pessoas || a.funcao.localeCompare(b.funcao, "pt-BR"));

  const geral = pontos.filter((p) => p.destino === "GERAL").sort(porQuantidade);

  const setor = funcoes
    .map(({ funcao, pessoas }) => ({
      funcao,
      pessoas,
      pontos: pontos
        .filter((p) => p.destino === "SETOR" && p.marcacoes[0].funcao === funcao)
        .map((p) => {
          // No setor, o "de" é quantos daquela função responderam ao item.
          const daFuncao = p.porFuncao.find((f) => f.funcao === funcao);
          return { ...p, de: daFuncao?.de ?? p.de };
        })
        .sort(porQuantidade),
    }))
    .filter((s) => s.pontos.length > 0)
    .sort((a, b) => b.pontos.length - a.pontos.length || a.funcao.localeCompare(b.funcao, "pt-BR"));

  const pdi = funcoes
    .map(({ funcao }) => {
      const daFuncao = pontos.filter((p) => p.destino === "PDI" && p.marcacoes[0].funcao === funcao);
      const porPessoa = new Map<string, { pessoaId: string; nome: string; pontos: Ponto[] }>();
      for (const p of daFuncao) {
        const m = p.marcacoes[0];
        if (!porPessoa.has(m.pessoaId)) porPessoa.set(m.pessoaId, { pessoaId: m.pessoaId, nome: m.nome, pontos: [] });
        porPessoa.get(m.pessoaId)!.pontos.push(p);
      }
      return {
        funcao,
        pessoas: [...porPessoa.values()]
          .map((x) => ({ ...x, pontos: x.pontos.sort((a, b) => a.texto.localeCompare(b.texto, "pt-BR")) }))
          .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
      };
    })
    .filter((f) => f.pessoas.length > 0);

  return { respondidas: respondidas.length, funcoes, geral, setor, pdi };
}
