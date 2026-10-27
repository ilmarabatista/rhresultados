import { DESCRICOES, lerResultadoDisc } from "./disc";
import { lerResultadoCadastrado } from "./testes-cadastrados";
import { PERGUNTAS_DA_REDACAO, type Ficha } from "./ficha";
import { SEM_RESPOSTA, type Entrevista } from "./entrevista";

/**
 * O fluxo da vaga (descrição do cargo, ficha, testes, entrevista e resultado)
 * e o que liga uma etapa à outra: os testes feitos pela aba Testes que viram
 * testes do candidato, e o pedido do parecer final à IA.
 */

// ------------------------------------------------------------ testes soltos

/** Nome para comparar: sem acento, sem caixa e sem espaço sobrando. */
export function nomeParaComparar(nome: string): string {
  return nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

type CandidatoParaLigar = { id: string; nome: string; situacao: string };

/**
 * O candidato da vaga que provavelmente é a pessoa que fez o teste: o nome
 * igual, e entre os iguais o que ainda está no processo. Só pelo primeiro nome
 * quando ele é único na vaga. Sem certeza, nenhum: ela escolhe.
 */
export function candidatoProvavel(pessoa: string, candidatos: CandidatoParaLigar[]): string | null {
  const alvo = nomeParaComparar(pessoa);
  if (!alvo) return null;
  const andandoPrimeiro = [...candidatos].sort((a, b) => Number(b.situacao === "EM_ANDAMENTO") - Number(a.situacao === "EM_ANDAMENTO"));
  const igual = andandoPrimeiro.find((c) => nomeParaComparar(c.nome) === alvo);
  if (igual) return igual.id;
  const primeiro = alvo.split(" ")[0];
  const mesmos = candidatos.filter((c) => nomeParaComparar(c.nome).split(" ")[0] === primeiro);
  return mesmos.length === 1 ? mesmos[0].id : null;
}

// ------------------------------------------------------------ parecer final

/** O resultado de um teste em uma linha, do jeito que a consultora leria. */
export function testeEmTexto(nome: string, resultado: unknown): string {
  const disc = lerResultadoDisc(resultado);
  if (disc) {
    const p = DESCRICOES[disc.principal];
    const s = DESCRICOES[disc.secundario];
    const perc = (["D", "I", "S", "C"] as const).map((f) => `${f} ${Math.round(disc.percentuais[f])}%`).join(", ");
    return `${nome}: perfil ${disc.perfil} (principal ${p.nome}, secundário ${s.nome}; ${perc}). ${p.resumo}`;
  }
  const cad = lerResultadoCadastrado(resultado);
  if (cad) {
    const fatores = cad.ordem
      .map((codigo) => {
        const f = cad.fatores.find((x) => x.codigo === codigo);
        return `${f?.nome ?? codigo} ${Math.round(cad.percentuais[codigo] ?? 0)}%`;
      })
      .join(", ");
    return `${nome}: ${cad.tipo ? `tipo ${cad.tipo}; ` : ""}${fatores}.`;
  }
  return `${nome}: resultado ilegível.`;
}

export type DadosDoParecer = {
  vaga: string;
  cargo: { missao: string; responsabilidades: string; requisitos: string; competencias: string[] } | null;
  ficha: Ficha | null;
  testes: string[];
  entrevista: Entrevista | null;
  anotacoes: { etapa: string; texto: string }[];
};

export const SYSTEM_DO_PARECER = [
  "Você ajuda uma consultora de RH a escrever o parecer final sobre um candidato a uma vaga.",
  "Recebe a descrição do cargo, a ficha de solicitação de emprego, o resultado dos testes, a entrevista e as anotações da consultora.",
  "Escreva um rascunho de parecer em português do Brasil, em texto corrido, com 3 parágrafos curtos:",
  "1. Aderência ao cargo: o que na formação, na experiência e na entrevista combina ou não com o que o cargo pede.",
  "2. Perfil comportamental: o que os testes e a entrevista mostram, ligado ao dia a dia do cargo.",
  "3. Pontos de atenção e o que conferir antes de contratar.",
  "Regras:",
  "- Use só o que está nos dados. Não invente fatos, números, empresas ou datas.",
  "- Se faltar uma parte (por exemplo, sem testes ou sem entrevista), diga em uma frase que ela não foi feita.",
  "- Não decida pela consultora: não escreva \"aprovado\" nem \"reprovado\". Ela decide.",
  "- Não comente idade, gênero, estado civil, religião, aparência ou saúde.",
  "- Sem emoji, sem markdown, sem títulos. No máximo 250 palavras.",
].join("\n");

function bloco(nome: string, linhas: (string | false | null | undefined)[]): string {
  const cheias = linhas.filter((l): l is string => Boolean(l && l.trim()));
  return cheias.length ? `<${nome}>\n${cheias.join("\n")}\n</${nome}>` : `<${nome}>não feito</${nome}>`;
}

export function pedidoDoParecer(d: DadosDoParecer): string {
  const f = d.ficha;
  return [
    `Vaga: ${d.vaga}`,
    bloco("descricao_do_cargo", d.cargo
      ? [
          d.cargo.missao && `Missão: ${d.cargo.missao}`,
          d.cargo.responsabilidades && `Responsabilidades: ${d.cargo.responsabilidades}`,
          d.cargo.requisitos && `Requisitos: ${d.cargo.requisitos}`,
          d.cargo.competencias.length > 0 && `Competências: ${d.cargo.competencias.join("; ")}`,
        ]
      : []),
    bloco("ficha", f
      ? [
          `Formação: ${[f.formacao.nivel, f.formacao.curso, f.formacao.situacao].filter(Boolean).join(", ")}`,
          f.formacao.outrosCursos && `Outros cursos: ${f.formacao.outrosCursos}`,
          f.primeiroEmprego
            ? "Primeiro emprego."
            : `Experiências: ${f.experiencias.map((x) => `${x.cargo} em ${x.empresa} (${x.entrada} a ${x.saida || "hoje"}; saída: ${x.motivoSaida || "não informado"})`).join("; ")}`,
          f.perfilProfissional && `Perfil profissional: ${f.perfilProfissional}`,
          f.voluntariado && `Voluntariado: ${f.voluntariado}`,
          `${PERGUNTAS_DA_REDACAO.qualidades} ${f.redacao.qualidades}`,
          `${PERGUNTAS_DA_REDACAO.expectativas} ${f.redacao.expectativas}`,
        ]
      : []),
    bloco("testes", d.testes),
    bloco("entrevista", d.entrevista
      ? [
          ...d.entrevista.respostas.filter((r) => r.resposta && r.resposta !== SEM_RESPOSTA).map((r) => `P: ${r.pergunta}\nR: ${r.resposta}`),
          d.entrevista.outros && `Outros pontos: ${d.entrevista.outros}`,
          d.entrevista.avaliacao && `Avaliação da entrevistadora: ${d.entrevista.avaliacao}`,
        ]
      : []),
    bloco("anotacoes_da_consultora", d.anotacoes.map((a) => `${a.etapa}: ${a.texto}`)),
  ].join("\n\n");
}

// ------------------------------------------------------- avaliação automática

export type CriterioDaAvaliacao = { nome: string; nota: number; comentario: string };

/**
 * A avaliação automática do candidato, feita pela IA a partir da pasta e
 * guardada com a assinatura do que ela leu: quando a pasta muda, é refeita.
 */
export type Avaliacao = {
  aderencia: "ALTA" | "MEDIA" | "BAIXA";
  /** De 0 a 10: o quanto o candidato combina com o cargo, olhando a pasta toda. */
  nota: number;
  criterios: CriterioDaAvaliacao[];
  pontosFortes: string[];
  pontosDeAtencao: string[];
  resumo: string;
  geradaEm: string;
  assinatura: string;
};

export const ADERENCIA: Record<Avaliacao["aderencia"], { rotulo: string; tom: "bom" | "atencao" | "ruim" }> = {
  ALTA: { rotulo: "Aderência alta", tom: "bom" },
  MEDIA: { rotulo: "Aderência média", tom: "atencao" },
  BAIXA: { rotulo: "Aderência baixa", tom: "ruim" },
};

/** As áreas que a avaliação sempre nota, nesta ordem. */
export const CRITERIOS = ["Formação e experiência", "Perfil comportamental (testes)", "Entrevista", "Ficha e redação"] as const;

export const SYSTEM_DA_AVALIACAO = [
  "Você avalia um candidato a uma vaga para uma consultora de RH, a partir da pasta dele.",
  "Recebe a descrição do cargo, a ficha de solicitação de emprego, o resultado dos testes, a entrevista e as anotações da consultora.",
  "Dê uma nota de 0 a 10 para o quanto o candidato combina com o cargo em cada área:",
  ...CRITERIOS.map((c) => `- ${c}`),
  "Regras:",
  "- Use só o que está nos dados. Não invente fatos.",
  "- Se uma área não foi feita (por exemplo, sem testes), dê nota null e diga no comentário que ela não foi feita.",
  "- Sem descrição do cargo, compare com o que o nome da vaga costuma pedir e diga isso no resumo.",
  "- Não use idade, gênero, estado civil, religião, aparência ou saúde.",
  "- Comentários curtos (uma ou duas frases), em português do Brasil, sem emoji e sem markdown.",
  "- aderencia: ALTA (nota geral 7 ou mais), MEDIA (5 a 6,9) ou BAIXA (abaixo de 5).",
  "",
  "Responda SOMENTE com um JSON neste formato:",
  '{"nota": 7.5, "aderencia": "ALTA", "criterios": [{"nome": "Formação e experiência", "nota": 8, "comentario": "..."}], "pontosFortes": ["..."], "pontosDeAtencao": ["..."], "resumo": "..."}',
].join("\n");

function notaValida(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(",", ".")) : NaN;
  // Negativo é como a avaliação guardada marca a área não feita.
  return Number.isFinite(n) && n >= 0 ? Math.round(Math.min(10, n) * 10) / 10 : null;
}

function textos(v: unknown, max: number): string[] {
  return (Array.isArray(v) ? v : [])
    .filter((x): x is string => typeof x === "string" && x.trim() !== "")
    .map((x) => x.trim().slice(0, 300))
    .slice(0, max);
}

function aderenciaDa(nota: number): Avaliacao["aderencia"] {
  return nota >= 7 ? "ALTA" : nota >= 5 ? "MEDIA" : "BAIXA";
}

/**
 * Lê o que a IA devolveu. Os critérios são sempre os quatro, na mesma ordem;
 * área sem nota (não feita) fica de fora da conta da nota geral. A aderência
 * sai da nota, para nunca discordar dela.
 */
export function avaliacaoDaIA(lido: unknown, assinatura: string, agora = new Date()): Avaliacao | null {
  const o = (lido && typeof lido === "object" ? lido : {}) as Record<string, unknown>;
  const crus = Array.isArray(o.criterios) ? o.criterios : [];
  const criterios: CriterioDaAvaliacao[] = [];
  for (const nome of CRITERIOS) {
    const achado = crus.find((c) => c && typeof c === "object" && String((c as Record<string, unknown>).nome ?? "").toLowerCase().startsWith(nome.slice(0, 6).toLowerCase())) as
      | Record<string, unknown>
      | undefined;
    const nota = notaValida(achado?.nota);
    const comentario = typeof achado?.comentario === "string" ? achado.comentario.trim().slice(0, 500) : "";
    criterios.push({ nome, nota: nota ?? -1, comentario: comentario || (nota === null ? "Não foi feita." : "") });
  }
  const comNota = criterios.filter((c) => c.nota >= 0);
  const media = comNota.length ? comNota.reduce((s, c) => s + c.nota, 0) / comNota.length : null;
  const nota = notaValida(o.nota) ?? (media === null ? null : notaValida(media));
  if (nota === null) return null;
  return {
    nota,
    aderencia: aderenciaDa(nota),
    criterios,
    pontosFortes: textos(o.pontosFortes, 6),
    pontosDeAtencao: textos(o.pontosDeAtencao, 6),
    resumo: typeof o.resumo === "string" ? o.resumo.trim().slice(0, 1500) : "",
    geradaEm: agora.toISOString(),
    assinatura,
  };
}

/** A avaliação guardada no banco, ou null se não houver (ou estiver ilegível). */
export function lerAvaliacao(cru: unknown): Avaliacao | null {
  if (!cru || typeof cru !== "object" || Array.isArray(cru)) return null;
  const o = cru as Record<string, unknown>;
  if (typeof o.assinatura !== "string" || typeof o.geradaEm !== "string") return null;
  const lida = avaliacaoDaIA(o, o.assinatura, new Date(o.geradaEm));
  return lida ? { ...lida, geradaEm: o.geradaEm } : null;
}
