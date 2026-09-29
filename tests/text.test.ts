import { test } from "node:test";
import assert from "node:assert/strict";
import { iniciais, linhasComoItens, semAcento, slugify } from "../src/lib/text";

test("semAcento preserva a letra base", () => {
  assert.equal(semAcento("Avaliação de Desempenho"), "Avaliacao de Desempenho");
  assert.equal(semAcento("Goiânia"), "Goiania");
  assert.equal(semAcento("sem acento"), "sem acento");
});

test("slugify gera identificador estável", () => {
  assert.equal(slugify("Avaliação de Desempenho"), "avaliacao-de-desempenho");
  assert.equal(slugify("Recrutamento e Seleção"), "recrutamento-e-selecao");
  // Pontuação e espaços viram um único hífen, sem sobrar nas pontas.
  assert.equal(slugify("  Clima & Cultura!  "), "clima-cultura");
  assert.equal(slugify("Oral-C"), "oral-c");
});

test("slugify é estável entre chamadas com a mesma entrada", () => {
  assert.equal(slugify("Análise de Clima"), slugify("Análise de Clima"));
});

test("iniciais devolve no máximo duas letras", () => {
  assert.equal(iniciais("Ilmara Batista"), "IB");
  assert.equal(iniciais("Maria da Silva Souza"), "MD");
  assert.equal(iniciais("Administrador"), "A");
  // Espaços extras não viram iniciais vazias.
  assert.equal(iniciais("  Ana   Paula  "), "AP");
});

test("linhasComoItens remove marcadores de lista", () => {
  const texto = [
    "1. Definir o modelo",
    "2) Definir o período",
    "- Estruturar o instrumento",
    "• Comunicar o início",
    "* Coletar as respostas",
    "   ",
    "Analisar os dados",
  ].join("\n");

  assert.deepEqual(linhasComoItens(texto), [
    "Definir o modelo",
    "Definir o período",
    "Estruturar o instrumento",
    "Comunicar o início",
    "Coletar as respostas",
    "Analisar os dados",
  ]);
});

test("linhasComoItens aceita quebras do Windows e texto vazio", () => {
  assert.deepEqual(linhasComoItens("Uma\r\nDuas"), ["Uma", "Duas"]);
  assert.deepEqual(linhasComoItens(""), []);
  assert.deepEqual(linhasComoItens("\n\n  \n"), []);
});
