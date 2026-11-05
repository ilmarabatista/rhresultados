import { test } from "node:test";
import assert from "node:assert/strict";
import {
  FUNCIONAMENTO_PADRAO,
  alertasDaPessoa,
  buracos,
  coberturaDoDia,
  diasDaSemana,
  domingosSeguidos,
  duracao,
  gerarSemana,
  lerHora,
  segundaDaSemana,
  textoDaSemana,
  turnosSugeridos,
  type DiaDaPessoa,
  type Turno,
} from "../src/lib/escala";

const ABERTURA: Turno = { id: "a", nome: "Abertura", inicio: 480, fim: 980, intervalo: 60, cor: "azul" };
const FECHAMENTO: Turno = { id: "f", nome: "Fechamento", inicio: 820, fim: 1320, intervalo: 60, cor: "laranja" };

function trabalho(employeeId: string, dia: string, t: Turno): DiaDaPessoa {
  return { employeeId, dia, tipo: "TRABALHO", turnoId: t.id, inicio: t.inicio, fim: t.fim, intervalo: t.intervalo };
}
function folga(employeeId: string, dia: string): DiaDaPessoa {
  return { employeeId, dia, tipo: "FOLGA", turnoId: null, inicio: null, fim: null, intervalo: 0 };
}

test("semana vai de segunda a domingo", () => {
  assert.equal(segundaDaSemana("2026-11-05"), "2026-11-02");
  assert.equal(segundaDaSemana("2026-11-08"), "2026-11-02"); // domingo
  assert.equal(segundaDaSemana("2026-11-02"), "2026-11-02");
  assert.deepEqual(diasDaSemana("2026-11-02").at(-1), "2026-11-08");
});

test("horas escritas e lidas", () => {
  assert.equal(duracao(440), "7h20");
  assert.equal(duracao(2640), "44h");
  assert.equal(lerHora("08:00"), 480);
  assert.equal(lerHora("22"), 1320);
  assert.equal(lerHora("13h40"), 820);
  assert.equal(lerHora("25:00"), null);
  assert.equal(lerHora("1340"), 820);
});

test("turnos sugeridos para 08h às 22h somam 7h20 e cobrem o dia todo", () => {
  const t = turnosSugeridos(FUNCIONAMENTO_PADRAO);
  assert.equal(t.length, 3);
  assert.equal(t[0].inicio, 480);
  assert.equal(t[2].fim, 1320);
  for (const turno of t) assert.equal(turno.fim - turno.inicio - turno.intervalo, 440);
});

test("cobertura aponta as horas sem gente", () => {
  const dia = "2026-11-02";
  const faixas = coberturaDoDia([trabalho("ana", dia, ABERTURA)], [480, 1320]);
  assert.equal(faixas.length, 14);
  assert.equal(faixas[0].pessoas, 1);
  assert.equal(faixas.at(-1)!.pessoas, 0);
  const vazios = buracos(faixas, 1);
  assert.deepEqual(vazios, [{ inicio: 1020, fim: 1320, pessoas: 0 }]);
});

test("fechar às 22h e abrir às 08h no dia seguinte dá só 10h de descanso", () => {
  const dias = [trabalho("ana", "2026-11-02", FECHAMENTO), trabalho("ana", "2026-11-03", ABERTURA)];
  const alertas = alertasDaPessoa("ana", "2026-11-02", dias);
  assert.ok(alertas.some((a) => a.dia === "2026-11-03" && a.texto.includes("10h de descanso")));
});

test("seis dias de 7h20 fecham 44h sem alerta; o sétimo dia avisa", () => {
  const semana = diasDaSemana("2026-11-02");
  const seis = semana.slice(0, 6).map((d) => trabalho("ana", d, ABERTURA));
  assert.deepEqual(alertasDaPessoa("ana", "2026-11-02", [...seis, folga("ana", semana[6])]), []);
  const sete = semana.map((d) => trabalho("ana", d, ABERTURA));
  const textos = alertasDaPessoa("ana", "2026-11-02", sete).map((a) => a.texto);
  assert.ok(textos.some((t) => t.includes("passa de 44h")));
  assert.ok(textos.some((t) => t.includes("7º dia")));
});

test("terceiro domingo seguido trabalhado avisa", () => {
  const dias = ["2026-10-25", "2026-11-01", "2026-11-08"].map((d) => trabalho("ana", d, ABERTURA));
  const alertas = alertasDaPessoa("ana", "2026-11-02", dias);
  assert.ok(alertas.some((a) => a.texto.includes("domingo")));
  assert.equal(domingosSeguidos("ana", "2026-11-01", dias), 2);
});

test("gerar a semana dá uma folga a cada um e espalha as folgas do mesmo turno", () => {
  const pessoas = ["a1", "a2", "a3", "f1", "f2", "f3"].map((id) => ({
    id,
    turnoId: id.startsWith("a") ? "a" : "f",
    domingosSeguidos: 0,
  }));
  const gerados = gerarSemana({
    segunda: "2026-11-02",
    pessoas,
    turnos: [ABERTURA, FECHAMENTO],
    funcionamento: FUNCIONAMENTO_PADRAO,
    jaMarcados: [],
  });
  assert.equal(gerados.length, 42);
  for (const p of pessoas) {
    const folgas = gerados.filter((d) => d.employeeId === p.id && d.tipo === "FOLGA");
    assert.equal(folgas.length, 1);
  }
  const folgasAbertura = gerados.filter((d) => d.tipo === "FOLGA" && d.employeeId.startsWith("a")).map((d) => d.dia);
  assert.equal(new Set(folgasAbertura).size, 3);
});

test("quem trabalhou dois domingos folga no domingo; o já marcado não muda", () => {
  const gerados = gerarSemana({
    segunda: "2026-11-02",
    pessoas: [{ id: "ana", turnoId: "a", domingosSeguidos: 2 }],
    turnos: [ABERTURA],
    funcionamento: FUNCIONAMENTO_PADRAO,
    jaMarcados: [trabalho("ana", "2026-11-02", FECHAMENTO)],
  });
  assert.equal(gerados.length, 6);
  assert.ok(!gerados.some((d) => d.dia === "2026-11-02"));
  assert.equal(gerados.find((d) => d.dia === "2026-11-08")!.tipo, "FOLGA");
});

test("dia em que a empresa fecha é folga de todos", () => {
  const funcionamento = [...FUNCIONAMENTO_PADRAO];
  funcionamento[0] = null; // domingo fechado
  const gerados = gerarSemana({
    segunda: "2026-11-02",
    pessoas: [{ id: "ana", turnoId: "a", domingosSeguidos: 0 }],
    turnos: [ABERTURA],
    funcionamento,
    jaMarcados: [],
  });
  assert.deepEqual(
    gerados.filter((d) => d.tipo === "FOLGA").map((d) => d.dia),
    ["2026-11-08"],
  );
});

test("texto para o WhatsApp agrupa por horário", () => {
  const texto = textoDaSemana({
    empresa: "Loja",
    segunda: "2026-11-02",
    pessoas: [
      { id: "ana", nome: "Ana Souza" },
      { id: "bia", nome: "Bia Lima" },
    ],
    dias: [trabalho("ana", "2026-11-02", ABERTURA), folga("bia", "2026-11-02")],
    turnos: [ABERTURA],
  });
  assert.match(texto, /\*Seg 02\/11\*/);
  assert.match(texto, /08:00–16:20 \(Abertura\): Ana/);
  assert.match(texto, /Folga: Bia/);
});

test("folgas de turnos diferentes também se espalham pela semana", () => {
  const pessoas = ["a1", "a2", "f1", "f2"].map((id) => ({ id, turnoId: id[0], domingosSeguidos: 0 }));
  const gerados = gerarSemana({
    segunda: "2026-11-02",
    pessoas,
    turnos: [ABERTURA, FECHAMENTO],
    funcionamento: FUNCIONAMENTO_PADRAO,
    jaMarcados: [],
  });
  const dias = gerados.filter((d) => d.tipo === "FOLGA").map((d) => d.dia);
  assert.equal(new Set(dias).size, 4);
});
