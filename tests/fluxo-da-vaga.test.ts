import { test } from "node:test";
import assert from "node:assert/strict";
import { CRITERIOS, avaliacaoDaIA, candidatoProvavel, lerAvaliacao, nomeParaComparar, pedidoDoParecer, testeEmTexto } from "../src/lib/fluxo-da-vaga";

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

test("avaliação: os quatro critérios na ordem, área não feita fora da conta", () => {
  const a = avaliacaoDaIA(
    {
      criterios: [
        { nome: "Entrevista", nota: 6, comentario: "Respostas curtas." },
        { nome: "Formação e experiência", nota: "8,0", comentario: "Já foi vendedor." },
        { nome: "Perfil comportamental (testes)", nota: null, comentario: "" },
      ],
      pontosFortes: ["Experiência em vendas", ""],
      resumo: "Bom candidato.",
    },
    "abc",
    new Date("2026-10-26T12:00:00Z"),
  );
  assert.ok(a);
  assert.deepEqual(a.criterios.map((c) => c.nome), [...CRITERIOS]);
  assert.equal(a.criterios[0].nota, 8);
  assert.equal(a.criterios[1].nota, -1);
  assert.equal(a.criterios[1].comentario, "Não foi feita.");
  assert.equal(a.nota, 7); // média de 8 e 6
  assert.equal(a.aderencia, "ALTA");
  assert.deepEqual(a.pontosFortes, ["Experiência em vendas"]);
});

test("avaliação: a aderência sai da nota, não do que a IA disse", () => {
  const a = avaliacaoDaIA({ nota: 4.2, aderencia: "ALTA" }, "x");
  assert.equal(a?.aderencia, "BAIXA");
  assert.equal(avaliacaoDaIA({}, "x"), null);
});

test("avaliação guardada volta igual, com as áreas não feitas", () => {
  const a = avaliacaoDaIA({ nota: 6, criterios: [{ nome: "Entrevista", nota: 6 }] }, "assin", new Date("2026-10-26T12:00:00Z"));
  const lida = lerAvaliacao(JSON.parse(JSON.stringify(a)));
  assert.deepEqual(lida, a);
  assert.equal(lerAvaliacao({ nota: 5 }), null);
});
