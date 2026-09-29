import { test } from "node:test";
import assert from "node:assert/strict";
import {
  diasAte,
  ordenarComoTarefa,
  pendente,
  prazoAdmissional,
  rotuloDoResultado,
  rotuloDoStatus,
  rotuloDoTipo,
  somarMeses,
  textoDoPrazo,
  urgencia,
  validadeDe,
  VALIDADE_PADRAO_MESES,
} from "../src/lib/exames";

test("somarMeses avança o mês mantendo o dia", () => {
  assert.equal(somarMeses("2026-09-08", 1), "2026-10-08");
  assert.equal(somarMeses("2026-09-08", 12), "2027-09-08");
  assert.equal(somarMeses("2026-09-08", 6), "2027-03-08");
});

test("somarMeses cai no último dia quando o mês é mais curto", () => {
  assert.equal(somarMeses("2026-01-31", 1), "2026-02-28");
  assert.equal(somarMeses("2024-01-31", 1), "2024-02-29"); // bissexto
  assert.equal(somarMeses("2026-03-31", 1), "2026-04-30");
});

test("somarMeses atravessa a virada de ano", () => {
  assert.equal(somarMeses("2026-12-15", 1), "2027-01-15");
  assert.equal(somarMeses("2026-11-30", 3), "2027-02-28");
});

test("validadeDe usa doze meses por padrão", () => {
  assert.equal(VALIDADE_PADRAO_MESES, 12);
  assert.equal(validadeDe("2026-09-08"), "2027-09-08");
  assert.equal(validadeDe("2026-09-08", 6), "2027-03-08");
});

test("prazoAdmissional é o dia anterior à admissão", () => {
  assert.equal(prazoAdmissional("2026-09-08"), "2026-09-07");
  // Vira o mês e o ano corretamente.
  assert.equal(prazoAdmissional("2026-01-01"), "2025-12-31");
});

test("prazoAdmissional não inventa prazo sem data de admissão", () => {
  assert.equal(prazoAdmissional(null), null);
  assert.equal(prazoAdmissional(undefined), null);
  assert.equal(prazoAdmissional(""), null);
});

test("urgencia separa atrasado, hoje, próximo e em dia", () => {
  const hoje = "2026-09-08";
  assert.equal(urgencia("2026-09-07", hoje), "ATRASADO");
  assert.equal(urgencia("2026-09-08", hoje), "HOJE");
  assert.equal(urgencia("2026-09-11", hoje), "PROXIMO");
  assert.equal(urgencia("2026-09-15", hoje), "PROXIMO"); // sétimo dia ainda conta
  assert.equal(urgencia("2026-09-16", hoje), "EM_DIA");
  assert.equal(urgencia(null, hoje), "SEM_PRAZO");
});

test("diasAte conta a diferença, com sinal", () => {
  assert.equal(diasAte("2026-09-15", "2026-09-08"), 7);
  assert.equal(diasAte("2026-09-08", "2026-09-08"), 0);
  assert.equal(diasAte("2026-09-01", "2026-09-08"), -7);
});

test("textoDoPrazo escreve em português, no singular e no plural", () => {
  const hoje = "2026-09-08";
  assert.equal(textoDoPrazo("2026-09-08", hoje), "vence hoje");
  assert.equal(textoDoPrazo("2026-09-09", hoje), "vence amanhã");
  assert.equal(textoDoPrazo("2026-09-07", hoje), "vencido ontem");
  assert.equal(textoDoPrazo("2026-09-05", hoje), "vencido há 3 dias");
  assert.equal(textoDoPrazo("2026-09-13", hoje), "em 5 dias");
  assert.equal(textoDoPrazo(null, hoje), null);
});

test("pendente cobre só o que ainda é trabalho", () => {
  assert.ok(pendente("A_AGENDAR"));
  assert.ok(pendente("AGENDADO"));
  assert.ok(!pendente("REALIZADO"));
  assert.ok(!pendente("CANCELADO"));
});

test("ordenarComoTarefa põe pendência antes do que já foi resolvido", () => {
  const exames = [
    { id: "feito", status: "REALIZADO", prazo: "2026-01-01", agendadoEm: null },
    { id: "urgente", status: "A_AGENDAR", prazo: "2026-09-09", agendadoEm: null },
    { id: "cancelado", status: "CANCELADO", prazo: "2026-02-01", agendadoEm: null },
    { id: "marcado", status: "AGENDADO", prazo: "2026-09-08", agendadoEm: "2026-09-08" },
  ];

  assert.deepEqual(
    ordenarComoTarefa(exames).map((e) => e.id),
    ["marcado", "urgente", "feito", "cancelado"],
  );
});

test("ordenarComoTarefa deixa pendência sem prazo por último entre as pendências", () => {
  const exames = [
    { id: "sem-prazo", status: "A_AGENDAR", prazo: null, agendadoEm: null },
    { id: "com-prazo", status: "A_AGENDAR", prazo: "2026-12-01", agendadoEm: null },
  ];

  assert.deepEqual(
    ordenarComoTarefa(exames).map((e) => e.id),
    ["com-prazo", "sem-prazo"],
  );
});

test("ordenarComoTarefa não altera a lista recebida", () => {
  const exames = [
    { id: "b", status: "REALIZADO", prazo: null, agendadoEm: null },
    { id: "a", status: "A_AGENDAR", prazo: "2026-09-09", agendadoEm: null },
  ];
  const copia = [...exames];
  ordenarComoTarefa(exames);
  assert.deepEqual(exames, copia);
});

test("os rótulos saem em português", () => {
  assert.equal(rotuloDoTipo("ADMISSIONAL"), "Admissional");
  assert.equal(rotuloDoTipo("RETORNO_AO_TRABALHO"), "Retorno ao trabalho");
  assert.equal(rotuloDoStatus("A_AGENDAR"), "a agendar");
  assert.equal(rotuloDoResultado("APTO_COM_RESTRICAO"), "Apto com restrição");
  assert.equal(rotuloDoResultado(null), null);
});

test("rótulo desconhecido volta como veio, em vez de sumir", () => {
  assert.equal(rotuloDoTipo("OUTRO"), "OUTRO");
  assert.equal(rotuloDoStatus("OUTRO"), "OUTRO");
});
