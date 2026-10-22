import { test } from "node:test";
import assert from "node:assert/strict";
import { ehPdf, nomeDoCurriculo, problemaDoCurriculo, tamanhoLegivel, TAMANHO_DO_CURRICULO } from "../src/lib/curriculo";

const pdf = new TextEncoder().encode("%PDF-1.7\n...");

test("PDF é reconhecido pelo conteúdo, não pelo nome", () => {
  assert.equal(ehPdf(pdf), true);
  assert.equal(ehPdf(new TextEncoder().encode("lixo antes %PDF-1.4")), true);
  assert.equal(ehPdf(new TextEncoder().encode("PK\u0003\u0004 docx")), false);
  assert.equal(ehPdf(new Uint8Array()), false);
});

test("problemas do arquivo", () => {
  assert.equal(problemaDoCurriculo(100, pdf), null);
  assert.match(problemaDoCurriculo(0, pdf) ?? "", /Escolha/);
  assert.match(problemaDoCurriculo(TAMANHO_DO_CURRICULO + 1, pdf) ?? "", /4 MB/);
  assert.match(problemaDoCurriculo(100, new TextEncoder().encode("<html>")) ?? "", /não é um PDF/);
});

test("nome do arquivo limpo e sempre .pdf", () => {
  assert.equal(nomeDoCurriculo("C:\\fakepath\\Currículo Maria.pdf"), "Currículo Maria.pdf");
  assert.equal(nomeDoCurriculo("cv"), "cv.pdf");
  assert.equal(nomeDoCurriculo('a"<b>.PDF'), "ab.PDF");
  assert.equal(nomeDoCurriculo(""), "curriculo.pdf");
});

test("tamanho legível", () => {
  assert.equal(tamanhoLegivel(312_000), "305 KB");
  assert.equal(tamanhoLegivel(2_621_440), "2,5 MB");
});
