/**
 * Mapeamento de rotinas: as regras, sem banco, para serem testadas.
 *
 * É a entrevista do RH com a pessoa sobre o que ela faz, no modelo da clínica:
 * visão geral, tarefas com periodicidade e criticidade, o passo a passo do
 * processo principal, ferramentas, o conhecimento que não está escrito,
 * gargalos, indicadores e as observações do RH (que não saem para a pessoa).
 * Dele saem os itens da autoavaliação da função e as sugestões de meta do PDI.
 */

import { textoSeguro } from "./texto-seguro";
import { linhasComoItens, semAcento } from "./text";

// ------------------------------------------------------------------ opções

export const PERIODICIDADES = ["DIARIA", "SEMANAL", "QUINZENAL", "MENSAL", "SOB_DEMANDA"] as const;
export type Periodicidade = (typeof PERIODICIDADES)[number];
export const ROTULO_DA_PERIODICIDADE: Record<Periodicidade, string> = {
  DIARIA: "Diária",
  SEMANAL: "Semanal",
  QUINZENAL: "Quinzenal",
  MENSAL: "Mensal",
  SOB_DEMANDA: "Sob demanda",
};

export const CRITICIDADES = ["ALTA", "MEDIA", "BAIXA"] as const;
export type Criticidade = (typeof CRITICIDADES)[number];
export const ROTULO_DA_CRITICIDADE: Record<Criticidade, string> = { ALTA: "Alta", MEDIA: "Média", BAIXA: "Baixa" };

// ------------------------------------------------------------------ dados

export type Tarefa = { descricao: string; periodicidade: Periodicidade | null; criticidade: Criticidade | null };
export type Ferramenta = { nome: string; uso: string; acesso: string };
export type Gargalo = { situacao: string; impacto: string };

export type DadosDoMapeamento = {
  cargo: string;
  setor: string;
  tempoNoCargo: string;

  resumo: string;
  entregavel: string;
  relacionamentos: string;

  tarefas: Tarefa[];
  tarefaExclusiva: string;

  processoNome: string;
  processoExemplo: string;
  passos: string[];
  quandoDaErrado: string;

  ferramentas: Ferramenta[];
  dadoSensivel: string;

  substituir: string;
  contatoExterno: string;
  regraNaoEscrita: string;

  gargalos: Gargalo[];
  melhoriaDoSetor: string;

  bomTrabalho: string;
  metaAcompanhada: string;
  qualidade: string;

  /** Só para o RH: não aparecem para a pessoa nem na via dela. */
  rhImpressoes: string;
  rhAtencao: string;
  rhProximosPassos: string;
};

export const CAMPOS_DE_TEXTO = [
  "cargo",
  "setor",
  "tempoNoCargo",
  "resumo",
  "entregavel",
  "relacionamentos",
  "tarefaExclusiva",
  "processoNome",
  "processoExemplo",
  "quandoDaErrado",
  "dadoSensivel",
  "substituir",
  "contatoExterno",
  "regraNaoEscrita",
  "melhoriaDoSetor",
  "bomTrabalho",
  "metaAcompanhada",
  "qualidade",
  "rhImpressoes",
  "rhAtencao",
  "rhProximosPassos",
] as const satisfies readonly (keyof DadosDoMapeamento)[];

export function mapeamentoVazio(inicio: Partial<Pick<DadosDoMapeamento, "cargo" | "setor">> = {}): DadosDoMapeamento {
  const d = Object.fromEntries(CAMPOS_DE_TEXTO.map((c) => [c, ""])) as Record<(typeof CAMPOS_DE_TEXTO)[number], string>;
  return {
    ...d,
    cargo: inicio.cargo ?? "",
    setor: inicio.setor ?? "",
    tarefas: [],
    passos: [],
    ferramentas: [],
    gargalos: [],
  };
}

const TETO_CURTO = 300;
const TETO_LONGO = 6000;
const TETO_DE_LINHAS = 60;

function txt(valor: unknown, max = TETO_LONGO): string {
  return typeof valor === "string" ? textoSeguro(valor).trim().slice(0, max) : "";
}

function opcao<T extends string>(lista: readonly T[], valor: unknown): T | null {
  if (typeof valor !== "string") return null;
  const v = semAcento(valor).trim().toUpperCase().replace(/\s+/g, "_");
  return (lista as readonly string[]).includes(v) ? (v as T) : null;
}

function lista(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor.slice(0, TETO_DE_LINHAS) : [];
}

function obj(valor: unknown): Record<string, unknown> {
  return valor && typeof valor === "object" && !Array.isArray(valor) ? (valor as Record<string, unknown>) : {};
}

/**
 * Os dados lidos do JSON (do banco, do formulário ou da IA) com cuidado: o que
 * não é do formato vira vazio, linhas em branco somem e nada passa do teto.
 */
export function lerDados(cru: unknown): DadosDoMapeamento {
  const o = obj(cru);
  const d = mapeamentoVazio();
  for (const c of CAMPOS_DE_TEXTO) {
    d[c] = txt(o[c], c === "cargo" || c === "setor" || c === "tempoNoCargo" ? TETO_CURTO : TETO_LONGO);
  }
  d.tarefas = lista(o.tarefas).flatMap((t) => {
    const x = obj(t);
    const descricao = txt(x.descricao, 1000);
    if (!descricao) return [];
    return [
      {
        descricao,
        periodicidade: opcao(PERIODICIDADES, x.periodicidade),
        criticidade: opcao(CRITICIDADES, x.criticidade),
      },
    ];
  });
  d.passos = lista(o.passos)
    .map((p) => txt(p, 2000))
    .filter(Boolean);
  d.ferramentas = lista(o.ferramentas).flatMap((f) => {
    const x = obj(f);
    const nome = txt(x.nome, TETO_CURTO);
    if (!nome) return [];
    return [{ nome, uso: txt(x.uso, 1000), acesso: txt(x.acesso, TETO_CURTO) }];
  });
  d.gargalos = lista(o.gargalos).flatMap((g) => {
    const x = obj(g);
    const situacao = txt(x.situacao, 2000);
    if (!situacao) return [];
    return [{ situacao, impacto: txt(x.impacto, 2000) }];
  });
  return d;
}

/** Quanto do mapeamento já foi preenchido, para a lista do colaborador. */
export function resumoDoMapeamento(d: DadosDoMapeamento): { tarefas: number; passos: number; ferramentas: number } {
  return { tarefas: d.tarefas.length, passos: d.passos.length, ferramentas: d.ferramentas.length };
}

// ------------------------------------------------------------ IA: preencher

export const SYSTEM_DO_MAPEAMENTO = `Você ajuda a gerente de RH de uma clínica odontológica a organizar a entrevista de mapeamento de rotinas de um colaborador.
Você recebe a transcrição (ou as anotações) da conversa e devolve as respostas organizadas nas seções do mapeamento.
Regras:
- Use só o que a pessoa disse. Não invente tarefa, sistema, número ou nome. O que não apareceu fica como texto vazio ("") ou lista vazia.
- Escreva em português do Brasil, em frases claras, na terceira pessoa ("Responsável pela...", "Realiza...").
- Cada tarefa é uma linha separada, com uma ação só.
- Os passos do processo principal vêm na ordem em que a pessoa faz, um passo por item, como se fosse ensinar alguém do zero.
- Periodicidade é uma destas: DIARIA, SEMANAL, QUINZENAL, MENSAL, SOB_DEMANDA. Criticidade é ALTA, MEDIA ou BAIXA. Se a pessoa não disse, deduza pelo contexto com prudência; se não der, use null.
- Nas observações do RH (rhImpressoes, rhAtencao, rhProximosPassos), escreva o que uma gerente de RH anotaria: impressões gerais, pontos de atenção (um por linha) e próximos passos (um por linha). Baseie-se só na conversa.
- Sem emoji, sem markdown.
Responda apenas com um objeto JSON, sem texto antes ou depois, neste formato:
{"cargo":"","setor":"","tempoNoCargo":"","resumo":"","entregavel":"","relacionamentos":"",
"tarefas":[{"descricao":"","periodicidade":"DIARIA","criticidade":"ALTA"}],"tarefaExclusiva":"",
"processoNome":"","processoExemplo":"","passos":[""],"quandoDaErrado":"",
"ferramentas":[{"nome":"","uso":"","acesso":""}],"dadoSensivel":"",
"substituir":"","contatoExterno":"","regraNaoEscrita":"",
"gargalos":[{"situacao":"","impacto":""}],"melhoriaDoSetor":"",
"bomTrabalho":"","metaAcompanhada":"","qualidade":"",
"rhImpressoes":"","rhAtencao":"","rhProximosPassos":""}`;

export function pedidoDoMapeamento(contexto: { cargo: string; setor: string }, transcricao: string): string {
  return [
    contexto.cargo ? `Cargo/função no cadastro: ${contexto.cargo}` : "",
    contexto.setor ? `Setor no cadastro: ${contexto.setor}` : "",
    "Transcrição ou anotações da entrevista:",
    transcricao,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Junta o rascunho da IA ao que já está na tela: campo que a IA deixou vazio
 * não apaga o que o RH já escreveu, e listas só são trocadas quando a IA trouxe
 * alguma coisa.
 */
export function juntarRascunho(atual: DadosDoMapeamento, daIA: DadosDoMapeamento): DadosDoMapeamento {
  const r = { ...atual };
  for (const c of CAMPOS_DE_TEXTO) if (daIA[c]) r[c] = daIA[c];
  if (daIA.tarefas.length) r.tarefas = daIA.tarefas;
  if (daIA.passos.length) r.passos = daIA.passos;
  if (daIA.ferramentas.length) r.ferramentas = daIA.ferramentas;
  if (daIA.gargalos.length) r.gargalos = daIA.gargalos;
  return r;
}

// ------------------------------------------------- para a autoavaliação

/** Os tipos de item que o mapeamento sugere: os que se marcam na ficha. */
export type TipoSugerido = "TECNICA" | "TAREFA" | "COMPORTAMENTAL";
export type ItemSugerido = { tipo: TipoSugerido; texto: string; origem: string };

export const SYSTEM_DOS_ITENS = `Você ajuda a gerente de RH de uma clínica odontológica a montar a ficha de autoavaliação de uma função a partir do mapeamento de rotinas de quem ocupa essa função.
Cada item é uma frase que o colaborador vai marcar sobre si mesmo. Regras de escrita (obrigatórias):
- Formato "Tema: frase em primeira pessoa". Exemplo: "Pontualidade: chego sempre no horário e respeito os horários de pausa".
- Uma ação por item. Se a frase juntaria duas coisas com "e", "sem" ou vírgula, divida em dois itens.
- Critério concreto e observável, nada vago. Exemplos bons: "Esterilização: sigo o manual de utilização em todos os ciclos (tempo, temperatura e quantidade de água)"; "Atendimento: escuto o paciente com acolhimento e atenção".
- Frases curtas, com as palavras e os sistemas da própria clínica (os nomes que aparecem no mapeamento).
Tipos:
- TAREFA: uma tarefa da rotina (o colaborador vai dizer se faz sozinho, com ajuda, não faz ou quer aprender).
- TECNICA: um saber técnico que a função exige, tirado do passo a passo, das ferramentas e do conhecimento crítico (nota de 1 a 4).
- COMPORTAMENTAL: só quando o mapeamento mostra claramente uma atitude que a função pede (ex.: organização do controle). Poucos.
Cubra todas as tarefas e os passos importantes do processo principal. Não invente nada que não esteja no mapeamento. Sem emoji, sem markdown.
Responda apenas com um objeto JSON: {"itens":[{"tipo":"TAREFA","texto":"Tema: frase","origem":"de onde saiu, em poucas palavras"}]}`;

export function textoDoMapeamentoParaIA(d: DadosDoMapeamento): string {
  const linhas: string[] = [];
  const add = (rotulo: string, valor: string) => {
    if (valor) linhas.push(`${rotulo}: ${valor}`);
  };
  add("Cargo", d.cargo);
  add("Setor", d.setor);
  add("Resumo da função", d.resumo);
  add("Principal entregável", d.entregavel);
  if (d.tarefas.length) {
    linhas.push("Tarefas:");
    d.tarefas.forEach((t, i) =>
      linhas.push(
        `${i + 1}. ${t.descricao}${t.periodicidade ? ` (${ROTULO_DA_PERIODICIDADE[t.periodicidade]})` : ""}${t.criticidade ? ` [criticidade ${ROTULO_DA_CRITICIDADE[t.criticidade]}]` : ""}`,
      ),
    );
  }
  add("Processo principal", d.processoNome);
  if (d.passos.length) {
    linhas.push("Passo a passo:");
    d.passos.forEach((p, i) => linhas.push(`Passo ${i + 1}: ${p}`));
  }
  add("Quando dá errado", d.quandoDaErrado);
  if (d.ferramentas.length) {
    linhas.push("Ferramentas:");
    d.ferramentas.forEach((f) => linhas.push(`- ${f.nome}${f.uso ? `: ${f.uso}` : ""}`));
  }
  add("O que uma pessoa nova precisaria saber", d.substituir);
  add("Regra não documentada", d.regraNaoEscrita);
  add("Como sabe que fez um bom trabalho", d.bomTrabalho);
  add("Como mediria a qualidade", d.qualidade);
  return linhas.join("\n");
}

const TIPOS_SUGERIDOS: readonly TipoSugerido[] = ["TECNICA", "TAREFA", "COMPORTAMENTAL"];

export function itensDaIA(cru: unknown): ItemSugerido[] {
  const vistos = new Set<string>();
  return lista(obj(cru).itens).flatMap((i) => {
    const x = obj(i);
    const tipo = opcao(TIPOS_SUGERIDOS, x.tipo);
    const texto = txt(x.texto, 400);
    if (!tipo || texto.length < 3) return [];
    const chave = chaveDoTexto(texto);
    if (vistos.has(chave)) return [];
    vistos.add(chave);
    return [{ tipo, texto, origem: txt(x.origem, 200) }];
  });
}

/** Sem IA: cada tarefa do mapeamento vira um item de tarefa, do jeito que está escrita. */
export function itensSemIA(d: DadosDoMapeamento): ItemSugerido[] {
  return d.tarefas.map((t, i) => ({ tipo: "TAREFA" as const, texto: t.descricao, origem: `Tarefa ${i + 1}` }));
}

/** Para saber se o item já está no modelo: sem acento, sem pontuação, sem caixa. */
export function chaveDoTexto(texto: string): string {
  return semAcento(texto)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// ------------------------------------------------------------ para o PDI

export type MetaSugerida = { titulo: string; origem: "Ponto de atenção" | "Próximo passo" | "Gargalo" };

/**
 * O que o mapeamento sugere para o PDI: cada ponto de atenção e cada próximo
 * passo (um por linha) e cada gargalo com a sugestão de melhoria.
 */
export function metasDoMapeamento(d: DadosDoMapeamento): MetaSugerida[] {
  return [
    ...linhasComoItens(d.rhAtencao).map((titulo) => ({ titulo, origem: "Ponto de atenção" as const })),
    ...linhasComoItens(d.rhProximosPassos).map((titulo) => ({ titulo, origem: "Próximo passo" as const })),
    ...d.gargalos.map((g) => ({
      titulo: g.impacto ? `${g.situacao}. ${g.impacto}` : g.situacao,
      origem: "Gargalo" as const,
    })),
  ].map((m) => ({ ...m, titulo: m.titulo.slice(0, 300) }));
}

// ------------------------------------------------------------ pelo link

/** Os campos que só o RH vê e escreve: não vão para a pessoa nem voltam dela. */
export const CAMPOS_DO_RH = ["rhImpressoes", "rhAtencao", "rhProximosPassos"] as const;

export const STATUS_DO_MAPEAMENTO = ["RASCUNHO", "ENVIADO", "RESPONDIDO"] as const;
export type StatusDoMapeamento = (typeof STATUS_DO_MAPEAMENTO)[number];

export function lerStatus(valor: unknown): StatusDoMapeamento {
  return (STATUS_DO_MAPEAMENTO as readonly string[]).includes(String(valor)) ? (valor as StatusDoMapeamento) : "RASCUNHO";
}

export const ROTULO_DO_STATUS: Record<StatusDoMapeamento, string> = {
  RASCUNHO: "Preenchido pelo RH",
  ENVIADO: "Link enviado",
  RESPONDIDO: "Respondido pela pessoa",
};

/** O que a pessoa recebe no link: tudo menos as observações do RH. */
export function dadosParaAPessoa(d: DadosDoMapeamento): DadosDoMapeamento {
  const r = { ...d };
  for (const c of CAMPOS_DO_RH) r[c] = "";
  return r;
}

/** O que a pessoa mandou, por cima do que está gravado, sem tocar nas observações do RH. */
export function juntarDaPessoa(gravado: DadosDoMapeamento, daPessoa: unknown): DadosDoMapeamento {
  const novo = lerDados(daPessoa);
  for (const c of CAMPOS_DO_RH) novo[c] = gravado[c];
  return novo;
}

/** Para enviar: pelo menos uma tarefa, que é de onde sai a autoavaliação. */
export function conferirMapeamento(d: DadosDoMapeamento): string | null {
  if (!d.resumo.trim()) return "Conte em poucas palavras o que você faz (seção 2).";
  if (!d.tarefas.length) return "Liste pelo menos uma tarefa (seção 3).";
  return null;
}

export function mensagemDoMapeamento(nome: string, link: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  return `Olá, ${primeiro}! Queremos entender melhor a sua rotina de trabalho. Conte pelo link o que você faz no dia a dia, com calma e pelo celular mesmo: ${link}`;
}
