import { test } from "node:test";
import assert from "node:assert/strict";
import {
  apurar,
  calcularEnps,
  chaveDaPergunta,
  chaveDoRotulo,
  classificar,
  comparativo,
  conferirResposta,
  filtrar,
  lerMediasDigitadas,
  lerPerfil,
  lerResposta,
  perfilPadrao,
  recortePermitido,
  type PerguntaAplicada,
  type RespostaGuardada,
} from "../src/lib/clima";
import { BIBLIOTECA_INICIAL } from "../src/lib/clima-biblioteca";

function pergunta(id: string, dimensao: string, extra: Partial<PerguntaAplicada> = {}): PerguntaAplicada {
  return {
    id,
    origem: `bib-${id}`,
    dimensao,
    dimensaoOrdem: dimensao === "Liderança" ? 20 : 10,
    enunciado: `Pergunta ${id}`,
    tipo: "NOTA",
    opcoes: [],
    maxEscolhas: null,
    enps: false,
    ordem: 0,
    ...extra,
  };
}

const perguntas = [
  pergunta("a", "Comunicação", { ordem: 1 }),
  pergunta("b", "Comunicação", { ordem: 2 }),
  pergunta("c", "Liderança"),
  pergunta("n", "Imagem", { enps: true, dimensaoOrdem: 30 }),
  pergunta("m", "Motivação", { tipo: "MULTIPLA", opcoes: ["Salário", "Equipe", "Crescer"], maxEscolhas: 2, dimensaoOrdem: 40 }),
  pergunta("t", "Sugestões", { tipo: "TEXTO", dimensaoOrdem: 50 }),
];

function resposta(perfil: Record<string, string>, notas: Record<string, number>, escolhas: string[] = [], texto = "ok"): RespostaGuardada {
  return {
    perfil,
    itens: [
      ...Object.entries(notas).map(([perguntaId, nota]) => ({ perguntaId, nota, escolhas: [], texto: null })),
      { perguntaId: "m", nota: null, escolhas, texto: null },
      { perguntaId: "t", nota: null, escolhas: [], texto },
    ],
  };
}

test("apurar: média da dimensão é a média das médias das perguntas, e o eNPS fica fora dela", () => {
  const respostas = [
    resposta({ cargo: "Gestão" }, { a: 8, b: 4, c: 10, n: 10 }, ["Salário"]),
    resposta({ cargo: "Demais" }, { a: 6, b: 2, c: 5, n: 6 }, ["Salário", "Equipe"]),
  ];
  const r = apurar(perguntas, respostas, 6);
  assert.equal(r.respostas, 2);
  assert.deepEqual(
    r.dimensoes.map((d) => d.dimensao),
    ["Comunicação", "Liderança", "Imagem", "Motivação", "Sugestões"],
  );
  const comunicacao = r.dimensoes[0];
  assert.equal(comunicacao.media, 5); // (7 + 3) / 2
  assert.equal(comunicacao.dentro, 2); // 8 e 6
  assert.equal(comunicacao.abaixo, 2); // 4 e 2
  // A pergunta do eNPS não entra em média nenhuma.
  assert.equal(r.dimensoes[2].media, null);
  assert.deepEqual(r.enps, { valor: 0, promotores: 1, neutros: 0, detratores: 1, respostas: 2 });
  // Média geral: só das dimensões com nota.
  assert.equal(r.geral, (5 + 7.5) / 2);
  assert.deepEqual(r.dimensoes[3].perguntas[0].opcoes[0], { opcao: "Salário", vezes: 2 });
  assert.deepEqual(r.dimensoes[4].perguntas[0].textos, ["ok", "ok"]);
});

test("calcularEnps: 9 e 10 promovem, de 0 a 6 criticam", () => {
  assert.equal(calcularEnps([]), null);
  assert.deepEqual(calcularEnps([10, 9, 8, 7, 6, 0]), { valor: 0, promotores: 2, neutros: 2, detratores: 2, respostas: 6 });
  assert.equal(calcularEnps([10, 10, 10, 3])?.valor, 50);
});

test("classificar: régua 6, arredondando como a tela mostra", () => {
  assert.equal(classificar(6, 6), "DENTRO");
  assert.equal(classificar(5.96, 6), "DENTRO"); // aparece como 6,0
  assert.equal(classificar(5.94, 6), "ABAIXO");
  assert.equal(classificar(null, 6), null);
});

test("recortes: um grupo com menos de 3 respostas não aparece", () => {
  const respostas = [
    resposta({ cargo: "Gestão" }, { a: 8 }),
    resposta({ cargo: "Gestão" }, { a: 8 }),
    resposta({ cargo: "Demais" }, { a: 8 }),
    resposta({ cargo: "Demais" }, { a: 8 }),
    resposta({ cargo: "Demais" }, { a: 8 }),
  ];
  assert.equal(filtrar(respostas, { cargo: "Gestão" }).length, 2);
  assert.equal(recortePermitido(2, { cargo: "Gestão" }), false);
  assert.equal(recortePermitido(3, { cargo: "Demais" }), true);
  // Sem recorte, tudo aparece, mesmo com poucas respostas.
  assert.equal(recortePermitido(1, {}), true);
});

test("lerResposta e conferirResposta: tudo obrigatório, notas dentro da escala", () => {
  const perfil = perfilPadrao([]);
  const campos: Record<string, string[]> = {
    "perfil.cargo": ["Demais cargos"],
    "perfil.tempo": ["De 1 a 5 anos"],
    "perfil.genero": ["Prefiro não informar"],
    "p.a": ["7"],
    "p.b": ["10"],
    "p.c": ["1"],
    "p.n": ["0"],
    "p.m": ["Salário", "Crescer"],
    "p.t": ["Mais treinamento"],
  };
  const ler = (c: string) => campos[c] ?? [];
  const lida = lerResposta(perguntas, perfil, ler);
  assert.equal(conferirResposta(perguntas, perfil, lida), null);

  // O eNPS aceita 0; as outras notas, não.
  campos["p.a"] = ["0"];
  assert.match(conferirResposta(perguntas, perfil, lerResposta(perguntas, perfil, ler)) ?? "", /nota/);
  campos["p.a"] = ["7"];

  campos["p.m"] = ["Salário", "Crescer", "Equipe"];
  assert.match(conferirResposta(perguntas, perfil, lerResposta(perguntas, perfil, ler)) ?? "", /no máximo 2/);
  campos["p.m"] = ["Bônus"];
  assert.match(conferirResposta(perguntas, perfil, lerResposta(perguntas, perfil, ler)) ?? "", /opções/);
  campos["p.m"] = ["Salário"];

  campos["perfil.genero"] = ["Inventado"];
  assert.match(conferirResposta(perguntas, perfil, lerResposta(perguntas, perfil, ler)) ?? "", /gênero/);
});

test("perfilPadrao: unidade só entra com mais de uma filial, e gênero tem as quatro opções", () => {
  assert.equal(perfilPadrao(["Sede"]).some((p) => p.chave === "unidade"), false);
  assert.deepEqual(perfilPadrao(["Sede", "Filial"]).find((p) => p.chave === "unidade")?.opcoes, ["Sede", "Filial"]);
  assert.deepEqual(perfilPadrao([]).find((p) => p.chave === "genero")?.opcoes, ["Feminino", "Masculino", "Outro", "Prefiro não informar"]);
  // O perfil guardado passa por lerPerfil sem perder nada.
  assert.deepEqual(lerPerfil(perfilPadrao(["A", "B"])), perfilPadrao(["A", "B"]));
});

test("lerPerfil descarta item sem opções suficientes ou com chave repetida", () => {
  assert.deepEqual(
    lerPerfil([
      { chave: "x", rotulo: "X?", opcoes: ["Só uma"] },
      { chave: "y", rotulo: "Y?", opcoes: ["1", "2"] },
      { chave: "y", rotulo: "De novo?", opcoes: ["1", "2"] },
      "lixo",
    ]),
    [{ chave: "y", rotulo: "Y?", opcoes: ["1", "2"] }],
  );
  assert.equal(chaveDoRotulo("Qual é o seu setor?", ["qual-e-o-seu-setor"]), "qual-e-o-seu-setor-2");
});

test("comparativo: as dimensões se encontram mesmo com acento ou caixa diferentes", () => {
  const tabela = comparativo([
    { id: "1", nome: "Clima 2021", medias: new Map([["Comunicacao", 5.5], ["Liderança", 6]]) },
    { id: "2", nome: "Clima 2026", medias: new Map([["Comunicação", 6.5], ["Carreira", 7]]) },
  ]);
  assert.deepEqual(tabela, [
    { dimensao: "Comunicação", valores: [5.5, 6.5] },
    { dimensao: "Carreira", valores: [null, 7] },
    { dimensao: "Liderança", valores: [6, null] },
  ]);
});

test("chaveDaPergunta: texto ajustado vira outra pergunta no comparativo", () => {
  const p = pergunta("a", "Comunicação");
  assert.equal(chaveDaPergunta(p), chaveDaPergunta({ ...p }));
  assert.notEqual(chaveDaPergunta(p), chaveDaPergunta({ ...p, enunciado: "Outro texto" }));
  assert.equal(chaveDaPergunta({ ...p, origem: null }), null);
});

test("lerMediasDigitadas aceita vírgula e ignora o que não é média", () => {
  assert.deepEqual(lerMediasDigitadas({ Liderança: 6.5, Carreira: "7,2", Erro: "abc", Alta: 11 }), [
    { dimensao: "Liderança", media: 6.5 },
    { dimensao: "Carreira", media: 7.2 },
  ]);
});

test("biblioteca inicial: um eNPS, perguntas padrão e opções nas de escolha", () => {
  const todas = BIBLIOTECA_INICIAL.flatMap((d) => d.perguntas);
  assert.equal(todas.filter((p) => p.enps).length, 1);
  assert.ok(todas.filter((p) => p.padrao).length >= 30);
  for (const p of todas) {
    if (p.tipo === "ESCOLHA" || p.tipo === "MULTIPLA") assert.ok((p.opcoes?.length ?? 0) >= 2, p.enunciado);
  }
  const nomes = BIBLIOTECA_INICIAL.map((d) => d.nome);
  assert.equal(new Set(nomes).size, nomes.length);
});
