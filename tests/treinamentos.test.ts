import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cumprimento,
  escreverHoras,
  lerDinheiro,
  lerHoras,
  matrizPorCargo,
  mesmoCargo,
  pendencias,
  situacaoDaTurma,
  totaisDoAno,
  type TurmaDoAno,
} from "../src/lib/treinamentos";

test("situacaoDaTurma: encerrada é realizada, com motivo é justificada", () => {
  assert.equal(situacaoDaTurma({ statusDaReuniao: "REALIZADA", justificativa: null }), "REALIZADO");
  assert.equal(situacaoDaTurma({ statusDaReuniao: "ARQUIVADA", justificativa: "Instrutor faltou" }), "JUSTIFICADO");
  assert.equal(situacaoDaTurma({ statusDaReuniao: "PLANEJADA", justificativa: "  " }), "PROGRAMADO");
  // Realizada vale mais que um motivo esquecido.
  assert.equal(situacaoDaTurma({ statusDaReuniao: "REALIZADA", justificativa: "x" }), "REALIZADO");
});

test("lerHoras aceita os jeitos comuns de escrever", () => {
  assert.equal(lerHoras("2,5"), 2.5);
  assert.equal(lerHoras("2.5"), 2.5);
  assert.equal(lerHoras("2h30"), 2.5);
  assert.equal(lerHoras("1:30"), 1.5);
  assert.equal(lerHoras("90min"), 1.5);
  assert.equal(lerHoras("8h"), 8);
  assert.equal(lerHoras("4"), 4);
  assert.equal(lerHoras(""), null);
  assert.equal(lerHoras("muito"), null);
});

test("escreverHoras", () => {
  assert.equal(escreverHoras(2.5), "2h30");
  assert.equal(escreverHoras(3), "3h");
  assert.equal(escreverHoras(null), "—");
});

test("lerDinheiro entende o formato brasileiro", () => {
  assert.equal(lerDinheiro("1.234,50"), 1234.5);
  assert.equal(lerDinheiro("R$ 300"), 300);
  assert.equal(lerDinheiro("300.5"), 300.5);
  assert.equal(lerDinheiro(""), null);
});

test("mesmoCargo ignora acento, caixa e espaço", () => {
  assert.ok(mesmoCargo("Gerente de RH", " gerente  de rh"));
  assert.ok(mesmoCargo("Técnico", "tecnico"));
  assert.ok(!mesmoCargo("Gerente", "Gerente de RH"));
});

test("pendencias: o que o cargo pede menos o que a pessoa já fez", () => {
  const matriz = matrizPorCargo(
    [
      { treinamentoId: "dp1", cargoId: "analista" },
      { treinamentoId: "dp2", cargoId: "analista" },
      { treinamentoId: "velho", cargoId: "analista" },
      { treinamentoId: "rec", cargoId: "recepcao" },
    ],
    new Set(["dp1", "dp2", "rec"]),
  );
  const r = pendencias(
    [
      { id: "ana", nome: "Ana", cargoId: "analista" },
      { id: "bia", nome: "Bia", cargoId: "recepcao" },
      { id: "caio", nome: "Caio", cargoId: null },
    ],
    matriz,
    [
      { employeeId: "ana", treinamentoId: "dp1" },
      { employeeId: "bia", treinamentoId: "rec" },
      // Fez treinamento que não é do cargo: não conta nem atrapalha.
      { employeeId: "caio", treinamentoId: "dp1" },
    ],
  );
  // Treinamento fora de uso não vira pendência.
  assert.deepEqual(r.get("ana"), ["dp2"]);
  assert.deepEqual(r.get("bia"), []);
  assert.deepEqual(r.get("caio"), []);
});

test("totaisDoAno: programado conta tudo, realizado só o encerrado", () => {
  const turmas: TurmaDoAno[] = [
    { mes: 1, situacao: "REALIZADO", horas: 4, investimento: 500, convocados: 10, presentes: 8 },
    { mes: 3, situacao: "PROGRAMADO", horas: 2, investimento: null, convocados: 5, presentes: 0 },
    { mes: 5, situacao: "JUSTIFICADO", horas: 8, investimento: 1000, convocados: 3, presentes: 0 },
  ];
  const { programado, realizado, justificadas } = totaisDoAno(turmas);
  assert.equal(programado.turmas, 3);
  assert.equal(programado.horas, 14);
  assert.equal(programado.investimento, 1500);
  assert.equal(programado.horasPessoa, 4 * 10 + 2 * 5 + 8 * 3);
  assert.equal(realizado.turmas, 1);
  assert.equal(realizado.horasPessoa, 32);
  assert.equal(realizado.investimento, 500);
  assert.equal(justificadas, 1);
  // 1 realizada de 2 devidas (a justificada não conta contra).
  assert.equal(cumprimento(turmas), 50);
  assert.equal(cumprimento([]), null);
});
