import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apurar,
  conferirRespostasCadastradas,
  escreverEstrutura,
  lerEstrutura,
  lerRespostasCadastradas,
  lerResultadoCadastrado,
  lerTesteCadastrado,
  semChave,
  type TesteCadastrado,
} from "../src/lib/testes-cadastrados";

// Um questionário inventado para o teste, com dois pares.
const TEXTO = `FATORES
X = Fator X | descreve X
Y = Fator Y
W = Fator W
Z = Fator Z

PARES
X/Y, W/Z

QUESTÕES
1. Primeira questão
que continua na linha de baixo
a) Alternativa um [X]
b) Alternativa dois (Y)

2) Segunda questão
a. Alternativa três [W]
b. Alternativa quatro [Z]

3 - Terceira questão
a) Alternativa cinco [Y]
b) Alternativa seis [X]`;

test("lê fatores, pares e questões no formato da tela", () => {
  const { estrutura, erros } = lerEstrutura(TEXTO);
  assert.deepEqual(erros, []);
  assert.equal(estrutura.fatores.length, 4);
  assert.equal(estrutura.fatores[0].descricao, "descreve X");
  assert.deepEqual(estrutura.pares, [["X", "Y"], ["W", "Z"]]);
  assert.equal(estrutura.questoes.length, 3);
  assert.equal(estrutura.questoes[0].enunciado, "Primeira questão\nque continua na linha de baixo");
  assert.deepEqual(estrutura.questoes[0].opcoes, [{ texto: "Alternativa um", fator: "X" }, { texto: "Alternativa dois", fator: "Y" }]);
  // Escrever de volta e ler de novo dá a mesma estrutura.
  assert.deepEqual(lerEstrutura(escreverEstrutura(estrutura)).estrutura, estrutura);
});

test("aponta alternativa sem chave, chave desconhecida e questão com uma alternativa", () => {
  const { erros } = lerEstrutura(`FATORES
X = Fator X
Y = Fator Y
QUESTÕES
1. Uma
a) Sem chave
b) Com chave [Q]
2. Duas
a) Só uma [X]`);
  assert.ok(erros.some((e) => e.includes("sem a chave")));
  assert.ok(erros.some((e) => e.includes("[Q] não está em FATORES")));
  assert.ok(erros.some((e) => e.includes("Questão 2 tem menos de duas alternativas")));
});

test("aceita a tabela colada da planilha e deduz os fatores das chaves", () => {
  const { estrutura, erros } = lerEstrutura("Pergunta 1\tSim\tA\n\tNão\tB\nPergunta 2\tTalvez\tB\n\tNunca\tA");
  assert.deepEqual(erros, []);
  assert.equal(estrutura.questoes.length, 2);
  assert.deepEqual(estrutura.fatores.map((f) => f.codigo), ["A", "B"]);
});

function teste(modo: "ESCOLHA" | "NOTAS"): TesteCadastrado {
  return { nome: "Teste inventado", instrucoes: "", modo, ...lerEstrutura(TEXTO).estrutura };
}

test("apura a escolha: soma por fator, percentual e o tipo pelos pares", () => {
  const t = teste("ESCOLHA");
  const fd = new FormData();
  fd.set("q-0", "0");
  fd.set("q-1", "1");
  fd.set("q-2", "1");
  const respostas = lerRespostasCadastradas(fd, t);
  assert.equal(conferirRespostasCadastradas(respostas, t), null);
  const r = apurar(t, respostas as number[]);
  assert.deepEqual(r.pontos, { X: 2, Y: 0, W: 0, Z: 1 });
  assert.deepEqual(r.percentuais, { X: 100, Y: 0, W: 0, Z: 100 });
  assert.equal(r.tipo, "XZ");
  assert.equal(r.ordem[0], "X");
  assert.deepEqual(lerResultadoCadastrado(JSON.parse(JSON.stringify(r))), r);
  assert.match(conferirRespostasCadastradas([0, null, 1], t) ?? "", /questão 2/);
});

test("apura as notas e recusa empate", () => {
  const t = teste("NOTAS");
  const r = apurar(t, [[2, 1], [1, 2], [1, 2]]);
  assert.deepEqual(r.pontos, { X: 4, Y: 2, W: 1, Z: 2 });
  assert.equal(r.percentuais.X, 100);
  assert.equal(r.tipo, "XZ");
  assert.match(conferirRespostasCadastradas([[1, 1], [1, 2], [1, 2]], t) ?? "", /uma vez só/);
});

test("a cópia do candidato volta igual e o link não mostra a chave", () => {
  const t = teste("ESCOLHA");
  assert.deepEqual(lerTesteCadastrado(JSON.parse(JSON.stringify(t))), t);
  assert.equal(lerTesteCadastrado({ nome: "vazio" }), null);
  const publico = semChave(t);
  assert.deepEqual(publico[1], { enunciado: "Segunda questão", alternativas: ["Alternativa três", "Alternativa quatro"] });
  assert.ok(!JSON.stringify(publico).includes("fator"));
});
