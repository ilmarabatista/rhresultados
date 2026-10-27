import { test } from "node:test";
import assert from "node:assert/strict";
import { detalheDoCombinado, ordenarEmAberto, textoDoRelatorio, type RelatorioDaReuniao } from "../src/lib/reuniao-relatorio";

const base: RelatorioDaReuniao = {
  empresa: "Clínica Teste",
  titulo: "Escala de sábado",
  codigo: "REU-0001",
  dia: "2026-10-28",
  hora: "14:00",
  presentes: ["Ana Paula Lima"],
  ausentes: ["Bruno Costa"],
  resumo: "Tratou da escala de sábado.",
  conversado: ["Movimento aos sábados"],
  decidido: [{ texto: "Plantão revezado", porque: "Movimento maior" }],
  combinado: [{ texto: "Mandar a escala", responsavel: "Ana", prazo: "2026-10-30", feito: false }],
  emAberto: [{ texto: "Comprar uniformes", responsavel: null, prazo: "2026-10-20", feito: false, reuniao: "REU-0000 Kickoff" }],
};

test("o detalhe do combinado diz quem, até quando e como está o prazo", () => {
  assert.equal(detalheDoCombinado(base.combinado[0], "2026-10-29"), "Ana · até 30/10/2026 · no prazo");
  assert.equal(detalheDoCombinado(base.combinado[0], "2026-10-31"), "Ana · até 30/10/2026 · atrasado");
  assert.equal(detalheDoCombinado({ texto: "x", responsavel: null, prazo: null, feito: false }, "2026-10-29"), "sem responsável");
});

test("os em aberto vêm pelo prazo, os sem data no fim", () => {
  const lista = ordenarEmAberto([{ prazo: null }, { prazo: "2026-11-02" }, { prazo: "2026-10-01" }]);
  assert.deepEqual(lista.map((c) => c.prazo), ["2026-10-01", "2026-11-02", null]);
});

test("o texto do WhatsApp tem as partes em negrito e a presença", () => {
  const t = textoDoRelatorio(base, "2026-10-29");
  assert.match(t, /^\*Relatório de reunião · Clínica Teste\*/);
  assert.match(t, /28\/10\/2026, 14:00/);
  assert.match(t, /1 de 2 presentes\nAna Paula Lima\nAusentes: Bruno Costa/);
  assert.match(t, /\*Decisões\*\n• Plantão revezado \(Movimento maior\)/);
  assert.match(t, /\*Próximos passos\*\n• Mandar a escala — Ana · até 30\/10\/2026 · no prazo/);
  assert.match(t, /\*Ainda em aberto de reuniões anteriores\*\n• Comprar uniformes — sem responsável · até 20\/10\/2026 · atrasado \(REU-0000 Kickoff\)/);
  assert.doesNotMatch(t, /ainda não foi preenchida/);
});

test("com a ata vazia o texto avisa", () => {
  const t = textoDoRelatorio({ ...base, resumo: "", conversado: [], decidido: [], combinado: [], emAberto: [] }, "2026-10-29");
  assert.match(t, /A ata desta reunião ainda não foi preenchida\./);
});
