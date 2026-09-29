import { test } from "node:test";
import assert from "node:assert/strict";
import { nomeCurto } from "../src/lib/produtos";

test("o nome curto do produto nas listas", () => {
  assert.equal(nomeCurto("recrutamento-selecao", "Recrutamento e seleção", "Recrutamento e seleção"), "R&S");
  assert.equal(nomeCurto("analise-clima", "Pesquisa de clima e cultura"), "PCC");
  // O complemento do nome fica depois do nome curto.
  assert.equal(
    nomeCurto("fortalecimento-cultura", "Encontros de fortalecimento da cultura — Loja 2", "Encontros de fortalecimento da cultura"),
    "Cultura — Loja 2",
  );
  // Nome que não começa pelo do catálogo foi escolhido à mão: fica.
  assert.equal(nomeCurto("pdi", "PDI da diretoria", "Plano de Desenvolvimento Individual (PDI)"), "PDI da diretoria");
  // Sem nome curto, ou fora do catálogo, fica o nome inteiro.
  assert.equal(nomeCurto("treinamento", "Treinamento"), "Treinamento");
  assert.equal(nomeCurto(null, "Consultoria avulsa"), "Consultoria avulsa");
});
