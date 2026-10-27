import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularDia,
  calcularDias,
  cargaSemanal,
  HORARIO_PADRAO,
  horarioEscrito,
  horarioValido,
  lerHorario,
  porSemanas,
  type RegrasPonto,
} from "../src/lib/calculo";

const regras: RegrasPonto = { regime: "BANCO_DE_HORAS", horario: HORARIO_PADRAO, tolerancia: 10, intervaloMinimo: 60 };
const h = (t: string) => {
  const [a, b] = t.split(":").map(Number);
  return a * 60 + b;
};
// 2026-10-19 é segunda; 2026-10-18 é domingo; 2026-10-17 é sábado.
const SEG = "2026-10-19";

test("o horário padrão é 40h semanais", () => {
  assert.equal(cargaSemanal(HORARIO_PADRAO), 40 * 60);
});

test("dia cumprido no horário não tem extra nem débito", () => {
  const d = calcularDia({ dia: SEG, batidas: [h("08:00"), h("12:00"), h("13:00"), h("17:00")] }, regras);
  assert.equal(d.previsto, 480);
  assert.equal(d.trabalhado, 480);
  assert.equal(d.extras, 0);
  assert.equal(d.debito, 0);
  assert.deepEqual(d.alertas, []);
});

test("o que passa do horário é extra", () => {
  const d = calcularDia({ dia: SEG, batidas: [h("08:00"), h("12:00"), h("13:00"), h("18:30")] }, regras);
  assert.equal(d.extras, 90);
  assert.equal(d.extras50, 90);
  assert.equal(d.debito, 0);
  assert.equal(d.saldo, 90);
});

test("chegar atrasado e sair depois dá atraso e extra separados", () => {
  const d = calcularDia({ dia: SEG, batidas: [h("08:30"), h("12:00"), h("13:00"), h("17:30")] }, regras);
  assert.equal(d.trabalhado, 480);
  assert.equal(d.extras, 30);
  assert.equal(d.debito, 30);
  assert.equal(d.saldo, 0);
});

test("variação dentro da tolerância não conta", () => {
  const d = calcularDia({ dia: SEG, batidas: [h("08:04"), h("12:00"), h("13:00"), h("17:05")] }, regras);
  assert.equal(d.extras, 0);
  assert.equal(d.debito, 0);
});

test("passou da tolerância conta tudo", () => {
  const d = calcularDia({ dia: SEG, batidas: [h("08:12"), h("12:00"), h("13:00"), h("17:00")] }, regras);
  assert.equal(d.debito, 12);
});

test("sábado sem horário: tudo é extra a 50%", () => {
  const d = calcularDia({ dia: "2026-10-17", batidas: [h("08:00"), h("12:00")] }, regras);
  assert.equal(d.previsto, 0);
  assert.equal(d.extras50, 240);
  assert.equal(d.extras100, 0);
});

test("domingo e feriado trabalhados pagam em dobro", () => {
  const dom = calcularDia({ dia: "2026-10-18", batidas: [h("08:00"), h("12:00")] }, regras);
  assert.equal(dom.extras100, 240);
  const feriado = calcularDia({ dia: SEG, batidas: [h("08:00"), h("12:00")], ocorrencia: "FERIADO" }, regras);
  assert.equal(feriado.previsto, 0);
  assert.equal(feriado.extras100, 240);
});

test("falta, abono e marcação ímpar", () => {
  const falta = calcularDia({ dia: SEG, batidas: [] }, regras);
  assert.equal(falta.falta, true);
  assert.equal(falta.debito, 480);
  const abono = calcularDia({ dia: SEG, batidas: [], ocorrencia: "ATESTADO" }, regras);
  assert.equal(abono.abonado, 480);
  assert.equal(abono.debito, 0);
  const impar = calcularDia({ dia: SEG, batidas: [h("08:00"), h("12:00"), h("13:00")] }, regras);
  assert.ok(impar.alertas.some((a) => a.startsWith("Marcação ímpar")));
  assert.equal(impar.saldo, 0);
});

test("dia em andamento não cobra nada", () => {
  const d = calcularDia({ dia: SEG, batidas: [h("08:00")], emAndamento: true }, regras);
  assert.deepEqual(d.alertas, []);
  assert.equal(d.debito, 0);
});

test("descanso entre jornadas menor que 11h vira alerta", () => {
  const dias = calcularDias(
    [
      { dia: SEG, batidas: [h("08:00"), h("12:00"), h("13:00"), h("23:00")] },
      { dia: "2026-10-20", batidas: [h("08:00"), h("12:00"), h("13:00"), h("17:00")] },
    ],
    regras,
  );
  assert.ok(dias[1].alertas.some((a) => a.startsWith("Descanso")));
});

test("lerHorario entende os jeitos comuns de escrever", () => {
  assert.deepEqual(lerHorario("08:00-12:00 13:00-17:00"), [[480, 720], [780, 1020]]);
  assert.deepEqual(lerHorario("8 às 12 e 13 às 17"), [[480, 720], [780, 1020]]);
  assert.deepEqual(lerHorario("07:30 - 11:30, 12:30 - 16:48"), [[450, 690], [750, 1008]]);
  assert.deepEqual(lerHorario(""), []);
  assert.deepEqual(lerHorario("22:00-02:00 03:00-06:00"), [[1320, 1560], [1620, 1800]]);
  assert.equal(typeof lerHorario("abc"), "string");
  assert.equal(typeof lerHorario("06:00-20:00 20:30-23:59"), "string");
});

test("horarioEscrito e horarioValido", () => {
  assert.equal(horarioEscrito([[480, 720], [780, 1020]]), "08:00–12:00 13:00–17:00");
  assert.ok(horarioValido(HORARIO_PADRAO));
  assert.ok(!horarioValido([[]]));
  assert.ok(!horarioValido([[], [[720, 480]], [], [], [], [], []]));
});

test("banco por semana: sem tolerância no dia, o que sobra num dia cobre o que falta no outro", () => {
  const semanal: RegrasPonto = { ...regras, porSemana: true };
  // Segunda 8 min a mais, terça 8 min a menos: no dia a dia a tolerância some com os dois.
  const seg = calcularDia({ dia: SEG, batidas: [h("08:00"), h("12:00"), h("13:00"), h("17:08")] }, semanal);
  const ter = calcularDia({ dia: "2026-10-20", batidas: [h("08:08"), h("12:00"), h("13:00"), h("17:00")] }, semanal);
  assert.equal(seg.saldo, 8);
  assert.equal(ter.saldo, -8);
  assert.equal(calcularDia({ dia: SEG, batidas: [h("08:00"), h("12:00"), h("13:00"), h("17:08")] }, regras).saldo, 0);
});

test("banco por semana: semana de 42h dá 2h de crédito, com feriado tirando o dia da meta", () => {
  const semanal: RegrasPonto = { ...regras, porSemana: true };
  const dias = calcularDias(
    [
      { dia: "2026-10-18", batidas: [] },
      { dia: SEG, batidas: [h("08:00"), h("12:00"), h("13:00"), h("18:00")] },
      { dia: "2026-10-20", batidas: [h("08:00"), h("12:00"), h("13:00"), h("18:00")] },
      { dia: "2026-10-21", batidas: [], ocorrencia: "FERIADO" },
      { dia: "2026-10-22", batidas: [h("08:00"), h("12:00"), h("13:00"), h("17:00")] },
      { dia: "2026-10-23", batidas: [h("08:00"), h("12:00"), h("13:00"), h("17:00")] },
      { dia: "2026-10-24", batidas: [] },
      { dia: "2026-10-25", batidas: [h("08:00"), h("12:00")] },
    ],
    semanal,
  );
  const semanas = porSemanas(dias);
  assert.equal(semanas.length, 2);
  assert.equal(semanas[0].inicio, "2026-10-18");
  assert.equal(semanas[0].totais.previsto, 32 * 60);
  assert.equal(semanas[0].totais.trabalhado, 34 * 60);
  assert.equal(semanas[0].totais.saldo, 120);
  assert.equal(semanas[1].inicio, "2026-10-25");
});
