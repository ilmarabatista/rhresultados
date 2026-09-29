import { test } from "node:test";
import assert from "node:assert/strict";
import { celula, montarCsv } from "../src/lib/csv";

test("celula envolve em aspas e escapa aspas internas", () => {
  assert.equal(celula("simples"), '"simples"');
  assert.equal(celula('com "aspas"'), '"com ""aspas"""');
});

test("celula neutraliza o que quebraria a linha ou a coluna", () => {
  // Quebra de linha dentro do campo estouraria a linha do CSV.
  assert.equal(celula("linha um\nlinha dois"), '"linha um linha dois"');
  // Ponto e vírgula é o separador; dentro de aspas ele é literal.
  assert.equal(celula("a;b"), '"a;b"');
});

test("celula trata nulo e indefinido como vazio", () => {
  assert.equal(celula(null), '""');
  assert.equal(celula(undefined), '""');
  assert.equal(celula("   "), '""');
});

test("montarCsv começa com BOM UTF-8", () => {
  const csv = montarCsv(["Coluna"], [["valor"]]);
  // Sem o BOM o Excel em português embaralha os acentos.
  assert.equal(csv.charCodeAt(0), 0xfeff);
});

test("montarCsv usa ponto e vírgula e quebra CRLF", () => {
  const csv = montarCsv(["A", "B"], [["1", "2"]]);
  const linhas = csv.slice(1).split("\r\n");
  assert.deepEqual(linhas, ['"A";"B"', '"1";"2"']);
});

test("montarCsv sem linhas devolve só o cabeçalho", () => {
  const csv = montarCsv(["Empresa", "Etapa"], []);
  assert.equal(csv.slice(1), '"Empresa";"Etapa"');
});
