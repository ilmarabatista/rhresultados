import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MINIMO_DA_REDACAO,
  duracao,
  fichaParaGravar,
  fichaVazia,
  idadeEm,
  lerFicha,
  problemasDaFicha,
  problemasDoPasso,
  tempoNaEmpresa,
  type Ficha,
} from "../src/lib/ficha";

function fichaCompleta(): Ficha {
  const f = fichaVazia("Recepcionista");
  f.vaga.pretensao = "2.000";
  f.pessoal = {
    nome: "Maria da Silva",
    nascimento: "1995-03-21",
    naturalidade: "João Pessoa, PB",
    endereco: "Rua A, 10",
    bairro: "Centro",
    cep: "58000-000",
    cidade: "João Pessoa",
    celular: "(83) 9 9999-9999",
    email: "maria@exemplo.com",
  };
  f.formacao.nivel = "Médio completo";
  f.formacao.situacao = "CONCLUIDO";
  f.experiencias = [
    { empresa: "Loja X", cargo: "Atendente", entrada: "2022-01", saida: "2024-04", salario: "1.800", motivoSaida: "Mudança", contato: "" },
  ];
  f.indicacao.indicado = "NAO";
  f.redacao.qualidades = "a".repeat(MINIMO_DA_REDACAO);
  f.redacao.expectativas = "b".repeat(MINIMO_DA_REDACAO);
  f.aceite = true;
  return f;
}

test("ficha completa não tem problemas", () => {
  assert.deepEqual(problemasDaFicha(fichaCompleta()), []);
});

test("cada passo cobra o que é dele", () => {
  const f = fichaVazia();
  assert.ok(problemasDoPasso(f, 0).some((e) => e.includes("cargo")));
  assert.ok(problemasDoPasso(f, 1).some((e) => e.includes("celular")));
  assert.ok(problemasDoPasso(f, 3).some((e) => e.includes("primeiro emprego")));
  assert.ok(problemasDoPasso(f, 4).some((e) => e.includes("indicado")));
  assert.ok(problemasDoPasso(f, 6).some((e) => e.includes("privacidade")));
});

test("primeiro emprego dispensa a experiência", () => {
  const f = fichaCompleta();
  f.experiencias = [];
  f.primeiroEmprego = true;
  assert.deepEqual(problemasDoPasso(f, 3), []);
  assert.deepEqual(fichaParaGravar(f).experiencias, []);
});

test("indicação pede nome e proximidade só quando foi indicado", () => {
  const f = fichaCompleta();
  f.indicacao.indicado = "SIM";
  assert.equal(problemasDoPasso(f, 4).length, 2);
  f.indicacao.nome = "João";
  f.indicacao.proximidade = "amigo";
  assert.deepEqual(problemasDoPasso(f, 4), []);
});

test("redação com espaços não engana o mínimo", () => {
  const f = fichaCompleta();
  f.redacao.qualidades = "curto" + " ".repeat(MINIMO_DA_REDACAO);
  assert.equal(problemasDoPasso(f, 5).length, 1);
});

test("saída antes da entrada é apontada", () => {
  const f = fichaCompleta();
  f.experiencias[0].saida = "2021-01";
  assert.ok(problemasDoPasso(f, 3).some((e) => e.includes("antes da entrada")));
});

test("lerFicha não confia no que vem: tipos, datas, listas e emoji", () => {
  const f = lerFicha({
    vaga: { cargo: 123, viagens: "TALVEZ" },
    pessoal: { nome: "Ana 😀 Souza", nascimento: "21/03/1995" },
    formacao: { nivel: "Doutorado em tudo" },
    experiencias: Array.from({ length: 30 }, () => ({ empresa: "X", entrada: "2020-13" })),
    medidas: { segundosNaRedacao: -5, colouNaRedacao: "sim" },
    aceite: "true",
  });
  assert.equal(f.vaga.cargo, "");
  assert.equal(f.vaga.viagens, "");
  assert.ok(!f.pessoal.nome.includes("😀"));
  assert.equal(f.pessoal.nascimento, "");
  assert.equal(f.formacao.nivel, "");
  assert.equal(f.experiencias.length, 15);
  assert.equal(f.experiencias[0].entrada, "");
  assert.equal(f.medidas.segundosNaRedacao, 0);
  assert.equal(f.medidas.colouNaRedacao, false);
  assert.equal(f.aceite, false);
});

test("a ficha lida de volta é igual à gravada", () => {
  const f = fichaParaGravar(fichaCompleta());
  assert.deepEqual(lerFicha(JSON.parse(JSON.stringify(f))), f);
});

test("idade conta o aniversário", () => {
  assert.equal(idadeEm("1995-03-21", new Date(2026, 2, 20)), 30);
  assert.equal(idadeEm("1995-03-21", new Date(2026, 2, 21)), 31);
  assert.equal(idadeEm("lixo"), null);
});

test("tempo na empresa em palavras", () => {
  assert.equal(tempoNaEmpresa("2022-01", "2023-04"), "1 ano e 3 meses");
  assert.equal(tempoNaEmpresa("2022-01", "2022-02"), "1 mês");
  assert.equal(tempoNaEmpresa("2024-01", "", new Date(2026, 0, 15)), "2 anos");
  assert.equal(tempoNaEmpresa("2024-05", "2024-01"), "");
});

test("duração legível", () => {
  assert.equal(duracao(40), "40 s");
  assert.equal(duracao(754), "13 min");
  assert.equal(duracao(3900), "1 h 5 min");
});
