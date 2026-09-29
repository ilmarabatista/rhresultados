import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ANGULOS,
  angulosDisponiveis,
  BLOCOS,
  conferirTamanho,
  contarPalavras,
  escolherFramework,
  faixaDePalavras,
  faltando,
  OBJETIVOS,
  rotuloDoObjetivo,
  numerosSuspeitos,
  QUANTIDADES,
  segundosFalados,
  textoCompleto,
  textoFalado,
} from "../src/lib/roteiros";

// ----------------------------------------------------------- framework

test("objetivo com oferta usa PASTOR", () => {
  assert.equal(escolherFramework("VENDA"), "PASTOR");
  assert.equal(escolherFramework("LEAD"), "PASTOR");
});

test("objetivo de conteúdo usa HVC leve", () => {
  assert.equal(escolherFramework("ENGAJAMENTO"), "HVC");
  assert.equal(escolherFramework("EDUCAR"), "HVC");
  assert.equal(escolherFramework("ENTRETER"), "HVC");
});

test("todo objetivo tem rótulo em português", () => {
  for (const o of OBJETIVOS) {
    assert.ok(o.label.trim().length > 0);
    assert.equal(rotuloDoObjetivo(o.valor), o.label);
  }
  assert.equal(rotuloDoObjetivo("OUTRO"), "OUTRO");
});

test("PASTOR tem os sete blocos, na ordem do método", () => {
  assert.deepEqual(BLOCOS.PASTOR, [
    "GANCHO",
    "PROBLEMA/DOR",
    "AMPLIFICAÇÃO",
    "HISTÓRIA/SOLUÇÃO",
    "TRANSFORMAÇÃO/PROVA",
    "OFERTA",
    "CTA",
  ]);
});

test("HVC é gancho, valor e convite — sem fechamento de venda", () => {
  assert.deepEqual(BLOCOS.HVC, ["GANCHO", "VALOR", "CONVITE"]);
  assert.ok(!BLOCOS.HVC.includes("OFERTA"));
});

test("os dois frameworks começam pelo gancho", () => {
  assert.equal(BLOCOS.PASTOR[0], "GANCHO");
  assert.equal(BLOCOS.HVC[0], "GANCHO");
});

// -------------------------------------------------------- perguntar antes

test("faltando cobra tema, público e objetivo", () => {
  const p = faltando({});
  assert.equal(p.length, 3);
  assert.match(p.join(" "), /tema|Sobre o que/);
  assert.match(p.join(" "), /Para quem/);
  assert.match(p.join(" "), /objetivo/);
});

test("faltando cobra oferta e CTA quando o objetivo é vender", () => {
  const p = faltando({ tema: "RH", publico: "donos de indústria", objetivo: "VENDA" });
  assert.equal(p.length, 2);
  assert.match(p.join(" "), /oferta/i);
  assert.match(p.join(" "), /ação única/i);
});

test("faltando não cobra oferta em vídeo de conteúdo", () => {
  assert.deepEqual(
    faltando({ tema: "RH", publico: "donos de indústria", objetivo: "EDUCAR" }),
    [],
  );
});

test("faltando aceita quando tudo está preenchido", () => {
  assert.deepEqual(
    faltando({
      tema: "Diagnóstico de RH",
      publico: "Donos de indústria com 50 a 200 pessoas",
      objetivo: "LEAD",
      oferta: "Diagnóstico gratuito de 40 minutos",
      cta: "Mandar mensagem no WhatsApp",
    }),
    [],
  );
});

test("faltando ignora espaço em branco como se fosse vazio", () => {
  const p = faltando({ tema: "   ", publico: "\n", objetivo: "EDUCAR" });
  assert.equal(p.length, 2);
});

test("faltando para no objetivo quando ele é inválido", () => {
  // Sem saber o objetivo não dá para saber se a oferta é exigida.
  const p = faltando({ tema: "x", publico: "y", objetivo: "QUALQUER" });
  assert.equal(p.length, 1);
  assert.match(p[0], /objetivo/);
});

// ------------------------------------------------------------- tamanho

test("faixaDePalavras segue a tabela do método", () => {
  assert.deepEqual(faixaDePalavras(15), { min: 35, max: 40 });
  assert.deepEqual(faixaDePalavras(30), { min: 70, max: 80 });
  assert.deepEqual(faixaDePalavras(60), { min: 150, max: 160 });
  assert.deepEqual(faixaDePalavras(90), { min: 220, max: 240 });
});

test("faixaDePalavras calcula a proporção fora da tabela", () => {
  const f = faixaDePalavras(120);
  assert.ok(f.min < 300 && f.max > 300, JSON.stringify(f));
  assert.ok(f.min < f.max);
});

test("contarPalavras conta só o que é falado", () => {
  assert.equal(contarPalavras("Um dois três"), 3);
  assert.equal(contarPalavras("Um, dois; três!"), 3);
  assert.equal(contarPalavras("  espaços   demais  "), 2);
  assert.equal(contarPalavras(""), 0);
});

test("contarPalavras ignora o rótulo do bloco", () => {
  assert.equal(contarPalavras("GANCHO:\nVocê já perdeu um funcionário bom?"), 6);
  assert.equal(contarPalavras("PROBLEMA/DOR:\nDuas palavras"), 2);
});

test("contarPalavras mantém palavra com hífen e apóstrofo como uma só", () => {
  assert.equal(contarPalavras("bem-vindo d'água"), 2);
});

test("conferirTamanho diz curto, certo ou longo", () => {
  assert.equal(conferirTamanho(30, 15).ajuste, "CURTO");
  assert.equal(conferirTamanho(37, 15).ajuste, "OK");
  assert.equal(conferirTamanho(60, 15).ajuste, "LONGO");
});

test("conferirTamanho devolve a faixa esperada, para a tela mostrar", () => {
  const r = conferirTamanho(200, 60);
  assert.equal(r.min, 150);
  assert.equal(r.max, 160);
  assert.equal(r.ajuste, "LONGO");
});

test("segundosFalados estima a duração pelo número de palavras", () => {
  assert.equal(segundosFalados(150), 60);
  assert.equal(segundosFalados(75), 30);
  assert.equal(segundosFalados(0), 0);
});

// -------------------------------------------------------- texto falado

test("textoFalado junta os blocos sem os rótulos", () => {
  const t = textoFalado([
    { rotulo: "GANCHO", texto: "Primeira frase." },
    { rotulo: "VALOR", texto: "Segunda frase." },
  ]);
  assert.equal(t, "Primeira frase.\n\nSegunda frase.");
});

test("textoFalado pula bloco vazio", () => {
  const t = textoFalado([
    { rotulo: "GANCHO", texto: "Só esta." },
    { rotulo: "VALOR", texto: "   " },
  ]);
  assert.equal(t, "Só esta.");
});

// -------------------------------------------------------------- ângulos

test("há ângulos suficientes para gerar cinco roteiros diferentes", () => {
  assert.ok(ANGULOS.length >= 5, `só ${ANGULOS.length} ângulos`);
  assert.equal(new Set(ANGULOS).size, ANGULOS.length);
  for (const a of ANGULOS) assert.ok(a.trim().length > 10, a);
});

test("cinco é uma das quantidades oferecidas", () => {
  assert.ok(QUANTIDADES.includes(5));
});

test("textoCompleto traz os rótulos, como no roteiro de conferência", () => {
  const t = textoCompleto([
    { rotulo: "GANCHO", texto: "Primeira frase." },
    { rotulo: "VALOR", texto: "Segunda frase." },
  ]);
  assert.equal(t, "GANCHO: Primeira frase.\n\nVALOR: Segunda frase.");
});

test("textoCompleto pula bloco vazio", () => {
  const t = textoCompleto([
    { rotulo: "GANCHO", texto: "Só esta." },
    { rotulo: "VALOR", texto: "  " },
  ]);
  assert.equal(t, "GANCHO: Só esta.");
});

test("o texto completo e o falado contam as mesmas palavras", () => {
  const blocos = [
    { rotulo: "GANCHO", texto: "Você já perdeu um funcionário bom?" },
    { rotulo: "VALOR", texto: "Quase sempre o problema é a liderança." },
  ];
  assert.equal(
    contarPalavras(textoCompleto(blocos)),
    contarPalavras(textoFalado(blocos)),
  );
});

// ----------------------------------------------- não inventar número

test("sem prova social, o ângulo do número sai da lista", () => {
  const com = angulosDisponiveis(true);
  const sem = angulosDisponiveis(false);

  assert.equal(com.length, ANGULOS.length);
  assert.equal(sem.length, ANGULOS.length - 1);
  assert.ok(!sem.some((a) => a.startsWith("Número que para o feed")));
  assert.ok(com.some((a) => a.startsWith("Número que para o feed")));
});

test("sem prova social ainda sobram ângulos para cinco roteiros", () => {
  assert.ok(angulosDisponiveis(false).length >= 5);
});

test("numerosSuspeitos acha porcentagem e valor", () => {
  assert.deepEqual(numerosSuspeitos("subiu 38% no ano"), ["38%"]);
  assert.ok(numerosSuspeitos("multa de R$ 50.000").includes("R$ 50.000"));
  assert.ok(numerosSuspeitos("são 3 milhões de casos").length > 0);
});

test("numerosSuspeitos acha fonte atribuída", () => {
  const r = numerosSuspeitos("segundo o Ministério do Trabalho, o número cresceu");
  assert.ok(r.some((x) => x.includes("Ministério do Trabalho")), JSON.stringify(r));

  const r2 = numerosSuspeitos("dados do Ministério da Saúde mostram");
  assert.ok(r2.some((x) => x.includes("Ministério da Saúde")), JSON.stringify(r2));
});

test("numerosSuspeitos deixa passar texto sem dado", () => {
  assert.deepEqual(
    numerosSuspeitos("Você contrata, treina e a vaga abre de novo."),
    [],
  );
});

test("numerosSuspeitos não repete o mesmo trecho", () => {
  assert.deepEqual(numerosSuspeitos("38% aqui e 38% ali"), ["38%"]);
});
