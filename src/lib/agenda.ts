/**
 * Lógica da agenda, sem banco e sem React — é o que os testes cobrem.
 *
 * Toda data trafega como "AAAA-MM-DD" e toda hora como "HH:MM". Guardar hora
 * como texto evita o problema clássico de fuso: 09:00 na empresa é 09:00 em
 * qualquer servidor, inclusive quando o sistema sair daqui para a Vercel.
 */

import { addDaysUTC, dateToDayKey, dayKeyToDate } from "./dates";
import { linhasComoItens } from "./text";

export const DIAS_SEMANA = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"];

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

export type DiaGrade = {
  /** "AAAA-MM-DD". */
  key: string;
  /** Número do dia, para exibir. */
  dia: number;
  /** Falso para os dias do mês anterior ou seguinte que completam a semana. */
  doMes: boolean;
  /** Sábado ou domingo. */
  fimDeSemana: boolean;
};

/** "2026-09" a partir de ano e mês (mês 1-12). */
export function mesKey(ano: number, mes: number): string {
  return `${ano}-${String(mes).padStart(2, "0")}`;
}

/** Lê "2026-09"; devolve null quando o texto não serve. */
export function lerMesKey(valor: string | null | undefined): {
  ano: number;
  mes: number;
} | null {
  if (!valor || !/^\d{4}-\d{2}$/.test(valor)) return null;
  const [ano, mes] = valor.split("-").map(Number);
  if (mes < 1 || mes > 12 || ano < 2000 || ano > 2100) return null;
  return { ano, mes };
}

export function nomeDoMes(ano: number, mes: number): string {
  return `${MESES[mes - 1]} de ${ano}`;
}

/** O mês anterior e o seguinte, para os botões de navegação. */
export function mesVizinho(ano: number, mes: number, passo: number) {
  const total = ano * 12 + (mes - 1) + passo;
  return { ano: Math.floor(total / 12), mes: (total % 12) + 1 };
}

/**
 * A grade do mês em semanas de segunda a domingo, completando as bordas com
 * os dias vizinhos — é como um calendário de parede se parece.
 */
export function gradeDoMes(ano: number, mes: number): DiaGrade[][] {
  const primeiro = new Date(Date.UTC(ano, mes - 1, 1));
  // getUTCDay(): 0 = domingo. Queremos a semana começando na segunda.
  const recuo = (primeiro.getUTCDay() + 6) % 7;

  const inicio = new Date(primeiro.getTime());
  inicio.setUTCDate(inicio.getUTCDate() - recuo);

  const semanas: DiaGrade[][] = [];
  const cursor = new Date(inicio.getTime());

  // Seis semanas cobrem qualquer mês; a última cai fora quando não é usada.
  for (let s = 0; s < 6; s++) {
    const semana: DiaGrade[] = [];
    for (let d = 0; d < 7; d++) {
      semana.push({
        key: dateToDayKey(cursor),
        dia: cursor.getUTCDate(),
        doMes: cursor.getUTCMonth() === mes - 1,
        fimDeSemana: d >= 5,
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    if (semana.some((d) => d.doMes)) semanas.push(semana);
  }

  return semanas;
}

/** Primeiro e último instante do mês, para consultar o banco. */
export function intervaloDoMes(ano: number, mes: number) {
  const de = new Date(Date.UTC(ano, mes - 1, 1));
  const ate = new Date(Date.UTC(ano, mes, 1));
  return { de, ate };
}

const HORA = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function horaValida(valor: string): boolean {
  return HORA.test(valor);
}

/** Minutos desde a meia-noite, ou null se a hora não for válida. */
export function emMinutos(valor: string): number | null {
  const m = valor.match(HORA);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Confere o par de horas de um agendamento.
 * Devolve a mensagem de erro, ou null quando está tudo certo.
 */
export function conferirHorario(
  inicio: string,
  fim: string | null | undefined,
): string | null {
  if (!horaValida(inicio)) return "Informe a hora de início no formato 09:00.";
  if (!fim) return null;
  if (!horaValida(fim)) return "Informe a hora de término no formato 12:00.";

  const a = emMinutos(inicio)!;
  const b = emMinutos(fim)!;
  if (b <= a) return "A hora de término precisa ser depois da de início.";
  return null;
}

/** "09:00 – 12:00", ou só "09:00" quando não há término. */
export function faixaHoraria(
  inicio: string,
  fim: string | null | undefined,
): string {
  return fim ? `${inicio} – ${fim}` : inicio;
}

/**
 * Agrupa visitas por dia, mantendo a ordem por hora dentro de cada dia.
 * A chave é "AAAA-MM-DD", igual à da grade.
 */
export function agruparPorDia<T extends { date: Date; startTime: string }>(
  visitas: T[],
): Map<string, T[]> {
  const mapa = new Map<string, T[]>();

  for (const v of visitas) {
    const key = dateToDayKey(v.date);
    const lista = mapa.get(key);
    if (lista) lista.push(v);
    else mapa.set(key, [v]);
  }

  for (const lista of mapa.values()) {
    lista.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return mapa;
}

/** Data válida no formato "AAAA-MM-DD"? */
export function diaValido(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false;
  const d = dayKeyToDate(valor);
  return !Number.isNaN(d.getTime()) && dateToDayKey(d) === valor;
}

// ------------------------------------------------------------ visão semanal

/** A faixa de horas que a semana mostra: das 08h às 22h. */
export const HORA_INICIO = 8;
export const HORA_FIM = 22;

const MINUTO_INICIO = HORA_INICIO * 60;
const MINUTO_FIM = HORA_FIM * 60;
const JANELA = MINUTO_FIM - MINUTO_INICIO;

/** As horas cheias que viram linha na grade: 08:00 … 22:00. */
export function horasDaGrade(): string[] {
  const horas: string[] = [];
  for (let h = HORA_INICIO; h <= HORA_FIM; h++) {
    horas.push(`${String(h).padStart(2, "0")}:00`);
  }
  return horas;
}

/** A segunda-feira da semana em que o dia cai. */
export function inicioDaSemana(dia: string): string {
  const d = dayKeyToDate(dia);
  const recuo = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - recuo);
  return dateToDayKey(d);
}

/** Os sete dias da semana que começa na segunda informada. */
export function diasDaSemana(segunda: string): DiaGrade[] {
  const cursor = dayKeyToDate(segunda);
  const dias: DiaGrade[] = [];

  for (let i = 0; i < 7; i++) {
    dias.push({
      key: dateToDayKey(cursor),
      dia: cursor.getUTCDate(),
      doMes: true,
      fimDeSemana: i >= 5,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return dias;
}

/** Primeiro e último instante da semana, para consultar o banco. */
export function intervaloDaSemana(segunda: string) {
  const de = dayKeyToDate(segunda);
  const ate = new Date(de.getTime());
  ate.setUTCDate(ate.getUTCDate() + 7);
  return { de, ate };
}

/** A semana anterior ou a seguinte. */
export function semanaVizinha(segunda: string, passo: number): string {
  const d = dayKeyToDate(segunda);
  d.setUTCDate(d.getUTCDate() + passo * 7);
  return dateToDayKey(d);
}

/** "7 a 13 de setembro de 2026", encurtando quando a semana vira o mês. */
export function rotuloDaSemana(segunda: string): string {
  const de = dayKeyToDate(segunda);
  const ate = dayKeyToDate(segunda);
  ate.setUTCDate(ate.getUTCDate() + 6);

  const mesDe = MESES[de.getUTCMonth()];
  const mesAte = MESES[ate.getUTCMonth()];

  if (de.getUTCFullYear() !== ate.getUTCFullYear()) {
    return `${de.getUTCDate()} de ${mesDe} de ${de.getUTCFullYear()} a ${ate.getUTCDate()} de ${mesAte} de ${ate.getUTCFullYear()}`;
  }
  if (mesDe !== mesAte) {
    return `${de.getUTCDate()} de ${mesDe} a ${ate.getUTCDate()} de ${mesAte} de ${ate.getUTCFullYear()}`;
  }
  return `${de.getUTCDate()} a ${ate.getUTCDate()} de ${mesDe} de ${de.getUTCFullYear()}`;
}

export type Faixa = {
  /** Distância do topo da grade, em porcentagem. */
  topo: number;
  /** Altura do bloco, em porcentagem. */
  altura: number;
  /** O compromisso começa antes das 08h ou termina depois das 22h. */
  cortado: boolean;
};

/**
 * Onde o compromisso entra na grade de 08h às 22h.
 *
 * Quem começa antes ou termina depois é aparado na borda e marcado como
 * `cortado`, para a tela avisar em vez de esconder. Quem cai inteiramente
 * fora da faixa devolve null: aparece na tira de "fora do horário".
 */
export function faixaNaGrade(
  inicio: string,
  fim: string | null | undefined,
): Faixa | null {
  const comeco = emMinutos(inicio);
  if (comeco === null) return null;

  // Sem término, o bloco ganha meia hora só para ter altura visível.
  const term = fim ? emMinutos(fim) : null;
  const termino = term !== null && term > comeco ? term : comeco + 30;

  if (termino <= MINUTO_INICIO || comeco >= MINUTO_FIM) return null;

  const de = Math.max(comeco, MINUTO_INICIO);
  const ate = Math.min(termino, MINUTO_FIM);

  return {
    topo: ((de - MINUTO_INICIO) / JANELA) * 100,
    altura: ((ate - de) / JANELA) * 100,
    cortado: comeco < MINUTO_INICIO || termino > MINUTO_FIM,
  };
}

/**
 * Distribui em colunas os compromissos que se sobrepõem no mesmo dia, para
 * um não cobrir o outro. Devolve, para cada um, a coluna e quantas colunas o
 * seu grupo ocupa.
 */
export function colunasDoDia<T extends { startTime: string; endTime: string | null }>(
  visitas: T[],
): { visita: T; coluna: number; colunas: number }[] {
  const itens = visitas
    .map((v) => {
      const comeco = emMinutos(v.startTime) ?? 0;
      const fim = v.endTime ? emMinutos(v.endTime) : null;
      return {
        visita: v,
        comeco,
        termino: fim !== null && fim > comeco ? fim : comeco + 30,
      };
    })
    .sort((a, b) => a.comeco - b.comeco || a.termino - b.termino);

  const saida: { visita: T; coluna: number; colunas: number }[] = [];
  let grupo: typeof itens = [];
  let fimDoGrupo = -1;

  const fechar = () => {
    if (grupo.length === 0) return;

    const ocupadas: number[] = []; // fim de cada coluna do grupo
    const colunaDe = new Map<(typeof grupo)[number], number>();

    for (const item of grupo) {
      let c = ocupadas.findIndex((fim) => fim <= item.comeco);
      if (c === -1) {
        c = ocupadas.length;
        ocupadas.push(item.termino);
      } else {
        ocupadas[c] = item.termino;
      }
      colunaDe.set(item, c);
    }

    for (const item of grupo) {
      saida.push({
        visita: item.visita,
        coluna: colunaDe.get(item)!,
        colunas: ocupadas.length,
      });
    }

    grupo = [];
  };

  for (const item of itens) {
    if (grupo.length > 0 && item.comeco >= fimDoGrupo) fechar();
    grupo.push(item);
    fimDoGrupo = Math.max(fimDoGrupo, item.termino);
  }
  fechar();

  return saida;
}

/**
 * A hora seguinte, para o agendamento rápido de uma hora cheia.
 * Devolve null quando passaria da meia-noite.
 */
export function fimDaHora(inicio: string, horas = 1): string | null {
  const minutos = emMinutos(inicio);
  if (minutos === null) return null;

  const fim = minutos + horas * 60;
  if (fim > 24 * 60) return null;
  if (fim === 24 * 60) return "23:59";

  const h = Math.floor(fim / 60);
  const m = fim % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DIAS_POR_EXTENSO = [
  "segunda-feira",
  "terça-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sábado",
  "domingo",
];

/** "quarta-feira, 9 de setembro" — o cabeçalho da escolha rápida. */
export function rotuloDoDia(dia: string): string {
  const d = dayKeyToDate(dia);
  const semana = DIAS_POR_EXTENSO[(d.getUTCDay() + 6) % 7];
  return `${semana}, ${d.getUTCDate()} de ${MESES[d.getUTCMonth()]}`;
}

// ------------------------------------------------------------ recorrência

export type Frequencia =
  | "DIARIA"
  | "SEMANAL"
  | "QUINZENAL"
  | "MENSAL"
  | "BIMESTRAL"
  | "TRIMESTRAL"
  | "SEMESTRAL"
  | "ANUAL";

export const FREQUENCIAS: { valor: Frequencia; label: string }[] = [
  { valor: "DIARIA", label: "Todo dia" },
  { valor: "SEMANAL", label: "Toda semana" },
  { valor: "QUINZENAL", label: "A cada quinze dias" },
  { valor: "MENSAL", label: "Todo mês" },
  { valor: "BIMESTRAL", label: "A cada dois meses" },
  { valor: "TRIMESTRAL", label: "A cada três meses" },
  { valor: "SEMESTRAL", label: "A cada seis meses" },
  { valor: "ANUAL", label: "Uma vez por ano" },
];

/**
 * Os valores aceitos, na forma que a validação do formulário pede.
 *
 * O formulário da agenda oferecia as sete frequências e o servidor só aceitava
 * três: escolher "a cada dois meses" dava erro. Os dois lados leem daqui.
 */
export const VALORES_DE_FREQUENCIA = FREQUENCIAS.map((f) => f.valor) as [
  Frequencia,
  ...Frequencia[],
];

/** De quantos em quantos meses a frequência anda. Zero quando anda em dias. */
const PASSO_EM_MESES: Record<Frequencia, number> = {
  DIARIA: 0,
  SEMANAL: 0,
  QUINZENAL: 0,
  MENSAL: 1,
  BIMESTRAL: 2,
  TRIMESTRAL: 3,
  SEMESTRAL: 6,
  ANUAL: 12,
};

export function rotuloDaFrequencia(valor: string): string {
  return FREQUENCIAS.find((f) => f.valor === valor)?.label ?? valor;
}

/** Quantas repetições cabem numa série. */
export const MAXIMO_DE_REPETICOES = 52;

/**
 * As datas de uma série que se repete.
 *
 * Semanal e quinzenal andam em dias, que é exato. Mensal anda em mês e mantém
 * o dia — mas 31 de janeiro não existe em fevereiro, e nesse caso a data cai
 * no último dia do mês. Voltar para o dia 31 nos meses que o têm seria mais
 * "correto" no papel e imprevisível na prática: a série ficaria pulando de
 * dia. Aqui o dia escolhido é o teto, e ele se mantém quando cabe.
 */
export function datasDaSerie(
  inicio: string,
  frequencia: Frequencia,
  vezes: number,
): string[] {
  if (!diaValido(inicio)) return [];

  const total = Math.max(1, Math.min(vezes, MAXIMO_DE_REPETICOES));
  const base = dayKeyToDate(inicio);
  const diaEscolhido = base.getUTCDate();
  const datas: string[] = [];

  const passoEmMeses = PASSO_EM_MESES[frequencia];

  for (let i = 0; i < total; i++) {
    if (passoEmMeses > 0) {
      const alvo = new Date(
        Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + i * passoEmMeses, 1),
      );
      const ultimoDia = new Date(
        Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0),
      ).getUTCDate();

      datas.push(
        dateToDayKey(
          new Date(
            Date.UTC(
              alvo.getUTCFullYear(),
              alvo.getUTCMonth(),
              Math.min(diaEscolhido, ultimoDia),
            ),
          ),
        ),
      );
    } else {
      const passo = frequencia === "DIARIA" ? 1 : frequencia === "SEMANAL" ? 7 : 14;
      datas.push(dateToDayKey(addDaysUTC(base, i * passo)));
    }
  }

  return datas;
}

/** "3 de 8" para a ocorrência dentro da série. */
export function posicaoNaSerie(
  dia: string,
  datas: string[],
): { posicao: number; total: number } | null {
  const i = datas.indexOf(dia);
  if (i < 0) return null;
  return { posicao: i + 1, total: datas.length };
}

/**
 * A pauta digitada como uma linha por assunto.
 *
 * É a mesma leitura das etapas coladas de um documento, com teto. Tinha uma
 * cópia própria que apagava qualquer algarismo do começo da linha — e "8h de
 * treino" virava "h de treino".
 */
export function assuntosDaPauta(texto: string): string[] {
  return linhasComoItens(texto).slice(0, 30);
}
