import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assuntosDaPauta,
  datasDaSerie,
  FREQUENCIAS,
  MAXIMO_DE_REPETICOES,
  posicaoNaSerie,
  rotuloDaFrequencia,
} from "../src/lib/agenda";

// ------------------------------------------------------------- semanal

test("semanal anda de sete em sete dias", () => {
  assert.deepEqual(datasDaSerie("2026-09-10", "SEMANAL", 4), [
    "2026-09-10",
    "2026-09-17",
    "2026-09-24",
    "2026-10-01",
  ]);
});

test("semanal atravessa a virada de ano", () => {
  assert.deepEqual(datasDaSerie("2026-12-28", "SEMANAL", 3), [
    "2026-12-28",
    "2027-01-04",
    "2027-01-11",
  ]);
});

test("semanal mantém o dia da semana", () => {
  const datas = datasDaSerie("2026-09-10", "SEMANAL", 6);
  const dias = datas.map((d) => new Date(d + "T00:00:00.000Z").getUTCDay());
  assert.equal(new Set(dias).size, 1, JSON.stringify(datas));
});

// --------------------------------------------------------------- diária

test("diária anda de um em um dia e atravessa o mês", () => {
  assert.deepEqual(datasDaSerie("2026-09-29", "DIARIA", 4), [
    "2026-09-29",
    "2026-09-30",
    "2026-10-01",
    "2026-10-02",
  ]);
});

// ---------------------------------------------------------- quinzenal

test("quinzenal anda de catorze em catorze dias", () => {
  assert.deepEqual(datasDaSerie("2026-09-10", "QUINZENAL", 3), [
    "2026-09-10",
    "2026-09-24",
    "2026-10-08",
  ]);
});

test("quinzenal também mantém o dia da semana", () => {
  const datas = datasDaSerie("2026-01-05", "QUINZENAL", 5);
  const dias = datas.map((d) => new Date(d + "T00:00:00.000Z").getUTCDay());
  assert.equal(new Set(dias).size, 1, JSON.stringify(datas));
});

// ------------------------------------------------------------- mensal

test("mensal mantém o dia do mês", () => {
  assert.deepEqual(datasDaSerie("2026-09-10", "MENSAL", 4), [
    "2026-09-10",
    "2026-10-10",
    "2026-11-10",
    "2026-12-10",
  ]);
});

test("mensal atravessa a virada de ano", () => {
  assert.deepEqual(datasDaSerie("2026-11-15", "MENSAL", 3), [
    "2026-11-15",
    "2026-12-15",
    "2027-01-15",
  ]);
});

test("mensal cai no último dia quando o mês é mais curto", () => {
  // 31 de janeiro não existe em fevereiro.
  assert.deepEqual(datasDaSerie("2026-01-31", "MENSAL", 3), [
    "2026-01-31",
    "2026-02-28",
    "2026-03-31",
  ]);
});

test("mensal acerta fevereiro de ano bissexto", () => {
  assert.deepEqual(datasDaSerie("2024-01-31", "MENSAL", 2), [
    "2024-01-31",
    "2024-02-29",
  ]);
});

test("mensal volta ao dia escolhido depois do mês curto", () => {
  // O dia 31 é o teto: volta quando o mês comporta.
  const datas = datasDaSerie("2026-01-31", "MENSAL", 5);
  assert.equal(datas[3], "2026-04-30");
  assert.equal(datas[4], "2026-05-31");
});

// -------------------------------------------------------------- limites

test("datasDaSerie devolve ao menos uma data", () => {
  assert.deepEqual(datasDaSerie("2026-09-10", "SEMANAL", 0), ["2026-09-10"]);
  assert.deepEqual(datasDaSerie("2026-09-10", "SEMANAL", -3), ["2026-09-10"]);
});

test("datasDaSerie respeita o teto de repetições", () => {
  const datas = datasDaSerie("2026-09-10", "SEMANAL", 999);
  assert.equal(datas.length, MAXIMO_DE_REPETICOES);
});

test("datasDaSerie recusa data inválida", () => {
  assert.deepEqual(datasDaSerie("2026-02-30", "SEMANAL", 3), []);
  assert.deepEqual(datasDaSerie("", "SEMANAL", 3), []);
});

test("datasDaSerie não repete data", () => {
  for (const f of FREQUENCIAS) {
    const datas = datasDaSerie("2026-01-31", f.valor, 12);
    assert.equal(new Set(datas).size, datas.length, f.label);
  }
});

test("as datas saem em ordem crescente", () => {
  for (const f of FREQUENCIAS) {
    const datas = datasDaSerie("2026-01-31", f.valor, 12);
    assert.deepEqual([...datas].sort(), datas, f.label);
  }
});

test("toda frequência tem rótulo em português", () => {
  for (const f of FREQUENCIAS) {
    assert.equal(rotuloDaFrequencia(f.valor), f.label);
  }
  assert.equal(rotuloDaFrequencia("OUTRA"), "OUTRA");
});

// ------------------------------------------------------ posição na série

test("posicaoNaSerie diz qual das quantas", () => {
  const datas = datasDaSerie("2026-09-10", "SEMANAL", 4);
  assert.deepEqual(posicaoNaSerie("2026-09-24", datas), {
    posicao: 3,
    total: 4,
  });
  assert.deepEqual(posicaoNaSerie("2026-09-10", datas), {
    posicao: 1,
    total: 4,
  });
});

test("posicaoNaSerie devolve null para data fora da série", () => {
  const datas = datasDaSerie("2026-09-10", "SEMANAL", 4);
  assert.equal(posicaoNaSerie("2026-09-11", datas), null);
});

// --------------------------------------------------------------- pauta

test("assuntosDaPauta lê uma linha por assunto", () => {
  assert.deepEqual(
    assuntosDaPauta("Retorno do diagnóstico\nAvaliação de desempenho\nDúvidas"),
    ["Retorno do diagnóstico", "Avaliação de desempenho", "Dúvidas"],
  );
});

test("assuntosDaPauta remove marcador de lista", () => {
  assert.deepEqual(assuntosDaPauta("- Um\n* Dois\n• Três\n1. Quatro\n2) Cinco"), [
    "Um",
    "Dois",
    "Três",
    "Quatro",
    "Cinco",
  ]);
});

test("assuntosDaPauta pula linha vazia e aceita quebra do Windows", () => {
  assert.deepEqual(assuntosDaPauta("Um\r\n\r\n  \r\nDois"), ["Um", "Dois"]);
  assert.deepEqual(assuntosDaPauta(""), []);
});

test("assuntosDaPauta não come o número que faz parte do assunto", () => {
  assert.deepEqual(assuntosDaPauta("8h de treino\n1. 3 vagas abertas\n2026 em revisão"), [
    "8h de treino",
    "3 vagas abertas",
    "2026 em revisão",
  ]);
});

test("assuntosDaPauta tem teto, para pauta colada de um documento", () => {
  const muitas = Array.from({ length: 60 }, (_, i) => `Assunto ${i}`).join("\n");
  assert.equal(assuntosDaPauta(muitas).length, 30);
});

// ----------------------------------------------- períodos mais longos

test("trimestral anda de três em três meses", () => {
  assert.deepEqual(datasDaSerie("2026-09-14", "TRIMESTRAL", 4), [
    "2026-09-14",
    "2026-12-14",
    "2027-03-14",
    "2027-06-14",
  ]);
});

test("bimestral, semestral e anual andam no passo certo", () => {
  assert.deepEqual(datasDaSerie("2026-01-10", "BIMESTRAL", 3), [
    "2026-01-10",
    "2026-03-10",
    "2026-05-10",
  ]);
  assert.deepEqual(datasDaSerie("2026-01-10", "SEMESTRAL", 3), [
    "2026-01-10",
    "2026-07-10",
    "2027-01-10",
  ]);
  assert.deepEqual(datasDaSerie("2026-01-10", "ANUAL", 3), [
    "2026-01-10",
    "2027-01-10",
    "2028-01-10",
  ]);
});

test("período longo também cai no último dia do mês curto", () => {
  // 31 de dezembro + 2 meses cai em fevereiro.
  assert.deepEqual(datasDaSerie("2025-12-31", "BIMESTRAL", 2), [
    "2025-12-31",
    "2026-02-28",
  ]);
});

test("toda frequência gera datas em ordem e sem repetir", () => {
  for (const f of FREQUENCIAS) {
    const datas = datasDaSerie("2026-01-31", f.valor, 8);
    assert.equal(new Set(datas).size, datas.length, f.label);
    assert.deepEqual([...datas].sort(), datas, f.label);
  }
});
