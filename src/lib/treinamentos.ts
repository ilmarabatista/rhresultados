/**
 * Treinamento e desenvolvimento: as regras, sem banco, para serem testadas.
 *
 * O catálogo diz o que se ensina; a matriz, que cargo precisa de quê; a turma
 * é o treinamento acontecendo (uma reunião com dados a mais); e o histórico de
 * cada pessoa sai das turmas realizadas em que ela esteve presente. Nada disso
 * se digita duas vezes: pendência, histórico e totais do ano são calculados.
 */

import { semAcento } from "./text";

export const CATEGORIAS = ["TECNICO", "COMPORTAMENTAL", "INTEGRACAO", "SEGURANCA"] as const;
export type Categoria = (typeof CATEGORIAS)[number];

export const ROTULO_DA_CATEGORIA: Record<Categoria, string> = {
  TECNICO: "Técnico",
  COMPORTAMENTAL: "Comportamental",
  INTEGRACAO: "Integração",
  SEGURANCA: "Segurança e normas",
};

export function lerCategoria(valor: string): Categoria {
  return (CATEGORIAS as readonly string[]).includes(valor) ? (valor as Categoria) : "TECNICO";
}

export const MODALIDADES = ["INTERNO", "EXTERNO"] as const;
export type Modalidade = (typeof MODALIDADES)[number];

export function lerModalidade(valor: string): Modalidade {
  return valor === "EXTERNO" ? "EXTERNO" : "INTERNO";
}

/** A situação da turma, como no planejamento anual (PAT). */
export type SituacaoDaTurma = "PROGRAMADO" | "REALIZADO" | "JUSTIFICADO";

export const ROTULO_DA_TURMA: Record<SituacaoDaTurma, string> = {
  PROGRAMADO: "Programado",
  REALIZADO: "Realizado",
  JUSTIFICADO: "Justificado",
};

/**
 * Realizado é a reunião encerrada; justificado é a que não aconteceu e teve o
 * motivo escrito; o resto está programado.
 */
export function situacaoDaTurma(t: { statusDaReuniao: string; justificativa: string | null }): SituacaoDaTurma {
  if (t.statusDaReuniao === "REALIZADA") return "REALIZADO";
  if (t.justificativa && t.justificativa.trim()) return "JUSTIFICADO";
  return "PROGRAMADO";
}

/**
 * "2,5", "2.5", "2h30", "1:30" ou "90min" em horas. Vazio ou ilegível é nulo.
 */
export function lerHoras(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return null;
  let m = t.match(/^(\d+)(?:h|:)(\d{1,2})?(?:min)?$/);
  if (m) return Number(m[1]) + Number(m[2] ?? 0) / 60;
  m = t.match(/^(\d+)min$/);
  if (m) return Number(m[1]) / 60;
  m = t.match(/^(\d+)(?:[.,](\d+))?h?$/);
  if (m) return Number(`${m[1]}.${m[2] ?? 0}`);
  return null;
}

/** 2.5 → "2h30"; 3 → "3h". */
export function escreverHoras(horas: number | null | undefined): string {
  if (horas == null || !Number.isFinite(horas)) return "—";
  const minutos = Math.round(horas * 60);
  const h = Math.floor(minutos / 60);
  const min = minutos % 60;
  return min ? `${h}h${String(min).padStart(2, "0")}` : `${h}h`;
}

/** "1.234,50" → 1234.5; "R$ 300" → 300. Vazio é nulo. */
export function lerDinheiro(texto: string): number | null {
  const t = texto.replace(/[^\d,.-]/g, "");
  if (!t) return null;
  // Com vírgula, ela é a dos centavos e os pontos são de milhar.
  const n = t.includes(",") ? Number(t.replace(/\./g, "").replace(",", ".")) : Number(t);
  return Number.isFinite(n) ? n : null;
}

export function escreverDinheiro(valor: number | null | undefined): string {
  if (valor == null) return "—";
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** "DP-01 · Admissão", ou só o nome quando não há código. */
export function nomeDoTreinamento(t: { codigo: string | null; nome: string }): string {
  return t.codigo ? `${t.codigo} · ${t.nome}` : t.nome;
}

/** O nome do cargo como deve ser guardado: sem espaço sobrando. */
export function limparNomeDoCargo(nome: string): string {
  return nome.replace(/\s+/g, " ").trim();
}

/** Compara nomes de cargo sem acento e sem caixa: "Gerente de RH" = "gerente de rh". */
export function mesmoCargo(a: string, b: string): boolean {
  const n = (s: string) => semAcento(limparNomeDoCargo(s)).toLowerCase();
  return n(a) === n(b);
}

// ------------------------------------------------------------- pendências

export type Pessoa = { id: string; nome: string; cargoId: string | null };
/** Quem fez o quê: o id da pessoa e o do treinamento, de turma realizada com presença. */
export type Feito = { employeeId: string; treinamentoId: string };

/**
 * O que cada pessoa ainda deve, pela matriz: os treinamentos do cargo dela que
 * ela não fez em nenhuma turma realizada.
 */
export function pendencias(
  pessoas: Pessoa[],
  matriz: Map<string, string[]>,
  feitos: Feito[],
): Map<string, string[]> {
  const fez = new Set(feitos.map((f) => `${f.employeeId}:${f.treinamentoId}`));
  const resultado = new Map<string, string[]>();
  for (const p of pessoas) {
    const exigidos = p.cargoId ? (matriz.get(p.cargoId) ?? []) : [];
    resultado.set(
      p.id,
      exigidos.filter((t) => !fez.has(`${p.id}:${t}`)),
    );
  }
  return resultado;
}

/**
 * A matriz como "cargo → treinamentos que ele pede", a partir das marcas
 * (treinamento, cargo). Treinamento fora de uso não entra.
 */
export function matrizPorCargo(
  marcas: { treinamentoId: string; cargoId: string }[],
  ativos: Set<string>,
): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const { treinamentoId, cargoId } of marcas) {
    if (!ativos.has(treinamentoId)) continue;
    const lista = m.get(cargoId) ?? [];
    lista.push(treinamentoId);
    m.set(cargoId, lista);
  }
  return m;
}

// ------------------------------------------------------- planejamento anual

export type TurmaDoAno = {
  /** 1 a 12: o mês do dia marcado, ou do mês previsto. Nulo: sem mês. */
  mes: number | null;
  situacao: SituacaoDaTurma;
  horas: number | null;
  investimento: number | null;
  convocados: number;
  presentes: number;
};

export type Totais = {
  turmas: number;
  horas: number;
  investimento: number;
  /** Horas de treinamento somadas por pessoa: horas × presentes (ou convocados, no programado). */
  horasPessoa: number;
  pessoas: number;
};

const vazio = (): Totais => ({ turmas: 0, horas: 0, investimento: 0, horasPessoa: 0, pessoas: 0 });

/**
 * Programado × realizado do ano, como no rodapé do PAT. O programado conta
 * tudo o que foi planejado (inclusive o que depois foi realizado ou
 * justificado); o realizado, só as turmas encerradas.
 */
export function totaisDoAno(turmas: TurmaDoAno[]): { programado: Totais; realizado: Totais; justificadas: number } {
  const programado = vazio();
  const realizado = vazio();
  let justificadas = 0;
  for (const t of turmas) {
    const horas = t.horas ?? 0;
    programado.turmas++;
    programado.horas += horas;
    programado.investimento += t.investimento ?? 0;
    programado.pessoas += t.convocados;
    programado.horasPessoa += horas * t.convocados;
    if (t.situacao === "REALIZADO") {
      realizado.turmas++;
      realizado.horas += horas;
      realizado.investimento += t.investimento ?? 0;
      realizado.pessoas += t.presentes;
      realizado.horasPessoa += horas * t.presentes;
    }
    if (t.situacao === "JUSTIFICADO") justificadas++;
  }
  return { programado, realizado, justificadas };
}

/** Quanto do programado foi realizado, em %, sem contar as justificadas. */
export function cumprimento(turmas: TurmaDoAno[]): number | null {
  const devidas = turmas.filter((t) => t.situacao !== "JUSTIFICADO").length;
  if (devidas === 0) return null;
  return Math.round((turmas.filter((t) => t.situacao === "REALIZADO").length / devidas) * 100);
}

export const MESES_CURTOS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

// ------------------------------------------------------------- integração

/**
 * O checklist de integração que a empresa começa tendo, tirado do modelo de
 * T&D da consultoria. Cada empresa edita o seu.
 */
export const INTEGRACAO_PADRAO = [
  "Organizar a agenda semanal de treinamentos",
  "Preparar a sala/ambiente da integração",
  "Fazer a apresentação de integração",
  "Entregar a Política de Segurança",
  "Entregar o Código de Ética",
  "Entregar a Descrição de Cargo",
  "Entregar os brindes",
  "Entregar a programação de treinamento funcional",
  "Enviar e-mail de boas-vindas ao colaborador",
  "Enviar comunicado de boas-vindas para a empresa",
];
