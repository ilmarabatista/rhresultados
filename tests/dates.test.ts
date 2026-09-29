import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDaysUTC,
  dateToDayKey,
  dayKeyToDate,
  formatDayMonth,
  formatDayMonthUTC,
  formatFullDate,
  formatMoment,
  momentDayKey,
} from "../src/lib/dates";

test("dayKeyToDate cria a data em UTC 00:00", () => {
  const d = dayKeyToDate("2026-09-07");
  assert.equal(d.toISOString(), "2026-09-07T00:00:00.000Z");
});

test("dateToDayKey e dayKeyToDate são inversos", () => {
  for (const chave of ["2026-01-01", "2026-09-07", "2026-12-31"]) {
    assert.equal(dateToDayKey(dayKeyToDate(chave)), chave);
  }
});

test("dateToDayKey preenche mês e dia com zero à esquerda", () => {
  assert.equal(dateToDayKey(new Date("2026-03-05T00:00:00.000Z")), "2026-03-05");
});

test("dateToDayKey lê os campos UTC, não o fuso local", () => {
  // No Brasil (UTC-3) esta data é 06/09 às 21h local, mas o dia é 07/09.
  const d = new Date("2026-09-07T00:00:00.000Z");
  assert.equal(dateToDayKey(d), "2026-09-07");
});

test("addDaysUTC atravessa a virada de mês", () => {
  assert.equal(
    dateToDayKey(addDaysUTC(dayKeyToDate("2026-09-30"), 1)),
    "2026-10-01",
  );
});

test("addDaysUTC atravessa a virada de ano e aceita negativo", () => {
  assert.equal(
    dateToDayKey(addDaysUTC(dayKeyToDate("2026-12-31"), 1)),
    "2027-01-01",
  );
  assert.equal(
    dateToDayKey(addDaysUTC(dayKeyToDate("2026-01-01"), -1)),
    "2025-12-31",
  );
});

test("addDaysUTC acerta o 29 de fevereiro de ano bissexto", () => {
  assert.equal(
    dateToDayKey(addDaysUTC(dayKeyToDate("2028-02-28"), 1)),
    "2028-02-29",
  );
  assert.equal(
    dateToDayKey(addDaysUTC(dayKeyToDate("2027-02-28"), 1)),
    "2027-03-01",
  );
});

test("addDaysUTC não altera a data recebida", () => {
  const original = dayKeyToDate("2026-09-07");
  addDaysUTC(original, 10);
  assert.equal(dateToDayKey(original), "2026-09-07");
});

test("formatFullDate escreve no formato brasileiro", () => {
  assert.equal(formatFullDate(dayKeyToDate("2026-09-07")), "07/09/2026");
  assert.equal(formatFullDate(null), "—");
  assert.equal(formatFullDate(undefined), "—");
});

// Um instante às 21h de Brasília é meia-noite do dia seguinte em UTC. Ler no
// fuso do escritório é o que impede a etapa de aparecer no dia errado.
test("formatMoment lê o instante no fuso de Brasília", () => {
  const noite = new Date("2026-09-07T23:30:00-03:00");
  assert.equal(formatMoment(noite), "07/09/2026");
  assert.equal(formatDayMonth(noite), "07/09");
  assert.equal(momentDayKey(noite), "2026-09-07");
});

test("formatMoment aceita vazio", () => {
  assert.equal(formatMoment(null), "—");
  assert.equal(formatDayMonth(undefined), "—");
});

test("momentDayKey agrupa o mesmo dia mesmo em horas distantes", () => {
  const manha = new Date("2026-09-07T08:00:00-03:00");
  const noite = new Date("2026-09-07T22:00:00-03:00");
  assert.equal(momentDayKey(manha), momentDayKey(noite));
});

// Data de agenda é UTC 00:00: lida no fuso de Brasília cairia no dia anterior.
test("formatDayMonthUTC lê a data de agenda em UTC", () => {
  assert.equal(formatDayMonthUTC(dayKeyToDate("2026-09-10")), "10/09");
  assert.equal(formatDayMonthUTC(null), "—");
});
