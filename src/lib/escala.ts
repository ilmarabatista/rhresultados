/**
 * A escala de trabalho da equipe, toda pura (sem banco), para testar.
 *
 * A empresa tem um horário de funcionamento (por padrão das 08h às 22h, todos
 * os dias) e uma lista de turnos (Abertura, Fechamento...). Cada pessoa, em
 * cada dia, está num turno, de folga, de férias ou de atestado. A tela mostra
 * a semana e aponta:
 *
 * - a cobertura: quantas pessoas há em cada hora aberta, e onde fica abaixo
 *   do mínimo que a empresa quer;
 * - o que a CLT não deixa: mais de 44h na semana (art. 7º, XIII, da
 *   Constituição), mais de 10h no dia (8h + 2h extras, art. 59), intervalo
 *   curto (art. 71), menos de 11h entre um dia e o outro (art. 66), sete dias
 *   seguidos sem folga (art. 67) e, no comércio, três domingos seguidos
 *   trabalhados (Lei 10.101/2000, art. 6º: a folga cai no domingo ao menos uma
 *   vez a cada três semanas).
 *
 * O sistema aponta; quem decide é o RH (convenção coletiva pode mudar regra).
 */

import { addDaysUTC, dateToDayKey, dayKeyToDate } from "./dates";

export type TipoDoDia = "TRABALHO" | "FOLGA" | "FERIAS" | "ATESTADO";

export type Turno = {
  id: string;
  nome: string;
  /** Minutos desde a meia-noite. */
  inicio: number;
  /** Minutos desde a meia-noite; passa de 1440 quando vira a noite. */
  fim: number;
  /** Minutos de intervalo dentro do turno (almoço/janta). */
  intervalo: number;
  cor: string;
};

export type DiaDaPessoa = {
  employeeId: string;
  /** "AAAA-MM-DD". */
  dia: string;
  tipo: TipoDoDia;
  turnoId: string | null;
  inicio: number | null;
  fim: number | null;
  intervalo: number;
};

/** Domingo (0) a sábado (6): [abre, fecha] em minutos, ou null quando não abre. */
export type Funcionamento = ([number, number] | null)[];

export const FUNCIONAMENTO_PADRAO: Funcionamento = Array.from({ length: 7 }, () => [480, 1320] as [number, number]);

export const NOME_DO_TIPO: Record<TipoDoDia, string> = {
  TRABALHO: "Trabalho",
  FOLGA: "Folga",
  FERIAS: "Férias",
  ATESTADO: "Atestado",
};

export const CORES_DE_TURNO = ["azul", "verde", "roxo", "laranja", "rosa", "cinza"] as const;

export const LIMITE_SEMANAL = 44 * 60;
export const LIMITE_DIARIO = 10 * 60;
export const DESCANSO_MINIMO = 11 * 60;

export const DIAS_CURTOS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ----------------------------------------------------------------- horas

export function relogio(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

/** 440 → "7h20"; 2640 → "44h". */
export function duracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "08:00", "8", "8h", "0800" → minutos. */
export function lerHora(texto: string): number | null {
  const t = texto.trim().toLowerCase().replace(/h$/, "").replace("h", ":");
  const m = /^(\d{1,2})(?::?(\d{2}))?$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2] ?? 0);
  if (h > 24 || min > 59 || (h === 24 && min > 0)) return null;
  return h * 60 + min;
}

/** Minutos trabalhados no dia (sem o intervalo). */
export function minutosDoDia(d: Pick<DiaDaPessoa, "tipo" | "inicio" | "fim" | "intervalo">): number {
  if (d.tipo !== "TRABALHO" || d.inicio == null || d.fim == null) return 0;
  return Math.max(0, d.fim - d.inicio - d.intervalo);
}

export function minutosDoTurno(t: Pick<Turno, "inicio" | "fim" | "intervalo">): number {
  return Math.max(0, t.fim - t.inicio - t.intervalo);
}

// ----------------------------------------------------------------- datas

/** A segunda-feira da semana do dia. */
export function segundaDaSemana(dia: string): string {
  const d = dayKeyToDate(dia);
  const dow = d.getUTCDay();
  return dateToDayKey(addDaysUTC(d, dow === 0 ? -6 : 1 - dow));
}

/** Os 7 dias, de segunda a domingo. */
export function diasDaSemana(segunda: string): string[] {
  const d = dayKeyToDate(segunda);
  return Array.from({ length: 7 }, (_, i) => dateToDayKey(addDaysUTC(d, i)));
}

export function somarDias(dia: string, n: number): string {
  return dateToDayKey(addDaysUTC(dayKeyToDate(dia), n));
}

export function diaDaSemana(dia: string): number {
  return dayKeyToDate(dia).getUTCDay();
}

/** "03/11" */
export function diaMes(dia: string): string {
  return `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
}

// ------------------------------------------------------------- validação

export function funcionamentoValido(valor: unknown): valor is Funcionamento {
  if (!Array.isArray(valor) || valor.length !== 7) return false;
  return valor.every(
    (d) =>
      d === null ||
      (Array.isArray(d) &&
        d.length === 2 &&
        Number.isInteger(d[0]) &&
        Number.isInteger(d[1]) &&
        d[0] >= 0 &&
        d[1] > d[0] &&
        d[1] <= 2880),
  );
}

/** Lê o funcionamento salvo; se vier estragado, volta ao padrão das 08h às 22h. */
export function lerFuncionamento(valor: unknown): Funcionamento {
  return funcionamentoValido(valor) ? valor : FUNCIONAMENTO_PADRAO;
}

/** Turnos sugeridos a partir do funcionamento: abrir, meio e fechar, de 7h20 (6×7h20 = 44h). */
export function turnosSugeridos(funcionamento: Funcionamento): Omit<Turno, "id">[] {
  const abertos = funcionamento.filter((d): d is [number, number] => d !== null);
  const abre = abertos.length ? Math.min(...abertos.map((d) => d[0])) : 480;
  const fecha = abertos.length ? Math.max(...abertos.map((d) => d[1])) : 1320;
  const jornada = 7 * 60 + 20 + 60; // 7h20 de trabalho + 1h de intervalo
  if (fecha - abre <= jornada) {
    return [{ nome: "Integral", inicio: abre, fim: fecha, intervalo: 60, cor: "azul" }];
  }
  const meio = Math.round(((abre + fecha) / 2 - jornada / 2) / 30) * 30;
  return [
    { nome: "Abertura", inicio: abre, fim: abre + jornada, intervalo: 60, cor: "azul" },
    { nome: "Intermediário", inicio: meio, fim: meio + jornada, intervalo: 60, cor: "roxo" },
    { nome: "Fechamento", inicio: fecha - jornada, fim: fecha, intervalo: 60, cor: "laranja" },
  ];
}

// -------------------------------------------------------------- cobertura

export type Faixa = { inicio: number; fim: number; pessoas: number };

/**
 * Quantas pessoas estão trabalhando em cada hora em que a empresa está aberta
 * no dia. O intervalo não entra (não se sabe a que horas cada um sai para
 * comer): por isso a tela avisa que o almoço precisa ser revezado.
 */
export function coberturaDoDia(dias: DiaDaPessoa[], aberto: [number, number] | null): Faixa[] {
  if (!aberto) return [];
  const [abre, fecha] = aberto;
  const faixas: Faixa[] = [];
  for (let h = abre; h < fecha; h += 60) {
    const fim = Math.min(h + 60, fecha);
    const pessoas = dias.filter(
      (d) => d.tipo === "TRABALHO" && d.inicio != null && d.fim != null && d.inicio < fim && d.fim > h,
    ).length;
    faixas.push({ inicio: h, fim, pessoas });
  }
  return faixas;
}

/** Junta as horas abaixo do mínimo em trechos: "08:00–10:00 (1 pessoa)". */
export function buracos(faixas: Faixa[], minimo: number): Faixa[] {
  const fora: Faixa[] = [];
  for (const f of faixas) {
    if (f.pessoas >= minimo) continue;
    const ultimo = fora.at(-1);
    if (ultimo && ultimo.fim === f.inicio && ultimo.pessoas === f.pessoas) ultimo.fim = f.fim;
    else fora.push({ ...f });
  }
  return fora;
}

// ---------------------------------------------------------------- alertas

export type Alerta = { employeeId: string; dia: string | null; texto: string };

/**
 * O que a escala da pessoa fere, na semana que começa em `segunda`. `dias`
 * pode trazer semanas anteriores: servem para o descanso entre a semana
 * passada e esta, os dias seguidos sem folga e os domingos.
 */
export function alertasDaPessoa(employeeId: string, segunda: string, dias: DiaDaPessoa[]): Alerta[] {
  const alertas: Alerta[] = [];
  const porDia = new Map(dias.filter((d) => d.employeeId === employeeId).map((d) => [d.dia, d]));
  const semana = diasDaSemana(segunda);
  const trabalha = (dia: string) => porDia.get(dia)?.tipo === "TRABALHO";

  const total = semana.reduce((s, dia) => s + (porDia.has(dia) ? minutosDoDia(porDia.get(dia)!) : 0), 0);
  if (total > LIMITE_SEMANAL) {
    alertas.push({ employeeId, dia: null, texto: `${duracao(total)} na semana, passa de 44h` });
  }

  for (const dia of semana) {
    const d = porDia.get(dia);
    if (!d || d.tipo !== "TRABALHO" || d.inicio == null || d.fim == null) continue;
    const trabalhado = minutosDoDia(d);
    if (trabalhado > LIMITE_DIARIO) {
      alertas.push({ employeeId, dia, texto: `${duracao(trabalhado)} no dia, passa de 10h` });
    }
    if (trabalhado > 6 * 60 && d.intervalo < 60) {
      alertas.push({ employeeId, dia, texto: "mais de 6h sem 1h de intervalo" });
    } else if (trabalhado > 4 * 60 && d.intervalo < 15) {
      alertas.push({ employeeId, dia, texto: "mais de 4h sem 15 min de intervalo" });
    }

    const ontem = porDia.get(somarDias(dia, -1));
    if (ontem && ontem.tipo === "TRABALHO" && ontem.fim != null) {
      const descanso = d.inicio + 1440 - ontem.fim;
      if (descanso < DESCANSO_MINIMO) {
        alertas.push({
          employeeId,
          dia,
          texto: `só ${duracao(Math.max(0, descanso))} de descanso desde ontem (mínimo 11h)`,
        });
      }
    }
  }

  // Sete dias seguidos de trabalho: aponta o 7º, se ele cai nesta semana.
  for (const dia of semana) {
    let seguidos = 0;
    for (let i = 0; i < 7 && trabalha(somarDias(dia, -i)); i++) seguidos++;
    if (seguidos === 7) {
      alertas.push({ employeeId, dia, texto: "7º dia seguido sem folga" });
      break;
    }
  }

  // Comércio: folga no domingo ao menos uma vez a cada três semanas.
  const domingo = semana[6];
  if ([0, 7, 14].every((n) => trabalha(somarDias(domingo, -n)))) {
    alertas.push({ employeeId, dia: domingo, texto: "3º domingo seguido trabalhando (a folga precisa cair num domingo)" });
  }

  return alertas;
}

// ------------------------------------------------------------- montar sozinha

export type PessoaParaGerar = {
  id: string;
  /** O turno de costume da pessoa (o mais usado nas últimas semanas), se tiver. */
  turnoId: string | null;
  /** Quantos domingos seguidos ela trabalhou até a semana passada. */
  domingosSeguidos: number;
};

/**
 * Monta a semana no esquema 6×1: cada pessoa fica no seu turno de costume e
 * ganha uma folga, espalhada para não deixar o mesmo turno vazio num dia.
 * Quem já trabalhou dois domingos seguidos folga no domingo. Dia em que a
 * empresa não abre é folga de todo mundo. Só preenche o que está vazio: o que
 * o RH já marcou na semana fica como está.
 */
export function gerarSemana({
  segunda,
  pessoas,
  turnos,
  funcionamento,
  jaMarcados,
}: {
  segunda: string;
  pessoas: PessoaParaGerar[];
  turnos: Turno[];
  funcionamento: Funcionamento;
  /** O que já está na semana (de qualquer pessoa). */
  jaMarcados: DiaDaPessoa[];
}): DiaDaPessoa[] {
  if (turnos.length === 0) return [];
  const semana = diasDaSemana(segunda);
  const marcado = new Set(jaMarcados.map((d) => `${d.employeeId}|${d.dia}`));
  const turnoPorId = new Map(turnos.map((t) => [t.id, t]));
  const abertos = semana.filter((dia) => funcionamento[diaDaSemana(dia)] !== null);

  // Folgas já marcadas contam para o equilíbrio: chave "turno|dia" e só "dia".
  const folgasNoDia = new Map<string, number>();
  const chave = (turnoId: string, dia: string) => `${turnoId}|${dia}`;
  const turnoDaPessoa = new Map<string, Turno>();

  // Quem não tem turno de costume é distribuído em rodízio, para equilibrar.
  const contagemPorTurno = new Map(turnos.map((t) => [t.id, 0]));
  for (const p of pessoas) {
    const t = p.turnoId ? turnoPorId.get(p.turnoId) : undefined;
    if (t) {
      turnoDaPessoa.set(p.id, t);
      contagemPorTurno.set(t.id, (contagemPorTurno.get(t.id) ?? 0) + 1);
    }
  }
  for (const p of pessoas) {
    if (turnoDaPessoa.has(p.id)) continue;
    const menor = [...turnos].sort((a, b) => (contagemPorTurno.get(a.id)! - contagemPorTurno.get(b.id)!))[0];
    turnoDaPessoa.set(p.id, menor);
    contagemPorTurno.set(menor.id, contagemPorTurno.get(menor.id)! + 1);
  }

  for (const d of jaMarcados) {
    if (d.tipo !== "FOLGA") continue;
    const t = turnoDaPessoa.get(d.employeeId);
    if (t) folgasNoDia.set(chave(t.id, d.dia), (folgasNoDia.get(chave(t.id, d.dia)) ?? 0) + 1);
    folgasNoDia.set(d.dia, (folgasNoDia.get(d.dia) ?? 0) + 1);
  }

  // Quem precisa do domingo vai primeiro, para não faltar vaga de folga nele.
  const ordem = [...pessoas].sort((a, b) => b.domingosSeguidos - a.domingosSeguidos);
  // Sábado e domingo costumam ser os dias mais cheios: só folga ali quem precisa
  // ou quando os outros dias já estão mais carregados.
  const peso = (dia: string) => (diaDaSemana(dia) === 6 || diaDaSemana(dia) === 0 ? 0.5 : 0);

  const novos: DiaDaPessoa[] = [];
  for (const p of ordem) {
    const turno = turnoDaPessoa.get(p.id)!;
    const livres = semana.filter((dia) => !marcado.has(`${p.id}|${dia}`));
    if (livres.length === 0) continue;

    const jaTemFolga = jaMarcados.some(
      (d) => d.employeeId === p.id && d.tipo !== "TRABALHO" && semana.includes(d.dia),
    );
    const fechados = semana.filter((dia) => !abertos.includes(dia));

    let folga: string | null = null;
    if (!jaTemFolga && fechados.length === 0) {
      const domingo = semana[6];
      if (p.domingosSeguidos >= 2 && livres.includes(domingo)) folga = domingo;
      else {
        const candidatos = livres.filter((dia) => abertos.includes(dia));
        // Primeiro não tirar dois do mesmo turno no mesmo dia; depois espalhar na semana.
        const custo = (dia: string) =>
          (folgasNoDia.get(chave(turno.id, dia)) ?? 0) * 10 + (folgasNoDia.get(dia) ?? 0) + peso(dia);
        candidatos.sort((a, b) => custo(a) - custo(b));
        folga = candidatos[0] ?? null;
      }
      if (folga) {
        folgasNoDia.set(chave(turno.id, folga), (folgasNoDia.get(chave(turno.id, folga)) ?? 0) + 1);
        folgasNoDia.set(folga, (folgasNoDia.get(folga) ?? 0) + 1);
      }
    }

    for (const dia of livres) {
      const fechado = !abertos.includes(dia);
      if (fechado || dia === folga) {
        novos.push({ employeeId: p.id, dia, tipo: "FOLGA", turnoId: null, inicio: null, fim: null, intervalo: 0 });
      } else {
        novos.push({
          employeeId: p.id,
          dia,
          tipo: "TRABALHO",
          turnoId: turno.id,
          inicio: turno.inicio,
          fim: turno.fim,
          intervalo: turno.intervalo,
        });
      }
    }
  }
  return novos;
}

/** O turno mais usado pela pessoa nos dias dados (para "turno de costume"). */
export function turnoDeCostume(employeeId: string, dias: DiaDaPessoa[]): string | null {
  const conta = new Map<string, number>();
  for (const d of dias) {
    if (d.employeeId !== employeeId || d.tipo !== "TRABALHO" || !d.turnoId) continue;
    conta.set(d.turnoId, (conta.get(d.turnoId) ?? 0) + 1);
  }
  let melhor: string | null = null;
  let max = 0;
  for (const [id, n] of conta) if (n > max) [melhor, max] = [id, n];
  return melhor;
}

/** Quantos domingos seguidos a pessoa trabalhou, contando para trás a partir de `domingo`. */
export function domingosSeguidos(employeeId: string, domingo: string, dias: DiaDaPessoa[]): number {
  const porDia = new Map(dias.filter((d) => d.employeeId === employeeId).map((d) => [d.dia, d.tipo]));
  let n = 0;
  while (porDia.get(somarDias(domingo, -7 * n)) === "TRABALHO") n++;
  return n;
}

// --------------------------------------------------------------- whatsapp

/** O que vai no grupo da equipe: um bloco por dia, com quem trabalha e quem folga. */
export function textoDaSemana({
  empresa,
  segunda,
  pessoas,
  dias,
  turnos,
}: {
  empresa: string;
  segunda: string;
  pessoas: { id: string; nome: string }[];
  dias: DiaDaPessoa[];
  turnos: Turno[];
}): string {
  const semana = diasDaSemana(segunda);
  const nomeDoTurno = new Map(turnos.map((t) => [t.id, t.nome]));
  const nome = new Map(pessoas.map((p) => [p.id, p.nome.split(" ")[0]]));
  const linhas = [`*Escala ${empresa}*`, `Semana de ${diaMes(semana[0])} a ${diaMes(semana[6])}`];

  for (const dia of semana) {
    const doDia = dias.filter((d) => d.dia === dia && nome.has(d.employeeId));
    if (doDia.length === 0) continue;
    linhas.push("", `*${DIAS_CURTOS[diaDaSemana(dia)]} ${diaMes(dia)}*`);
    const trabalho = doDia
      .filter((d) => d.tipo === "TRABALHO" && d.inicio != null && d.fim != null)
      .sort((a, b) => a.inicio! - b.inicio! || nome.get(a.employeeId)!.localeCompare(nome.get(b.employeeId)!));
    const grupos = new Map<string, string[]>();
    for (const d of trabalho) {
      const rotulo = `${relogio(d.inicio!)}–${relogio(d.fim!)}${d.turnoId && nomeDoTurno.get(d.turnoId) ? ` (${nomeDoTurno.get(d.turnoId)})` : ""}`;
      grupos.set(rotulo, [...(grupos.get(rotulo) ?? []), nome.get(d.employeeId)!]);
    }
    for (const [rotulo, nomes] of grupos) linhas.push(`${rotulo}: ${nomes.join(", ")}`);
    for (const tipo of ["FOLGA", "FERIAS", "ATESTADO"] as const) {
      const nomes = doDia.filter((d) => d.tipo === tipo).map((d) => nome.get(d.employeeId)!);
      if (nomes.length) linhas.push(`${NOME_DO_TIPO[tipo]}: ${nomes.sort().join(", ")}`);
    }
  }
  return linhas.join("\n");
}
