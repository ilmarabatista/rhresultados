import { test } from "node:test";
import assert from "node:assert/strict";
import { descreverRespostas, pedidoParaApagar, SEM_RESPOSTAS } from "../src/lib/respostas-protegidas";

test("sem resposta nenhuma, não há o que perguntar", () => {
  assert.equal(descreverRespostas(SEM_RESPOSTAS), null);
});

test("descreve cada tipo no singular e no plural, juntando com vírgula e 'e'", () => {
  assert.equal(descreverRespostas({ ...SEM_RESPOSTAS, questionarios: 1 }), "1 questionário de cargo respondido");
  assert.equal(
    descreverRespostas({ ...SEM_RESPOSTAS, autoavaliacoes: 2, clima: 30, fichas: 1 }),
    "2 autoavaliações respondidas, 30 respostas da pesquisa de clima e 1 ficha de solicitação preenchida",
  );
});

test("a pergunta avisa que não há como recuperar", () => {
  assert.match(pedidoParaApagar("1 questionário de cargo respondido"), /apaga para sempre 1 questionário.*Não há como recuperar/);
});
