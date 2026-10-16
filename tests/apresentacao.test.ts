import { test } from "node:test";
import assert from "node:assert/strict";
import { EXTENSOES_ACEITAS, tipoDaApresentacao } from "../src/lib/apresentacao";

test("tipoDaApresentacao decide pelo nome, sem confiar no navegador", () => {
  assert.equal(tipoDaApresentacao("Reunião 3.PDF"), "application/pdf");
  assert.equal(tipoDaApresentacao("slides.final.pptx"), "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  assert.equal(tipoDaApresentacao("foto.jpeg"), "image/jpeg");
});

test("tipoDaApresentacao recusa o que não é apresentação", () => {
  assert.equal(tipoDaApresentacao("pagina.html"), null);
  assert.equal(tipoDaApresentacao("imagem.svg"), null);
  assert.equal(tipoDaApresentacao("sem-extensao"), null);
});

test("EXTENSOES_ACEITAS serve para o accept do campo", () => {
  assert.ok(EXTENSOES_ACEITAS.includes(".pdf"));
  assert.ok(!EXTENSOES_ACEITAS.includes(".html"));
});
