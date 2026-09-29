import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularDia,
  calcularDias,
  diaDaBatida,
  diasDoMes,
  horas,
  instanteNoDia,
  JORNADA_PADRAO,
  lerDuracao,
  lerHora,
  minutoNoDia,
  outroMes,
  proximaBatida,
  relogio,
  totalizar,
  type RegrasPonto,
} from "../src/lib/ponto";
import { lerAfd } from "../src/lib/ponto-afd";

const regras: RegrasPonto = {
  regime: "BANCO_DE_HORAS",
  jornada: JORNADA_PADRAO,
  tolerancia: 10,
  intervaloMinimo: 60,
};

const h = (texto: string) => lerHora(texto)!;

// 2026-09-14 é segunda; 2026-09-19 é sábado; 2026-09-20 é domingo.

test("dia normal de 8h com 1h de almoço fecha em zero", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [h("08:00"), h("12:00"), h("13:00"), h("17:00")] }, regras);
  assert.equal(d.trabalhado, 480);
  assert.equal(d.previsto, 480);
  assert.equal(d.saldo, 0);
  assert.deepEqual(d.alertas, []);
});

test("variação dentro da tolerância não conta", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [h("08:07"), h("12:00"), h("13:00"), h("17:00")] }, regras);
  assert.equal(d.trabalhado, 473);
  assert.equal(d.saldo, 0);
});

test("passou da tolerância, conta o atraso inteiro", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [h("08:15"), h("12:00"), h("13:00"), h("17:00")] }, regras);
  assert.equal(d.saldo, -15);
  assert.equal(d.debito, 15);
});

test("hora extra em dia útil é 50%, no domingo é 100%", () => {
  const util = calcularDia({ dia: "2026-09-14", batidas: [h("08:00"), h("12:00"), h("13:00"), h("18:30")] }, regras);
  assert.equal(util.extras50, 90);
  assert.equal(util.extras100, 0);

  const domingo = calcularDia({ dia: "2026-09-20", batidas: [h("08:00"), h("12:00")] }, regras);
  assert.equal(domingo.previsto, 0);
  assert.equal(domingo.extras100, 240);
  assert.equal(domingo.extras50, 0);
});

test("feriado zera a jornada e o trabalho nele é em dobro", () => {
  const folgado = calcularDia({ dia: "2026-09-14", batidas: [], ocorrencia: "FERIADO" }, regras);
  assert.equal(folgado.saldo, 0);
  assert.equal(folgado.falta, false);

  const trabalhado = calcularDia({ dia: "2026-09-14", batidas: [h("08:00"), h("12:00")], ocorrencia: "FERIADO" }, regras);
  assert.equal(trabalhado.extras100, 240);
});

test("dia sem batida e com jornada é falta", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [] }, regras);
  assert.equal(d.falta, true);
  assert.equal(d.saldo, -480);
  assert.ok(d.alertas.includes("Falta"));
});

test("atestado abona o que faltou", () => {
  const inteiro = calcularDia({ dia: "2026-09-14", batidas: [], ocorrencia: "ATESTADO" }, regras);
  assert.equal(inteiro.falta, false);
  assert.equal(inteiro.saldo, 0);

  const meio = calcularDia({ dia: "2026-09-14", batidas: [h("08:00"), h("12:00")], ocorrencia: "ABONO" }, regras);
  assert.equal(meio.abonado, 240);
  assert.equal(meio.saldo, 0);
});

test("marcação ímpar vira alerta e não gera saldo", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [h("08:00"), h("12:00"), h("13:00")] }, regras);
  assert.equal(d.saldo, 0);
  assert.ok(d.alertas.some((a) => a.startsWith("Marcação ímpar")));
});

test("dia em andamento não cobra saída nem falta", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [h("08:00")], emAndamento: true }, regras);
  assert.deepEqual(d.alertas, []);
  const vazio = calcularDia({ dia: "2026-09-14", batidas: [], emAndamento: true }, regras);
  assert.equal(vazio.falta, false);
  assert.equal(totalizar([vazio]).previsto, 0);
});

test("mais de 6h sem 1h de intervalo gera alerta", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [h("08:00"), h("12:00"), h("12:30"), h("16:30")] }, regras);
  assert.ok(d.alertas.includes("Intervalo menor que 1:00"));
});

test("mais de 2h extras no dia gera alerta", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [h("07:00"), h("12:00"), h("13:00"), h("19:00")] }, regras);
  assert.equal(d.saldo, 180);
  assert.ok(d.alertas.includes("Mais de 2h extras no dia"));
});

test("turno da noite fecha no mesmo dia de trabalho", () => {
  const d = calcularDia({ dia: "2026-09-14", batidas: [h("22:00"), 1440 + h("06:00")] }, { ...regras, jornada: [0, 480, 480, 480, 480, 480, 0] });
  assert.equal(d.trabalhado, 480);
  assert.equal(d.saldo, 0);
});

test("descanso entre jornadas menor que 11h gera alerta no dia seguinte", () => {
  const dias = calcularDias(
    [
      { dia: "2026-09-14", batidas: [h("08:00"), h("12:00"), h("13:00"), h("23:00")] },
      { dia: "2026-09-15", batidas: [h("07:00"), h("12:00"), h("13:00"), h("17:00")] },
    ],
    regras,
  );
  assert.ok(dias[1].alertas.some((a) => a.startsWith("Descanso entre jornadas de 8:00")));
});

test("totais somam o mês", () => {
  const dias = calcularDias(
    [
      { dia: "2026-09-14", batidas: [h("08:00"), h("12:00"), h("13:00"), h("18:00")] },
      { dia: "2026-09-15", batidas: [] },
    ],
    regras,
  );
  const t = totalizar(dias);
  assert.equal(t.saldo, 60 - 480);
  assert.equal(t.extras50, 60);
  assert.equal(t.faltas, 1);
});

test("a batida pertence a ontem quando a jornada ficou aberta há menos de 16h", () => {
  const ontem22h = instanteNoDia("2026-09-14", h("22:00"));
  const hoje6h = instanteNoDia("2026-09-15", h("06:00"));
  assert.equal(
    diaDaBatida({ hoje: "2026-09-15", ontem: "2026-09-14", batidasDeOntem: [ontem22h], batidasDeHoje: 0, agora: hoje6h }),
    "2026-09-14",
  );
  const hoje16h = instanteNoDia("2026-09-15", h("16:00"));
  assert.equal(
    diaDaBatida({ hoje: "2026-09-15", ontem: "2026-09-14", batidasDeOntem: [ontem22h], batidasDeHoje: 0, agora: hoje16h }),
    "2026-09-15",
  );
});

test("instante e minuto no dia são inversos, no fuso do escritório", () => {
  const i = instanteNoDia("2026-09-14", h("08:30"));
  assert.equal(i.toISOString(), "2026-09-14T11:30:00.000Z");
  assert.equal(minutoNoDia(i, "2026-09-14"), 510);
  assert.equal(minutoNoDia(instanteNoDia("2026-09-15", 60), "2026-09-14"), 1500);
});

test("formatação de horas e leitura", () => {
  assert.equal(horas(125), "2:05");
  assert.equal(horas(-30), "-0:30");
  assert.equal(relogio(1530), "01:30");
  assert.equal(lerHora("8:30"), 510);
  assert.equal(lerHora("25:00"), null);
  assert.equal(lerDuracao("8"), 480);
  assert.equal(lerDuracao("8:48"), 528);
  assert.equal(lerDuracao(""), 0);
  assert.equal(proximaBatida(0), "Entrada");
  assert.equal(proximaBatida(1), "Saída");
});

test("meses", () => {
  assert.equal(diasDoMes("2026-02").length, 28);
  assert.equal(outroMes("2026-01", -1), "2025-12");
});

test("AFD da Portaria 671 e da 1510", () => {
  const conteudo = [
    "0000000001" + "1".repeat(200),
    "0000000023" + "2026-09-14T08:02:00-0300" + "012345678901" + "ABCD",
    "0000000033140920261705012345678901",
    "0000000043lixo lixo lixo lixo lixo lixo",
  ].join("\r\n");
  const r = lerAfd(conteudo);
  assert.equal(r.marcacoes.length, 2);
  assert.equal(r.marcacoes[0].nsr, 2);
  assert.equal(r.marcacoes[0].instante.toISOString(), "2026-09-14T11:02:00.000Z");
  assert.equal(r.marcacoes[0].documento, "12345678901");
  assert.equal(r.marcacoes[1].instante.toISOString(), "2026-09-14T20:05:00.000Z");
  assert.equal(r.marcacoes[1].documento, "12345678901");
  assert.equal(r.ilegiveis, 1);
});
