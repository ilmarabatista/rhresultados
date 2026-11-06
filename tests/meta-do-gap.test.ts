import { test } from "node:test";
import assert from "node:assert/strict";
import { lerItem, metaDoGap } from "../src/lib/meta-do-gap";
import { checarSmart, lerTipoDeAcao } from "../src/lib/pdi";

const nota = (nome: string, pessoa: number | null, tipo = "TECNICA") => ({
  nome,
  tipo,
  esperado: 3,
  pessoa,
  avaliador: null,
  acordado: null,
});
const plano = { inicio: "2026-11-06", fim: "2027-02-04" };

test("lerItem separa tipo, tema e frase", () => {
  assert.deepEqual(lerItem("Pontualidade: chego sempre no horário"), {
    tipoDoGap: "COMPETENCIA",
    tema: "Pontualidade",
    frase: "chego sempre no horário",
    texto: "Pontualidade: chego sempre no horário",
  });
  assert.equal(lerItem("Tarefa: Compras e prestação de contas").tipoDoGap, "TAREFA");
  assert.equal(lerItem("Tarefa: Compras e prestação de contas").frase, null);
  assert.equal(lerItem("Conduta: Celular no atendimento: usei o celular").tema, "Celular no atendimento");
});

test("competência: meta SMART completa, com 3 ações do 70-20-10 dentro do plano", () => {
  const m = metaDoGap(nota("Pontualidade: chego sempre no horário", 1, "COMPORTAMENTAL"), plano);
  assert.equal(m.titulo, "Pontualidade: chego sempre no horário");
  assert.match(m.indicador, /Hoje: nota 1/);
  assert.ok(Object.values(checarSmart(m)).every(Boolean));
  assert.deepEqual(m.acoes.map((a) => a.tipo).sort(), ["FORMAL", "PRATICA", "TROCA"]);
  for (const a of m.acoes) {
    assert.ok(a.prazo! >= plano.inicio && a.prazo! <= plano.fim);
    assert.equal(lerTipoDeAcao(a.tipo), a.tipo);
  }
  assert.ok(m.acoes.some((a) => a.titulo.includes("pontualidade")));
});

test("competência do cargo sem frase mantém o título de nível", () => {
  const m = metaDoGap(nota("Negociação", 2), plano);
  assert.equal(m.titulo, "Levar Negociação do nível 2 para o nível 3");
});

test("tarefa: quem quer aprender começa aprendendo; quem faz com ajuda não", () => {
  const aprender = metaDoGap(nota("Tarefa: Fechamento da clínica", 1), plano);
  const comAjuda = metaDoGap(nota("Tarefa: Fechamento da clínica", 2), plano);
  assert.equal(aprender.titulo, "Fazer sem ajuda: fechamento da clínica");
  assert.equal(aprender.acoes.length, 3);
  assert.equal(comAjuda.acoes.length, 2);
  assert.match(comAjuda.indicador, /com ajuda/);
});

test("conduta: meta é deixar de acontecer, dizendo a frequência de hoje", () => {
  const m = metaDoGap(nota("Conduta: Celular no atendimento: usei o celular durante um atendimento", 1), plano);
  assert.equal(m.titulo, "Celular no atendimento: deixar de acontecer");
  assert.match(m.indicador, /frequentemente/);
  assert.ok(Object.values(checarSmart(m)).every(Boolean));
});

test("prazo nunca passa do fim do plano, e sem datas fica vazio", () => {
  const curto = metaDoGap(nota("Tarefa: Abertura: ligo as TVs", 1), { inicio: "2026-11-06", fim: "2026-11-20" });
  assert.ok(curto.acoes.every((a) => a.prazo! <= "2026-11-20"));
  const semData = metaDoGap(nota("Comunicação: falo com clareza", 2), { inicio: null, fim: null });
  assert.ok(semData.acoes.every((a) => a.prazo === null));
  assert.equal(semData.prazo, null);
});

test("sigla no começo do tema não vira minúscula", () => {
  const m = metaDoGap(nota("CRM: respondo os leads no mesmo dia", 2), plano);
  assert.ok(m.acoes.some((a) => a.titulo.includes("CRM")));
});
