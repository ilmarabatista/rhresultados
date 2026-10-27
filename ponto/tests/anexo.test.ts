import { test } from "node:test";
import assert from "node:assert/strict";
import { lerAnexo, MAXIMO_DO_ANEXO, tipoDoAnexo } from "../src/lib/anexo";

const bytes = (...b: number[]) => new Uint8Array([...b, 0, 0, 0, 0]);

test("o tipo do atestado vem dos primeiros bytes", () => {
  assert.equal(tipoDoAnexo(bytes(0xff, 0xd8, 0xff)), "image/jpeg");
  assert.equal(tipoDoAnexo(bytes(0x89, 0x50, 0x4e, 0x47)), "image/png");
  assert.equal(tipoDoAnexo(bytes(0x25, 0x50, 0x44, 0x46)), "application/pdf");
  assert.equal(tipoDoAnexo(bytes(0x3c, 0x68, 0x74, 0x6d)), null); // <htm
});

test("anexo vazio é nenhum anexo", async () => {
  assert.equal(await lerAnexo(null), null);
  assert.equal(await lerAnexo(new File([], "a.jpg")), null);
});

test("PDF passa, com o nome limpo", async () => {
  const r = await lerAnexo(new File([bytes(0x25, 0x50, 0x44, 0x46)], "atestado <dr>.pdf", { type: "application/pdf" }));
  assert.ok(r && typeof r !== "string");
  assert.equal(r.tipo, "application/pdf");
  assert.equal(r.nome, "atestado dr.pdf");
});

test("arquivo que não é foto nem PDF é recusado, mesmo com nome de foto", async () => {
  const r = await lerAnexo(new File(["<html>"], "foto.jpg", { type: "image/jpeg" }));
  assert.equal(typeof r, "string");
});

test("arquivo grande demais é recusado", async () => {
  const r = await lerAnexo(new File([new Uint8Array(MAXIMO_DO_ANEXO + 1)], "a.pdf"));
  assert.match(String(r), /3,5 MB/);
});
