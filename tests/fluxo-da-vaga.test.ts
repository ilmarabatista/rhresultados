import { test } from "node:test";
import assert from "node:assert/strict";
import { candidatoProvavel, nomeParaComparar, pedidoDoParecer, testeEmTexto } from "../src/lib/fluxo-da-vaga";

const candidatos = [
  { id: "a", nome: "Victor Souza", situacao: "REPROVADO" },
  { id: "b", nome: "Víctor  Souza", situacao: "EM_ANDAMENTO" },
  { id: "c", nome: "Paulo Lima", situacao: "EM_ANDAMENTO" },
  { id: "d", nome: "Belarmino", situacao: "EM_ANDAMENTO" },
];

test("nome sem acento, caixa e espaço sobrando", () => {
  assert.equal(nomeParaComparar("  Víctor   SOUZA "), "victor souza");
});

test("nome igual: prefere quem está no processo", () => {
  assert.equal(candidatoProvavel("victor souza", candidatos), "b");
});

test("primeiro nome só quando é único na vaga", () => {
  assert.equal(candidatoProvavel("Paulo", candidatos), "c");
  assert.equal(candidatoProvavel("Victor", candidatos), null);
  assert.equal(candidatoProvavel("Ana", candidatos), null);
  assert.equal(candidatoProvavel("  ", candidatos), null);
});

test("DISC em uma linha", () => {
  const linha = testeEmTexto("DISC", {
    pontos: { D: 1, I: 1, S: 1, C: 1 },
    percentuais: { D: 80, I: 60, S: 20, C: 10 },
    principal: "D",
    secundario: "I",
    perfil: "DI",
  });
  assert.match(linha, /^DISC: perfil DI/);
  assert.match(linha, /D 80%/);
});

test("resultado ilegível não quebra", () => {
  assert.equal(testeEmTexto("X", null), "X: resultado ilegível.");
});

test("pedido marca o que não foi feito", () => {
  const p = pedidoDoParecer({ vaga: "Vendedor", cargo: null, ficha: null, testes: [], entrevista: null, anotacoes: [{ etapa: "Triagem", texto: "Boa conversa" }] });
  assert.match(p, /<descricao_do_cargo>não feito<\/descricao_do_cargo>/);
  assert.match(p, /<testes>não feito<\/testes>/);
  assert.match(p, /Triagem: Boa conversa/);
});
