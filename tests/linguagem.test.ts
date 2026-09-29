import { test } from "node:test";
import assert from "node:assert/strict";
import {
  LIMITE_PALAVRAS_POR_FRASE,
  linguagemSimples,
  mediaPalavrasPorFrase,
  palavrasDificeis,
  TERMOS_DIFICEIS,
} from "../src/lib/roteiros";

// --------------------------------------------------- termos difíceis

test("palavrasDificeis acha o jargão e sugere o que dizer", () => {
  const r = palavrasDificeis("Vamos otimizar o turnover da equipe");
  const termos = r.map((x) => x.termo);

  assert.ok(termos.includes("otimizar"), JSON.stringify(termos));
  assert.ok(termos.includes("turnover"), JSON.stringify(termos));
  assert.equal(r.find((x) => x.termo === "turnover")?.sugestao, "rotatividade");
});

test("palavrasDificeis pega o termo no começo e no fim da frase", () => {
  assert.ok(palavrasDificeis("Turnover é o problema").length > 0);
  assert.ok(palavrasDificeis("o problema é o turnover").length > 0);
  assert.ok(palavrasDificeis("otimizar.").length > 0);
});

test("palavrasDificeis pega termo de duas palavras", () => {
  const r = palavrasDificeis("virou um passivo trabalhista alto");
  assert.ok(r.some((x) => x.termo === "passivo trabalhista"), JSON.stringify(r));
});

test("palavrasDificeis ignora acento e caixa", () => {
  assert.ok(palavrasDificeis("ASSERTIVIDADE").length > 0);
  assert.ok(palavrasDificeis("Reclamatória").length > 0);
});

test("palavrasDificeis não casa dentro de outra palavra", () => {
  // "robusto" está na lista; "arrobustecer" não deve disparar.
  assert.deepEqual(palavrasDificeis("arrobustecer o time"), []);
  assert.deepEqual(palavrasDificeis("performático"), []);
});

test("palavrasDificeis deixa passar texto simples", () => {
  assert.deepEqual(
    palavrasDificeis("Você contrata, treina, e em três meses a vaga abre de novo."),
    [],
  );
});

test("toda sugestão é mais simples que o termo, e não é vazia", () => {
  for (const [termo, sugestao] of Object.entries(TERMOS_DIFICEIS)) {
    assert.ok(sugestao.trim().length > 0, termo);
    assert.notEqual(sugestao.toLowerCase(), termo.toLowerCase());
  }
});

// ----------------------------------------------------- tamanho da frase

test("mediaPalavrasPorFrase conta certo", () => {
  assert.equal(mediaPalavrasPorFrase("Um dois três. Um dois três."), 3);
  assert.equal(mediaPalavrasPorFrase("Uma frase com cinco palavras."), 5);
});

test("mediaPalavrasPorFrase aceita ponto de interrogação e exclamação", () => {
  assert.equal(mediaPalavrasPorFrase("Você viu? Eu vi!"), 2);
});

test("mediaPalavrasPorFrase não divide por zero", () => {
  assert.equal(mediaPalavrasPorFrase(""), 0);
  assert.equal(mediaPalavrasPorFrase("...   "), 0);
});

test("mediaPalavrasPorFrase ignora frase vazia entre pontos", () => {
  assert.equal(mediaPalavrasPorFrase("Um dois três... Um dois três."), 3);
});

// ---------------------------------------------------- veredito final

test("linguagemSimples aprova frase curta sem jargão", () => {
  const r = linguagemSimples(
    "Você contrata e treina. Em três meses a vaga abre de novo. O problema não é quem entra.",
  );
  assert.equal(r.simples, true);
  assert.deepEqual(r.dificeis, []);
  assert.ok(r.media <= LIMITE_PALAVRAS_POR_FRASE);
});

test("linguagemSimples reprova por jargão, mesmo com frase curta", () => {
  const r = linguagemSimples("Vamos otimizar o processo.");
  assert.equal(r.simples, false);
  assert.equal(r.dificeis.length, 1);
});

test("linguagemSimples reprova por frase longa, mesmo sem jargão", () => {
  const longa =
    "Quando a empresa não olha para o time e deixa a rotina apertar demais " +
    "todo mundo acaba cansado e a vaga abre de novo antes mesmo de a pessoa " +
    "aprender direito o que precisa fazer no dia a dia dela.";
  const r = linguagemSimples(longa);
  assert.equal(r.simples, false);
  assert.ok(r.media > LIMITE_PALAVRAS_POR_FRASE, String(r.media));
});

test("o limite de palavras por frase é o combinado", () => {
  assert.equal(LIMITE_PALAVRAS_POR_FRASE, 20);
});
