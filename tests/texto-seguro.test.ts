import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cabeNoBanco,
  temCaractereProibido,
  textoSeguro,
} from "../src/lib/texto-seguro";

test("português inteiro passa sem mudar nada", () => {
  const texto =
    "Ação, coração, você, José — “aspas curvas”, reticências… e bullet •.";
  assert.equal(textoSeguro(texto), texto);
  assert.equal(temCaractereProibido(texto), false);
});

test("emoji é removido", () => {
  assert.equal(textoSeguro("Foto do mural 📸 hoje"), "Foto do mural hoje");
  assert.equal(temCaractereProibido("Foto 📸"), true);
});

test("emoji no fim da linha não deixa espaço sobrando", () => {
  assert.equal(textoSeguro("Bom trabalho 👏\nPróximo passo"), "Bom trabalho\nPróximo passo");
});

test("emoji composto some inteiro", () => {
  // Família com juntor invisível: são vários pontos de código num só desenho.
  assert.equal(textoSeguro("Equipe 👨‍👩‍👧 reunida"), "Equipe reunida");
});

test("texto que não muda volta idêntico, sem trim", () => {
  assert.equal(textoSeguro("  espaço de propósito  "), "  espaço de propósito  ");
});

test("cabeNoBanco reconhece o que o WIN1252 tem", () => {
  assert.equal(cabeNoBanco("ç"), true);
  assert.equal(cabeNoBanco("—"), true);
  assert.equal(cabeNoBanco("€"), true);
  assert.equal(cabeNoBanco("…"), true);
  assert.equal(cabeNoBanco("📸"), false);
  assert.equal(cabeNoBanco("→"), false);
});

// Apagar o hífen fino colaria as palavras: "quinta-feira" viraria outra coisa.
test("hífen fino vira hífen comum, e não some", () => {
  assert.equal(textoSeguro("quinta\u2011feira"), "quinta-feira");
  assert.equal(textoSeguro("post\u2011its"), "post-its");
  assert.equal(textoSeguro("palavras\u2011chave"), "palavras-chave");
});

test("seta e sinal viram texto legível", () => {
  assert.equal(textoSeguro("antes \u2192 depois"), "antes -> depois");
  assert.equal(textoSeguro("\u2713 feito"), "ok feito");
});

test("espaço estreito vira espaço normal", () => {
  assert.equal(textoSeguro("45\u202fmin"), "45 min");
});
