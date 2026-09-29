import { test } from "node:test";
import assert from "node:assert/strict";
import {
  codigoDaReuniao,
  combinadosAbertos,
  lerSituacao,
  reuniaoCombina,
  situacaoDoCombinado,
} from "../src/lib/reunioes";

test("o código da reunião tem quatro dígitos", () => {
  assert.equal(codigoDaReuniao(13), "REU-0013");
  assert.equal(codigoDaReuniao(12345), "REU-12345");
  assert.equal(codigoDaReuniao(-1), "REU-0000");
});

const reuniao = {
  titulo: "Cia e central de agendamento",
  numero: 13,
  setor: "Recepção",
  tipo: "Equipe",
  local: "Sala da gestão",
};

test("a busca acha pelo título, setor, tipo e local, sem acento e sem caixa", () => {
  assert.equal(reuniaoCombina(reuniao, "AGENDAMENTO"), true);
  assert.equal(reuniaoCombina(reuniao, "recepcao"), true);
  assert.equal(reuniaoCombina(reuniao, "equipe"), true);
  assert.equal(reuniaoCombina(reuniao, "gestão"), true);
  assert.equal(reuniaoCombina(reuniao, "marketing"), false);
});

test("a busca acha pelo código escrito de qualquer jeito", () => {
  assert.equal(reuniaoCombina(reuniao, "REU-0013"), true);
  assert.equal(reuniaoCombina(reuniao, "reu 13"), true);
  assert.equal(reuniaoCombina(reuniao, "13"), true);
  assert.equal(reuniaoCombina(reuniao, "REU-0014"), false);
});

test("a busca acha a reunião de plano pelo nome do plano", () => {
  const doPlano = { titulo: "Atendimento que encanta", numero: 0, plano: "Recepção" };
  assert.equal(reuniaoCombina(doPlano, "recepcao"), true);
  // Reunião de plano ainda sem número não casa com código nenhum.
  assert.equal(reuniaoCombina(doPlano, "0"), false);
});

test("busca vazia mostra tudo", () => {
  assert.equal(reuniaoCombina(reuniao, "   "), true);
});

test("a situação do combinado olha a data de hoje", () => {
  const hoje = "2026-09-14";
  assert.equal(situacaoDoCombinado({ feito: true, prazo: "2026-09-01" }, hoje), "FEITO");
  assert.equal(situacaoDoCombinado({ feito: false, prazo: null }, hoje), "SEM_DATA");
  assert.equal(situacaoDoCombinado({ feito: false, prazo: "2026-09-13" }, hoje), "ATRASADO");
  assert.equal(situacaoDoCombinado({ feito: false, prazo: "2026-09-14" }, hoje), "HOJE");
  assert.equal(situacaoDoCombinado({ feito: false, prazo: "2026-09-20" }, hoje), "NO_PRAZO");
});

test("só combinado não feito conta como aberto", () => {
  assert.equal(
    combinadosAbertos([
      { tipo: "COMBINADO", feito: false },
      { tipo: "COMBINADO", feito: true },
      { tipo: "DECIDIDO", feito: false },
      { tipo: "CONVERSADO", feito: false },
    ]),
    1,
  );
});

test("valor desconhecido cai no padrão", () => {
  assert.equal(lerSituacao("OUTRA"), "AGENDADA");
  assert.equal(lerSituacao("REALIZADA"), "REALIZADA");
  assert.equal(lerSituacao("PLANEJADA"), "PLANEJADA");
});
