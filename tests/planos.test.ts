import { test } from "node:test";
import assert from "node:assert/strict";
import { andamentoDoPlano, andamentoDosEncontros, datasDoPlano, estadoDoEncontro, lerTemas, proximaData } from "../src/lib/planos";

test("semanal e quinzenal andam 7 e 14 dias", () => {
  assert.deepEqual(datasDoPlano("2026-09-22", "SEMANAL", 3), ["2026-09-22", "2026-09-29", "2026-10-06"]);
  assert.deepEqual(datasDoPlano("2026-09-22", "QUINZENAL", 3), ["2026-09-22", "2026-10-06", "2026-10-20"]);
});

test("mensal fica no mesmo dia do mês, e volta a ele depois de um mês curto", () => {
  assert.deepEqual(datasDoPlano("2026-01-31", "MENSAL", 4), ["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  assert.equal(proximaData("2026-12-15", "MENSAL"), "2027-01-15");
});

test("sem data fixa deixa tudo a agendar", () => {
  assert.deepEqual(datasDoPlano("2026-09-22", "LIVRE", 2), [null, null]);
  assert.equal(proximaData("2026-09-22", "LIVRE"), null);
});

test("os temas colados perdem numeração e linhas vazias", () => {
  assert.deepEqual(lerTemas("1. Comunicação\n\n2) Feedback\n- Liderança\n• Metas"), ["Comunicação", "Feedback", "Liderança", "Metas"]);
});

test("andamento conta realizadas, a agendar e atrasadas; arquivada não conta", () => {
  const d = (k: string) => new Date(`${k}T00:00:00Z`);
  const a = andamentoDoPlano(
    [
      { status: "REALIZADA", date: d("2026-09-01") },
      { status: "AGENDADA", date: d("2026-09-10") },
      { status: "AGENDADA", date: d("2026-10-10") },
      { status: "AGENDADA", date: null },
      { status: "ARQUIVADA", date: d("2026-09-02") },
    ],
    "2026-09-19",
  );
  assert.deepEqual(a, { total: 4, realizadas: 1, agendadas: 2, aAgendar: 1, atrasadas: 1, percentual: 25 });
});

test("o encontro anda de planejado para agenda, reunião e realizado", () => {
  assert.equal(estadoDoEncontro({ visita: null, reuniao: null }), "PLANEJADO");
  assert.equal(estadoDoEncontro({ visita: { status: "AGENDADA" }, reuniao: null }), "NA_AGENDA");
  assert.equal(estadoDoEncontro({ visita: { status: "AGENDADA" }, reuniao: { status: "AGENDADA" } }), "EM_REUNIAO");
  assert.equal(estadoDoEncontro({ visita: { status: "REALIZADA" }, reuniao: null }), "REALIZADO");
  assert.equal(estadoDoEncontro({ visita: null, reuniao: { status: "REALIZADA" } }), "REALIZADO");
});

test("encontro em preparação ainda não conta como reunião", () => {
  assert.equal(estadoDoEncontro({ visita: null, reuniao: { status: "PLANEJADA" } }), "PLANEJADO");
  assert.equal(estadoDoEncontro({ visita: { status: "AGENDADA" }, reuniao: { status: "PLANEJADA" } }), "NA_AGENDA");
  assert.equal(estadoDoEncontro({ visita: { status: "REALIZADA" }, reuniao: { status: "PLANEJADA" } }), "REALIZADO");
});

test("andamento dos encontros conta os realizados", () => {
  const a = andamentoDosEncontros(
    [
      { estado: "REALIZADO", dia: "2026-09-01" },
      { estado: "NA_AGENDA", dia: "2026-09-10" },
      { estado: "PLANEJADO", dia: null },
    ],
    "2026-09-19",
  );
  assert.equal(a.realizadas, 1);
  assert.equal(a.total, 3);
  assert.equal(a.atrasadas, 1);
  assert.equal(a.aAgendar, 1);
});
