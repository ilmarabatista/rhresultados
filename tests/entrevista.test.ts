import { test } from "node:test";
import assert from "node:assert/strict";
import { SEM_RESPOSTA, lerEntrevista, lerPerguntas, pedidoDaEntrevista, respostasDaIA } from "../src/lib/entrevista";

test("perguntas: uma por linha, sem numeração, vazias ou repetidas", () => {
  assert.deepEqual(lerPerguntas("1. Fale de você\n\n2) Por que saiu?\n- fale de você\n  • Pretensão?  "), [
    "Fale de você",
    "Por que saiu?",
    "Pretensão?",
  ]);
  assert.deepEqual(lerPerguntas(["A", " ", "B"]), ["A", "B"]);
  assert.deepEqual(lerPerguntas(null), []);
});

test("o pedido numera o roteiro e leva a transcrição", () => {
  const p = pedidoDaEntrevista(["A", "B"], "conversa");
  assert.ok(p.includes("1. A\n2. B"));
  assert.ok(p.includes("<transcricao>\nconversa\n</transcricao>"));
});

test("respostas da IA casam pelo número e as perguntas são sempre as do roteiro", () => {
  const r = respostasDaIA(
    { respostas: [{ numero: 2, resposta: "Mudança de cidade" }, { numero: 1, resposta: "Sou atendente" }], outros: "Tem moto" },
    ["Fale de você", "Por que saiu?", "Pretensão?"],
  );
  assert.deepEqual(r.respostas, [
    { pergunta: "Fale de você", resposta: "Sou atendente" },
    { pergunta: "Por que saiu?", resposta: "Mudança de cidade" },
    { pergunta: "Pretensão?", resposta: SEM_RESPOSTA },
  ]);
  assert.equal(r.outros, "Tem moto");
});

test("sem número, a IA vale pela posição; lixo vira não respondida", () => {
  const r = respostasDaIA({ respostas: [{ resposta: "um" }, "lixo", { numero: 99, resposta: "três" }] }, ["A", "B", "C"]);
  assert.deepEqual(
    r.respostas.map((x) => x.resposta),
    ["um", SEM_RESPOSTA, "três"],
  );
  assert.deepEqual(respostasDaIA("nada", ["A"]).respostas, [{ pergunta: "A", resposta: SEM_RESPOSTA }]);
});

test("lerEntrevista tolera formato errado", () => {
  assert.equal(lerEntrevista(null), null);
  assert.equal(lerEntrevista([]), null);
  const e = lerEntrevista({ respostas: [{ pergunta: "A", resposta: 5 }, { resposta: "sem pergunta" }], avaliacao: "boa" });
  assert.deepEqual(e?.respostas, [{ pergunta: "A", resposta: "" }]);
  assert.equal(e?.avaliacao, "boa");
});
