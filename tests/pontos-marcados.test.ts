import { test } from "node:test";
import assert from "node:assert/strict";
import { chaveDoItem, separarPontos, type Respondida } from "../src/lib/pontos-marcados";

const comum = [
  { id: "c1", tipo: "COMPORTAMENTAL", texto: "Pontualidade: chego no horário" },
  { id: "c2", tipo: "COMPORTAMENTAL", texto: "Sigilo: guardo sigilo" },
];

function ficha(funcao: string, pessoaId: string, extras: { id: string; tipo: string; texto: string }[], respostas: Record<string, string>): Respondida {
  return { pessoaId, nome: pessoaId.toUpperCase(), funcao, perguntas: [...comum, ...extras], respostas };
}

const asb = [{ id: "k1", tipo: "CONDUTA", texto: "Celular no atendimento: usei o celular durante um atendimento" }];
const asbAntiga = [{ id: "k1", tipo: "CONDUTA", texto: "Usei o celular durante um atendimento" }];
const recepcao = [{ id: "t1", tipo: "TECNICA", texto: "Caixa: fecho o caixa sem diferença" }];

const respondidas: Respondida[] = [
  ficha("ASB", "ana", asb, { c1: "2", c2: "4", k1: "FREQUENTE" }),
  ficha("ASB", "bia", asbAntiga, { c1: "3", c2: "4", k1: "AS_VEZES" }),
  ficha("ASB", "cris", asb, { c1: "4", c2: "4", k1: "NUNCA" }),
  ficha("Recepção", "duda", recepcao, { c1: "1", c2: "2", t1: "2" }),
  ficha("Recepção", "eva", recepcao, { c1: "3", c2: "4", t1: "4" }),
];

test("a chave ignora o tema, acento e pontuação", () => {
  assert.equal(chaveDoItem("Celular no atendimento: Usei o celular durante um atendimento."), "usei o celular durante um atendimento");
  assert.equal(chaveDoItem("Usei o celular durante um atendimento"), "usei o celular durante um atendimento");
  assert.equal(chaveDoItem("Pontualidade"), "pontualidade");
});

test("marcado em duas funções vai para a reunião geral, com X de Y", () => {
  const s = separarPontos(respondidas);
  assert.equal(s.geral.length, 1);
  const p = s.geral[0];
  assert.equal(p.texto, "Pontualidade: chego no horário");
  assert.equal(p.marcaram, 2);
  assert.equal(p.de, 5);
  assert.deepEqual(
    p.porFuncao.map((f) => [f.funcao, f.marcaram, f.de]),
    [["ASB", 1, 3], ["Recepção", 1, 2]],
  );
});

test("duas pessoas da mesma função vão para o setor, juntando a versão antiga da frase", () => {
  const s = separarPontos(respondidas);
  assert.equal(s.setor.length, 1);
  assert.equal(s.setor[0].funcao, "ASB");
  const p = s.setor[0].pontos[0];
  assert.equal(p.texto, "Celular no atendimento: usei o celular durante um atendimento");
  assert.equal(p.marcaram, 2);
  assert.equal(p.de, 3);
});

test("marcado por uma pessoa só fica no PDI dela", () => {
  const s = separarPontos(respondidas);
  assert.equal(s.pdi.length, 1);
  assert.equal(s.pdi[0].funcao, "Recepção");
  assert.equal(s.pdi[0].pessoas[0].nome, "DUDA");
  assert.deepEqual(
    s.pdi[0].pessoas[0].pontos.map((p) => p.texto).sort(),
    ["Caixa: fecho o caixa sem diferença", "Sigilo: guardo sigilo"],
  );
});

test("abertas, não marcados e 'não faço' não entram", () => {
  const s = separarPontos([
    {
      pessoaId: "x",
      nome: "X",
      funcao: "F",
      perguntas: [
        { id: "a", tipo: "ABERTA", texto: "O que melhorar?" },
        { id: "f", tipo: "TAREFA", texto: "Abrir o caixa" },
      ],
      respostas: { a: "tudo", f: "NAO_FACO" },
    },
  ]);
  assert.equal(s.geral.length + s.setor.length + s.pdi.length, 0);
  assert.equal(s.respondidas, 1);
});
