import { test } from "node:test";
import assert from "node:assert/strict";
import { lembreteDoLink } from "../src/lib/cobranca";
import { linkPublico } from "../src/lib/link-publico";
import { recadoDeCobrancaDosLinks } from "../src/lib/selecao";

test("os links que vão para fora usam sempre o endereço oficial", () => {
  assert.equal(linkPublico("/pesquisa/abc"), "https://rhresultados.vercel.app/pesquisa/abc");
});

test("o lembrete chama pelo primeiro nome e leva o link", () => {
  const m = lembreteDoLink("Maria da Silva", "a sua autoavaliação", "https://x/autoavaliacao/1");
  assert.match(m, /^Olá, Maria!/);
  assert.match(m, /a sua autoavaliação/);
  assert.ok(m.endsWith("https://x/autoavaliacao/1"));
});

test("a cobrança do candidato junta a ficha e os testes pendentes", () => {
  const um = recadoDeCobrancaDosLinks("João Souza", [{ oQue: "a ficha", link: "L1" }]);
  assert.match(um, /Olá, João!.*a ficha.*L1/);
  const dois = recadoDeCobrancaDosLinks("João Souza", [
    { oQue: "a ficha", link: "L1" },
    { oQue: 'o teste "DISC"', link: "L2" },
  ]);
  assert.match(dois, /- a ficha: L1\n- o teste "DISC": L2$/);
});
