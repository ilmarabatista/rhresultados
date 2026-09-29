import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calcularDisc,
  conferirRespostas,
  FATORES,
  lerFormularioDisc,
  OPCOES_POR_FATOR,
  QUESTOES_DISC,
  type Fator,
  type RespostaDisc,
} from "../src/lib/disc";

/** As questões em que o gabarito da consultoria repete um fator (1 = questão 1). */
const COM_REPETICAO = [2, 5, 13, 15, 17, 18];

test("são 26 questões com o gabarito da consultoria", () => {
  assert.equal(QUESTOES_DISC.length, 26);
  assert.deepEqual(OPCOES_POR_FATOR, { D: 28, I: 24, S: 28, C: 24 });
  QUESTOES_DISC.forEach((q, i) => {
    assert.equal(q.opcoes.length, 4, `questão ${i + 1}`);
    const fatores = new Set(q.opcoes.map((o) => o.fator));
    if (COM_REPETICAO.includes(i + 1)) assert.equal(fatores.size, 3, `questão ${i + 1} repete um fator`);
    else assert.deepEqual([...fatores].sort(), [...FATORES].sort(), `questão ${i + 1}`);
  });
  // Três linhas do gabarito, conferidas uma a uma.
  assert.deepEqual(QUESTOES_DISC[1].opcoes.map((o) => o.fator), ["D", "I", "S", "D"]);
  assert.deepEqual(QUESTOES_DISC[16].opcoes.map((o) => o.fator), ["S", "C", "S", "D"]);
  assert.deepEqual(QUESTOES_DISC[21].opcoes.map((o) => o.fator), ["D", "I", "C", "S"]);
});

/** Notas 4, 3, 2, 1 pela ordem de preferência dos fatores; fator repetido pega o número seguinte. */
function preferindo(ordem: Fator[]): RespostaDisc[] {
  return QUESTOES_DISC.map((q) => {
    const posicoes = q.opcoes.map((o, i) => ({ i, rank: ordem.indexOf(o.fator) })).sort((a, b) => a.rank - b.rank || a.i - b.i);
    const notas = new Array<number>(q.opcoes.length);
    posicoes.forEach((p, k) => (notas[p.i] = 4 - k));
    return notas;
  });
}

test("quem sempre prefere o Dominante e deixa o Estável por último fica D, com S no fim", () => {
  const respostas = preferindo(["D", "I", "C", "S"]);
  assert.equal(conferirRespostas(respostas), null);
  const r = calcularDisc(respostas);
  assert.equal(r.pontos.D + r.pontos.I + r.pontos.S + r.pontos.C, 260);
  assert.equal(r.principal, "D");
  assert.equal(r.secundario, "I");
  assert.ok(r.percentuais.D >= 95);
  assert.ok(r.percentuais.S <= 5);
  assert.ok(FATORES.every((f) => r.percentuais[f] >= 0 && r.percentuais[f] <= 100));
});

test("a repetição do gabarito não favorece D e S: notas iguais dão percentuais iguais", () => {
  // Nota 2,5 de média em todos os fatores dá 50% em todos, mesmo com D e S tendo mais opções.
  const r = calcularDisc(QUESTOES_DISC.map(() => [4, 1, 3, 2]));
  const r2 = calcularDisc(QUESTOES_DISC.map(() => [1, 4, 2, 3]));
  for (const f of FATORES) {
    const media = Math.round((r.percentuais[f] + r2.percentuais[f]) / 2);
    assert.ok(Math.abs(media - 50) <= 1, `${f}: ${media}`);
  }
});

test("recusa questão sem nota, com empate ou com número fora de 1 a 4", () => {
  const ok = QUESTOES_DISC.map(() => [4, 3, 2, 1]);
  assert.equal(conferirRespostas(ok), null);
  assert.match(conferirRespostas([...ok.slice(0, 25), null]) ?? "", /questão 26/);
  assert.match(conferirRespostas([[4, 3, 3, 4], ...ok.slice(1)]) ?? "", /uma vez só/);
  assert.match(conferirRespostas([[5, 3, 2, 1], ...ok.slice(1)]) ?? "", /de 1 a 4/);
});

test("lê o formulário campo a campo", () => {
  const fd = new FormData();
  ["4", "3", "1", "2"].forEach((n, o) => fd.set(`q-0-${o}`, n));
  fd.set("q-1-0", "4");
  const lido = lerFormularioDisc(fd);
  assert.deepEqual(lido[0], [4, 3, 1, 2]);
  assert.equal(lido[1], null);
});
