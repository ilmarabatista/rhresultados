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
