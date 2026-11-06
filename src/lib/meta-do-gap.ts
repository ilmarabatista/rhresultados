/**
 * A meta que nasce de um gap, já pronta: as cinco letras do SMART e as ações
 * no 70-20-10, com responsável e prazo. Sem banco e sem IA, para ser
 * instantânea e testável. O RH edita o que quiser antes ou depois.
 *
 * O texto depende do tipo do item, porque cada um pede um caminho:
 * - competência (técnica ou comportamental): sair da nota de hoje para o
 *   padrão, com prática no dia a dia, feedback e o padrão revisto;
 * - tarefa ("faço com ajuda", "quero aprender"): aprender com quem já faz,
 *   fazer junto e depois sozinho(a);
 * - conduta ("às vezes", "frequentemente"): entender por que acontece,
 *   combinar o que fazer no lugar e chegar a "nunca".
 */

import { nivelFinal, type Nota, type TipoDeAcao } from "./pdi";

export type TipoDoGap = "COMPETENCIA" | "TAREFA" | "CONDUTA";

export type AcaoSugerida = {
  tipo: TipoDeAcao;
  titulo: string;
  responsavel: string;
  /** "AAAA-MM-DD", ou null quando o plano não tem datas. */
  prazo: string | null;
};

export type MetaDoGap = {
  competencia: string;
  titulo: string;
  indicador: string;
  recursos: string;
  relevancia: string;
  prazo: string | null;
  acoes: AcaoSugerida[];
};

/** O item da avaliação separado em tipo, tema e frase ("Tema: frase"). */
export function lerItem(nome: string): { tipoDoGap: TipoDoGap; tema: string; frase: string | null; texto: string } {
  let resto = nome.trim();
  let tipoDoGap: TipoDoGap = "COMPETENCIA";
  const prefixo = resto.match(/^(Tarefa|Conduta):\s*/i);
  if (prefixo) {
    tipoDoGap = prefixo[1].toLowerCase() === "tarefa" ? "TAREFA" : "CONDUTA";
    resto = resto.slice(prefixo[0].length).trim();
  }
  const i = resto.indexOf(":");
  // Só é tema o que vem antes dos dois-pontos e é curto; o resto é a frase.
  if (i > 0 && i <= 60 && resto.slice(i + 1).trim()) {
    return { tipoDoGap, tema: resto.slice(0, i).trim(), frase: resto.slice(i + 1).trim(), texto: resto };
  }
  return { tipoDoGap, tema: resto, frase: null, texto: resto };
}

/** "Pontualidade" vira "pontualidade" no meio da frase; siglas ficam. */
function noMeio(t: string): string {
  const primeira = t.split(/\s+/)[0] ?? "";
  if (primeira.length > 1 && primeira === primeira.toUpperCase()) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

function maiuscula(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function somarDias(dia: string, dias: number): string {
  const d = new Date(`${dia}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Um prazo a tantos dias do início, sem passar do fim do plano. */
function prazoEm(inicio: string | null, fim: string | null, dias: number): string | null {
  if (!inicio) return fim;
  const p = somarDias(inicio, dias);
  return fim && p > fim ? fim : p;
}

const FREQUENCIA: Record<number, string> = { 1: "frequentemente", 2: "às vezes" };

/**
 * A meta completa de um gap. `inicio` e `fim` são as datas do plano
 * ("AAAA-MM-DD"); sem elas, as ações ficam sem prazo.
 */
export function metaDoGap(
  n: Nota & { tipo?: string | null },
  plano: { inicio: string | null; fim: string | null },
): MetaDoGap {
  const { tipoDoGap, tema, frase, texto } = lerItem(n.nome);
  const atual = nivelFinal(n);
  const alvo = n.esperado;
  const t = noMeio(tema);
  const prazo = (dias: number) => prazoEm(plano.inicio, plano.fim, dias);
  const base = { competencia: n.nome, prazo: plano.fim };

  if (tipoDoGap === "CONDUTA") {
    const hoje = atual != null && FREQUENCIA[atual] ? `Hoje acontece ${FREQUENCIA[atual]}. ` : "";
    return {
      ...base,
      titulo: `${maiuscula(t)}: deixar de acontecer`,
      indicador: `${hoje}Meta: nenhuma vez no último mês do plano, confirmado pelo líder.`,
      recursos: "Um combinado claro do que fazer no lugar, e o líder observando e dando retorno na hora.",
      relevancia: "É uma conduta que afeta o atendimento e o trabalho da equipe.",
      acoes: [
        {
          tipo: "TROCA",
          titulo: `Conversar com o líder sobre por que acontece (${t}) e combinar o que fazer no lugar`,
          responsavel: "Líder",
          prazo: prazo(7),
        },
        {
          tipo: "FORMAL",
          titulo: `Relembrar a regra de ${t} e o motivo dela`,
          responsavel: "Líder",
          prazo: prazo(15),
        },
        {
          tipo: "PRATICA",
          titulo: `Anotar por 30 dias cada vez que acontecer (${t}) e o motivo`,
          responsavel: "Colaborador",
          prazo: prazo(45),
        },
      ],
    };
  }

  if (tipoDoGap === "TAREFA") {
    const aprender = atual == null || atual <= 1;
    return {
      ...base,
      titulo: frase ? `${maiuscula(t)}: ${frase}` : `Fazer sem ajuda: ${noMeio(texto)}`,
      indicador: aprender
        ? "Hoje ainda não faz. Meta: fazer sozinho(a) 3 vezes seguidas sem precisar de correção, conferido pelo líder."
        : "Hoje faz com ajuda. Meta: fazer sozinho(a) 3 vezes seguidas sem precisar de correção, conferido pelo líder.",
      recursos: "Uma colega que já faz a tarefa para ensinar, e o passo a passo por escrito.",
      relevancia: "É uma tarefa da função: fazendo sozinho(a), a equipe não depende de outra pessoa para ela.",
      acoes: [
        ...(aprender
          ? [
              {
                tipo: "FORMAL" as const,
                titulo: `Aprender o passo a passo de ${t} com quem já faz`,
                responsavel: "Líder",
                prazo: prazo(15),
              },
            ]
          : []),
        {
          tipo: "TROCA",
          titulo: `Fazer ${t} junto com uma colega, que acompanha e corrige`,
          responsavel: "Colaborador",
          prazo: prazo(aprender ? 30 : 15),
        },
        {
          tipo: "PRATICA",
          titulo: `Fazer ${t} sozinho(a) e mostrar ao líder`,
          responsavel: "Colaborador",
          prazo: prazo(60),
        },
      ],
    };
  }

  // Competência: técnica ou comportamental.
  const comportamental = n.tipo === "COMPORTAMENTAL";
  const deOnde = atual != null ? `Hoje: nota ${atual}. ` : "";
  const titulo = frase
    ? `${maiuscula(t)}: ${frase}`
    : atual == null
      ? `Desenvolver ${tema} até o nível ${alvo}`
      : `Levar ${tema} do nível ${atual} para o nível ${alvo}`;
  return {
    ...base,
    titulo,
    indicador: `${deOnde}Meta: nota ${alvo} na reavaliação, confirmada pelo líder, e 4 semanas seguidas sem precisar de correção nesse ponto.`,
    recursos: comportamental
      ? "Feedback do líder a cada 15 dias e o exemplo de uma colega que é referência nesse ponto."
      : "O padrão da função por escrito, uma colega que é referência para acompanhar e o retorno do líder.",
    relevancia: comportamental
      ? "É um comportamento esperado de toda a equipe e pesa na convivência e no atendimento."
      : "Faz parte do padrão da função e afeta direto o resultado da equipe.",
    acoes: comportamental
      ? [
          {
            tipo: "PRATICA",
            titulo: `Escolher um momento do dia para praticar ${t} e anotar como foi`,
            responsavel: "Colaborador",
            prazo: plano.fim,
          },
          {
            tipo: "TROCA",
            titulo: `Receber feedback do líder sobre ${t} a cada 15 dias`,
            responsavel: "Líder",
            prazo: prazo(15),
          },
          {
            tipo: "FORMAL",
            titulo: `Ler ou assistir um material curto sobre ${t}, indicado pelo RH`,
            responsavel: "RH",
            prazo: prazo(30),
          },
        ]
      : [
          {
            tipo: "FORMAL",
            titulo: `Rever com o líder o padrão de ${t}`,
            responsavel: "Líder",
            prazo: prazo(15),
          },
          {
            tipo: "TROCA",
            titulo: `Acompanhar uma colega que é referência em ${t} por 2 turnos`,
            responsavel: "Líder",
            prazo: prazo(30),
          },
          {
            tipo: "PRATICA",
            titulo: `Aplicar o padrão de ${t} todos os dias, com checagem do líder 1 vez por semana`,
            responsavel: "Colaborador",
            prazo: plano.fim,
          },
        ],
  };
}
