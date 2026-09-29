import { test } from "node:test";
import assert from "node:assert/strict";
import {
  anoValido,
  CARTOES_COMERCIAL,
  CARTOES_GERENCIAMENTO,
  CARTOES_METAS,
  chaveDoMes,
  COLUNAS_TRAFEGO,
  ETAPAS_DO_FUNIL,
  formatarValor,
  GRUPOS,
  lerValor,
  LINHAS_SUGERIDAS,
  MESES_CURTOS,
  mesesDoAno,
  PAINEIS,
  peso,
  rotuloDoGrupo,
  TABELAS_COMERCIAL,
  valorCurto,
} from "../src/lib/gestao";

// ------------------------------------------------------------ estrutura

test("os quatro painéis têm rótulo e resumo", () => {
  assert.equal(PAINEIS.length, 4);
  for (const p of PAINEIS) {
    assert.ok(p.label.trim().length > 0);
    assert.ok(p.resumo.trim().length > 10, p.label);
  }
});

test("existe a aba de despesas", () => {
  assert.ok(PAINEIS.some((p) => p.valor === "despesas"));
});

test("cada linha sugerida aparece uma vez e tem grupo conhecido", () => {
  const nomes = LINHAS_SUGERIDAS.map((l) => l.name);
  assert.equal(new Set(nomes).size, nomes.length);

  for (const l of LINHAS_SUGERIDAS) {
    assert.ok(
      GRUPOS.some((g) => g.valor === l.group),
      `${l.name} tem grupo desconhecido: ${l.group}`,
    );
  }
});

test("as linhas sugeridas cobrem os cinco grupos", () => {
  for (const g of GRUPOS) {
    assert.ok(
      LINHAS_SUGERIDAS.some((l) => l.group === g.valor),
      `nenhuma linha no grupo ${g.label}`,
    );
  }
});

test("nenhum resquício de clínica odontológica no plano de contas", () => {
  const texto = JSON.stringify([
    LINHAS_SUGERIDAS,
    CARTOES_COMERCIAL,
    CARTOES_GERENCIAMENTO,
    CARTOES_METAS,
    TABELAS_COMERCIAL,
  ]).toLowerCase();

  for (const palavra of [
    "dental",
    "dentista",
    "odonto",
    "clínica",
    "clinica",
    "implante",
    "alinhador",
    "laboratório",
    "tratamento",
    "paciente",
    "avaliador",
  ]) {
    assert.ok(!texto.includes(palavra), `sobrou "${palavra}"`);
  }

  // Siglas precisam casar palavra inteira: "cro" está dentro de "lucro".
  for (const sigla of ["cro", "crc", "aso", "hof"]) {
    assert.ok(
      !new RegExp(String.raw`\b${sigla}\b`).test(texto),
      `sobrou a sigla "${sigla}"`,
    );
  }
});

test("rotuloDoGrupo traduz e não engole grupo desconhecido", () => {
  assert.equal(rotuloDoGrupo("PESSOAS"), "Pessoas");
  assert.equal(rotuloDoGrupo("OUTRO"), "OUTRO");
  assert.equal(rotuloDoGrupo(null), "Sem grupo");
});

test("toda métrica diz como é calculada", () => {
  for (const lista of [
    CARTOES_COMERCIAL,
    CARTOES_GERENCIAMENTO,
    CARTOES_METAS,
    TABELAS_COMERCIAL,
  ]) {
    for (const m of lista) {
      assert.ok(m.definicao.trim().length > 20, `${m.rotulo} sem definição`);
    }
  }
});

test("o funil vai do lead ao contrato, com a proposta no meio", () => {
  assert.equal(ETAPAS_DO_FUNIL.length, 5);
  assert.equal(ETAPAS_DO_FUNIL[0], "Lead");
  assert.equal(ETAPAS_DO_FUNIL[4], "Contrato assinado");
  assert.ok(ETAPAS_DO_FUNIL.includes("Proposta enviada"));
});

test("a tabela de tráfego traz CAC, que o retorno do mês não substitui", () => {
  assert.ok(COLUNAS_TRAFEGO.includes("CAC"));
  assert.ok(CARTOES_METAS.some((m) => m.rotulo === "Payback"));
});

test("mensalidade e projeto aparecem no painel", () => {
  const texto = JSON.stringify([CARTOES_GERENCIAMENTO, TABELAS_COMERCIAL]);
  assert.match(texto, /recorrente/i);
  assert.match(texto, /projeto/i);
});

// --------------------------------------------------------------- datas

test("anoValido aceita ano de calendário e recusa o resto", () => {
  assert.ok(anoValido(2026));
  assert.ok(anoValido("2026"));
  assert.ok(!anoValido(1999));
  assert.ok(!anoValido(2101));
  assert.ok(!anoValido("abc"));
  assert.ok(!anoValido(undefined));
});

test("mesesDoAno devolve os doze primeiros dias, em UTC", () => {
  const meses = mesesDoAno(2026);
  assert.equal(meses.length, 12);
  assert.equal(meses[0].toISOString(), "2026-01-01T00:00:00.000Z");
  assert.equal(meses[11].toISOString(), "2026-12-01T00:00:00.000Z");
});

test("chaveDoMes casa lançamento com coluna", () => {
  assert.equal(chaveDoMes(new Date("2026-03-01T00:00:00.000Z")), "2026-03");
  assert.equal(chaveDoMes(new Date("2026-12-01T00:00:00.000Z")), "2026-12");
});

test("os meses curtos são doze, em português", () => {
  assert.equal(MESES_CURTOS.length, 12);
  assert.equal(MESES_CURTOS[0], "jan");
  assert.equal(MESES_CURTOS[11], "dez");
});

// ------------------------------------------------------------ dinheiro

test("lerValor entende o formato brasileiro", () => {
  assert.equal(lerValor("1.234,56"), 123456);
  assert.equal(lerValor("1234,56"), 123456);
  assert.equal(lerValor("R$ 1.234,56"), 123456);
  assert.equal(lerValor("1234"), 123400);
  assert.equal(lerValor("0,99"), 99);
});

test("lerValor também aceita ponto decimal, como o teclado numérico digita", () => {
  assert.equal(lerValor("1234.56"), 123456);
  assert.equal(lerValor("0.5"), 50);
  assert.equal(lerValor("99.99"), 9999);
});

test("lerValor devolve null para vazio, que significa apagar", () => {
  assert.equal(lerValor(""), null);
  assert.equal(lerValor("   "), null);
  assert.equal(lerValor("R$"), null);
});

test("lerValor recusa texto e valor negativo", () => {
  assert.equal(lerValor("abc"), null);
  assert.equal(lerValor("12,3,4"), null);
  assert.equal(lerValor("-100"), null);
});

test("lerValor e formatarValor são inversos", () => {
  for (const texto of ["1.234,56", "0,99", "999.999,99"]) {
    assert.equal(formatarValor(lerValor(texto)!), texto);
  }
});

test("valorCurto encurta milhar e milhão", () => {
  assert.equal(valorCurto(0), "—");
  assert.equal(valorCurto(50_000), "500");
  assert.equal(valorCurto(1_234_500), "12,3 mil");
  assert.equal(valorCurto(250_000_000), "2,5 mi");
});

test("peso não divide por zero", () => {
  assert.equal(peso(50, 200), 25);
  assert.equal(peso(0, 0), 0);
  assert.equal(peso(10, 0), 0);
});

test("lerValor trata o ponto como milhar quando vêm três dígitos", () => {
  // Foi um erro real: "3.200" virava R$ 3,20.
  assert.equal(lerValor("3.200"), 320000);
  assert.equal(lerValor("12.500"), 1250000);
  assert.equal(lerValor("1.234.567"), 123456700);
});

test("lerValor mantém o ponto como decimal quando não são três dígitos", () => {
  assert.equal(lerValor("3.20"), 320);
  assert.equal(lerValor("0.5"), 50);
  assert.equal(lerValor("12.5"), 1250);
});

test("lerValor com vírgula ignora a ambiguidade do ponto", () => {
  assert.equal(lerValor("3.200,00"), 320000);
  assert.equal(lerValor("3.200,50"), 320050);
});
