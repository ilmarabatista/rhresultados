import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ataDaIA,
  conviteDaReuniao,
  juntarTranscricao,
  lerLinkDaChamada,
  limparTrecho,
  pedidoDaReuniao,
} from "../src/lib/reuniao-gravada";

test("o link da chamada aceita o do Meet com ou sem https e recusa o que não é link", () => {
  assert.equal(lerLinkDaChamada("meet.google.com/abc-defg-hij"), "https://meet.google.com/abc-defg-hij");
  assert.equal(lerLinkDaChamada(" https://meet.google.com/abc-defg-hij "), "https://meet.google.com/abc-defg-hij");
  assert.equal(lerLinkDaChamada(""), null);
  assert.equal(lerLinkDaChamada("reunião amanhã"), "invalido");
  assert.equal(lerLinkDaChamada("javascript:alert(1)"), "invalido");
});

test("o convite leva o primeiro nome, o dia, a hora, o link e o aviso de gravação", () => {
  const c = conviteDaReuniao({
    nome: "Maria Souza",
    titulo: "Alinhamento da recepção",
    dia: "2026-10-28",
    hora: "14:00",
    link: "https://meet.google.com/abc-defg-hij",
    gravada: true,
  });
  assert.match(c, /^Olá, Maria!/);
  assert.match(c, /28\/10\/2026, às 14:00/);
  assert.match(c, /https:\/\/meet\.google\.com\/abc-defg-hij/);
  assert.match(c, /será gravada/);
  assert.match(conviteDaReuniao({ titulo: "X", dia: null, hora: null, link: "https://a.b", gravada: false }), /^Olá! /);
});

test("o trecho perde as frases que o Whisper inventa no silêncio", () => {
  assert.equal(limparTrecho("Legendas pela comunidade Amara.org"), "");
  assert.equal(limparTrecho("  Vamos começar   pela pauta.  Obrigado por assistir! "), "Vamos começar pela pauta.");
});

test("a transcrição junta os trechos com a hora e pula os vazios", () => {
  assert.equal(
    juntarTranscricao([
      { hora: "14:00", texto: "Bom dia." },
      { hora: "14:02", texto: "  " },
      { hora: "14:04", texto: "Próximo ponto." },
    ]),
    "[14:00] Bom dia.\n\n[14:04] Próximo ponto.",
  );
});

test("o pedido à IA leva o título, o dia, os participantes e a pauta", () => {
  const p = pedidoDaReuniao({
    titulo: "Reunião de equipe",
    dia: "2026-10-28",
    participantes: ["Ana", "Bruno"],
    pauta: "Escala de dezembro",
    transcricao: "[14:00] Bom dia.",
  });
  assert.match(p, /Reunião de equipe/);
  assert.match(p, /2026-10-28/);
  assert.match(p, /Ana, Bruno/);
  assert.match(p, /Escala de dezembro/);
});

test("a ata da IA é lida com tolerância e descarta o que vem fora do formato", () => {
  const ata = ataDaIA({
    resumo: " Reunião sobre a escala. ",
    conversado: ["Escala de dezembro", "", 3, { texto: "Férias" }],
    decidido: [{ texto: "Plantão aos sábados", porque: "Movimento maior" }, "Uniforme novo", { porque: "sem texto" }],
    combinado: [
      { texto: "Mandar a escala", responsavel: "Ana", prazo: "2026-11-03" },
      { texto: "Ver orçamento", responsavel: "", prazo: "semana que vem" },
      { texto: "Data impossível", prazo: "2026-02-30" },
    ],
  });
  assert.equal(ata.resumo, "Reunião sobre a escala.");
  assert.deepEqual(ata.conversado, ["Escala de dezembro", "Férias"]);
  assert.deepEqual(ata.decidido, [
    { texto: "Plantão aos sábados", porque: "Movimento maior" },
    { texto: "Uniforme novo", porque: "" },
  ]);
  assert.deepEqual(
    ata.combinado.map((c) => c.prazo),
    ["2026-11-03", null, null],
  );
  assert.deepEqual(ataDaIA(null), { resumo: "", conversado: [], decidido: [], combinado: [] });
});
