import { test } from "node:test";
import assert from "node:assert/strict";
import {
  agruparPorDia,
  colunasDoDia,
  conferirHorario,
  diasDaSemana,
  diaValido,
  emMinutos,
  faixaHoraria,
  faixaNaGrade,
  fimDaHora,
  gradeDoMes,
  horaValida,
  horasDaGrade,
  inicioDaSemana,
  intervaloDaSemana,
  intervaloDoMes,
  lerMesKey,
  mesKey,
  mesVizinho,
  nomeDoMes,
  rotuloDaSemana,
  rotuloDoDia,
  semanaVizinha,
} from "../src/lib/agenda";

test("gradeDoMes começa na segunda-feira", () => {
  // 1º de setembro de 2026 é uma terça: a semana abre no dia 31 de agosto.
  const semanas = gradeDoMes(2026, 9);
  assert.equal(semanas[0][0].key, "2026-08-31");
  assert.equal(semanas[0][0].doMes, false);
  assert.equal(semanas[0][1].key, "2026-09-01");
  assert.equal(semanas[0][1].doMes, true);
});

test("gradeDoMes cobre o mês inteiro, em semanas de sete dias", () => {
  for (const [ano, mes, dias] of [
    [2026, 2, 28],
    [2024, 2, 29], // bissexto
    [2026, 9, 30],
    [2026, 12, 31],
  ] as const) {
    const semanas = gradeDoMes(ano, mes);
    assert.ok(semanas.every((s) => s.length === 7));

    const doMes = semanas.flat().filter((d) => d.doMes);
    assert.equal(doMes.length, dias, `${ano}-${mes}`);
    assert.equal(doMes[0].dia, 1);
    assert.equal(doMes[doMes.length - 1].dia, dias);
  }
});

test("gradeDoMes não devolve semana só de dias vizinhos", () => {
  for (let mes = 1; mes <= 12; mes++) {
    const semanas = gradeDoMes(2026, mes);
    assert.ok(semanas.every((s) => s.some((d) => d.doMes)));
    assert.ok(semanas.length >= 4 && semanas.length <= 6);
  }
});

test("gradeDoMes marca sábado e domingo", () => {
  const semana = gradeDoMes(2026, 9)[0];
  assert.deepEqual(
    semana.map((d) => d.fimDeSemana),
    [false, false, false, false, false, true, true],
  );
});

test("mesVizinho vira o ano nas duas pontas", () => {
  assert.deepEqual(mesVizinho(2026, 1, -1), { ano: 2025, mes: 12 });
  assert.deepEqual(mesVizinho(2026, 12, 1), { ano: 2027, mes: 1 });
  assert.deepEqual(mesVizinho(2026, 6, 1), { ano: 2026, mes: 7 });
});

test("mesKey e lerMesKey são inversos", () => {
  assert.equal(mesKey(2026, 9), "2026-09");
  assert.deepEqual(lerMesKey("2026-09"), { ano: 2026, mes: 9 });
});

test("lerMesKey recusa entrada inválida", () => {
  for (const ruim of ["", "2026-13", "2026-00", "26-09", "abc", null, undefined]) {
    assert.equal(lerMesKey(ruim), null, String(ruim));
  }
});

test("nomeDoMes escreve em português", () => {
  assert.equal(nomeDoMes(2026, 3), "março de 2026");
});

test("intervaloDoMes vai do dia 1 ao início do mês seguinte", () => {
  const { de, ate } = intervaloDoMes(2026, 12);
  assert.equal(de.toISOString(), "2026-12-01T00:00:00.000Z");
  assert.equal(ate.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("horaValida aceita HH:MM de 24 horas", () => {
  for (const boa of ["00:00", "09:00", "13:45", "23:59"]) {
    assert.ok(horaValida(boa), boa);
  }
  for (const ruim of ["24:00", "9:00", "09:60", "09h00", "", "0900"]) {
    assert.ok(!horaValida(ruim), ruim);
  }
});

test("emMinutos conta a partir da meia-noite", () => {
  assert.equal(emMinutos("00:00"), 0);
  assert.equal(emMinutos("09:30"), 570);
  assert.equal(emMinutos("23:59"), 1439);
  assert.equal(emMinutos("banana"), null);
});

test("conferirHorario aprova horário coerente", () => {
  assert.equal(conferirHorario("09:00", "12:00"), null);
  assert.equal(conferirHorario("09:00", null), null);
  assert.equal(conferirHorario("09:00", ""), null);
});

test("conferirHorario reprova término antes ou igual ao início", () => {
  assert.match(conferirHorario("12:00", "09:00") ?? "", /depois/);
  assert.match(conferirHorario("09:00", "09:00") ?? "", /depois/);
});

test("conferirHorario reprova hora malformada", () => {
  assert.match(conferirHorario("9h", null) ?? "", /início/);
  assert.match(conferirHorario("09:00", "25:00") ?? "", /término/);
});

test("faixaHoraria mostra só o início quando não há término", () => {
  assert.equal(faixaHoraria("09:00", "12:00"), "09:00 – 12:00");
  assert.equal(faixaHoraria("09:00", null), "09:00");
});

test("agruparPorDia junta por data e ordena por hora", () => {
  const visitas = [
    { date: new Date("2026-09-10T00:00:00.000Z"), startTime: "14:00" },
    { date: new Date("2026-09-09T00:00:00.000Z"), startTime: "10:00" },
    { date: new Date("2026-09-10T00:00:00.000Z"), startTime: "08:30" },
  ];

  const mapa = agruparPorDia(visitas);
  assert.equal(mapa.size, 2);
  assert.deepEqual(
    mapa.get("2026-09-10")?.map((v) => v.startTime),
    ["08:30", "14:00"],
  );
  assert.deepEqual(
    mapa.get("2026-09-09")?.map((v) => v.startTime),
    ["10:00"],
  );
});

test("diaValido recusa data que não existe", () => {
  assert.ok(diaValido("2026-09-30"));
  assert.ok(diaValido("2024-02-29"));
  assert.ok(!diaValido("2026-02-30"));
  assert.ok(!diaValido("2026-13-01"));
  assert.ok(!diaValido("30/09/2026"));
  assert.ok(!diaValido(""));
});

// ------------------------------------------------------------ visão semanal

test("horasDaGrade cobre das 08:00 às 22:00", () => {
  const horas = horasDaGrade();
  assert.equal(horas.length, 15);
  assert.equal(horas[0], "08:00");
  assert.equal(horas[horas.length - 1], "22:00");
});

test("inicioDaSemana recua até a segunda-feira", () => {
  // 2026-09-08 é terça; a semana começa no dia 7.
  assert.equal(inicioDaSemana("2026-09-08"), "2026-09-07");
  assert.equal(inicioDaSemana("2026-09-07"), "2026-09-07");
  // Domingo pertence à semana que começou na segunda anterior.
  assert.equal(inicioDaSemana("2026-09-13"), "2026-09-07");
  assert.equal(inicioDaSemana("2026-09-14"), "2026-09-14");
});

test("diasDaSemana devolve sete dias em sequência", () => {
  const dias = diasDaSemana("2026-09-07");
  assert.equal(dias.length, 7);
  assert.equal(dias[0].key, "2026-09-07");
  assert.equal(dias[6].key, "2026-09-13");
  assert.deepEqual(
    dias.map((d) => d.fimDeSemana),
    [false, false, false, false, false, true, true],
  );
});

test("diasDaSemana atravessa a virada de mês", () => {
  const dias = diasDaSemana("2026-08-31");
  assert.equal(dias[0].key, "2026-08-31");
  assert.equal(dias[1].key, "2026-09-01");
  assert.equal(dias[6].key, "2026-09-06");
});

test("intervaloDaSemana vai da segunda à segunda seguinte", () => {
  const { de, ate } = intervaloDaSemana("2026-12-28");
  assert.equal(de.toISOString(), "2026-12-28T00:00:00.000Z");
  assert.equal(ate.toISOString(), "2027-01-04T00:00:00.000Z");
});

test("semanaVizinha anda de sete em sete dias", () => {
  assert.equal(semanaVizinha("2026-09-07", 1), "2026-09-14");
  assert.equal(semanaVizinha("2026-09-07", -1), "2026-08-31");
});

test("rotuloDaSemana encurta quando o mês é o mesmo", () => {
  assert.equal(rotuloDaSemana("2026-09-07"), "7 a 13 de setembro de 2026");
});

test("rotuloDaSemana escreve os dois meses quando a semana vira", () => {
  assert.equal(
    rotuloDaSemana("2026-08-31"),
    "31 de agosto a 6 de setembro de 2026",
  );
});

test("rotuloDaSemana escreve os dois anos quando a semana vira o ano", () => {
  assert.equal(
    rotuloDaSemana("2026-12-28"),
    "28 de dezembro de 2026 a 3 de janeiro de 2027",
  );
});

test("faixaNaGrade posiciona pelo horário", () => {
  // A janela tem 14 horas (08h–22h).
  const f = faixaNaGrade("08:00", "09:00")!;
  assert.equal(f.topo, 0);
  assert.ok(Math.abs(f.altura - 100 / 14) < 0.001);
  assert.equal(f.cortado, false);

  const meio = faixaNaGrade("15:00", "16:00")!;
  assert.ok(Math.abs(meio.topo - (7 / 14) * 100) < 0.001);
});

test("faixaNaGrade ocupa a janela inteira das 08h às 22h", () => {
  const f = faixaNaGrade("08:00", "22:00")!;
  assert.equal(f.topo, 0);
  assert.equal(f.altura, 100);
  assert.equal(f.cortado, false);
});

test("faixaNaGrade dá altura mínima a quem não tem término", () => {
  const f = faixaNaGrade("09:00", null)!;
  assert.ok(f.altura > 0);
  assert.ok(Math.abs(f.altura - (30 / (14 * 60)) * 100) < 0.001);
});

test("faixaNaGrade apara e marca quem passa das bordas", () => {
  const cedo = faixaNaGrade("06:00", "09:00")!;
  assert.equal(cedo.topo, 0);
  assert.equal(cedo.cortado, true);

  const tarde = faixaNaGrade("21:00", "23:30")!;
  assert.equal(tarde.cortado, true);
  assert.ok(Math.abs(tarde.topo + tarde.altura - 100) < 0.001);
});

test("faixaNaGrade devolve null para quem está todo fora da faixa", () => {
  assert.equal(faixaNaGrade("23:00", "23:45"), null);
  assert.equal(faixaNaGrade("05:00", "07:00"), null);
  assert.equal(faixaNaGrade("banana", null), null);
});

test("colunasDoDia deixa em uma coluna quem não se sobrepõe", () => {
  const r = colunasDoDia([
    { startTime: "09:00", endTime: "10:00" },
    { startTime: "10:00", endTime: "11:00" },
  ]);
  assert.deepEqual(
    r.map((x) => [x.coluna, x.colunas]),
    [
      [0, 1],
      [0, 1],
    ],
  );
});

test("colunasDoDia divide o espaço entre os que se sobrepõem", () => {
  const r = colunasDoDia([
    { startTime: "09:00", endTime: "11:00" },
    { startTime: "10:00", endTime: "12:00" },
  ]);
  assert.deepEqual(r.map((x) => x.colunas), [2, 2]);
  assert.deepEqual(r.map((x) => x.coluna).sort(), [0, 1]);
});

test("colunasDoDia reaproveita a coluna quando o horário já passou", () => {
  const r = colunasDoDia([
    { startTime: "09:00", endTime: "10:00" },
    { startTime: "09:30", endTime: "10:30" },
    { startTime: "10:00", endTime: "11:00" },
  ]);
  // Os três estão encadeados, então formam um grupo de duas colunas.
  assert.deepEqual(r.map((x) => x.colunas), [2, 2, 2]);
  const porHora = new Map(r.map((x) => [x.visita.startTime, x.coluna]));
  assert.notEqual(porHora.get("09:00"), porHora.get("09:30"));
  assert.equal(porHora.get("10:00"), porHora.get("09:00"));
});

test("colunasDoDia devolve todos os compromissos recebidos", () => {
  const entrada = [
    { startTime: "14:00", endTime: null },
    { startTime: "08:00", endTime: "18:00" },
    { startTime: "09:00", endTime: "09:30" },
  ];
  assert.equal(colunasDoDia(entrada).length, entrada.length);
});

test("fimDaHora avança uma hora cheia", () => {
  assert.equal(fimDaHora("08:00"), "09:00");
  assert.equal(fimDaHora("21:00"), "22:00");
  assert.equal(fimDaHora("09:30"), "10:30");
});

test("fimDaHora aceita mais de uma hora", () => {
  assert.equal(fimDaHora("08:00", 3), "11:00");
});

test("fimDaHora não atravessa a meia-noite", () => {
  assert.equal(fimDaHora("23:00"), "23:59");
  assert.equal(fimDaHora("23:00", 2), null);
  assert.equal(fimDaHora("banana"), null);
});

test("rotuloDoDia escreve o dia da semana por extenso", () => {
  assert.equal(rotuloDoDia("2026-09-09"), "quarta-feira, 9 de setembro");
  assert.equal(rotuloDoDia("2026-09-07"), "segunda-feira, 7 de setembro");
  assert.equal(rotuloDoDia("2026-09-13"), "domingo, 13 de setembro");
});
