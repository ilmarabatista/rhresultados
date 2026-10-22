import { test } from "node:test";
import assert from "node:assert/strict";
import {
  conferirParaEnviar,
  descricaoDaIA,
  lerEspecificacao,
  lerNivelDeCargo,
  lerRespostas,
  lerResponsabilidades,
  NAO_SE_APLICA,
  NIVEIS_DE_CARGO,
  questionarioDoNivel,
  questionarioEmTexto,
  respostaEmTexto,
  semResposta,
  totalDeExperiencia,
  type Respostas,
} from "../src/lib/cargos";

test("cada nível tem identificação, tarefas e perguntas sem id repetido", () => {
  for (const nivel of NIVEIS_DE_CARGO) {
    const ids = questionarioDoNivel(nivel).flatMap((s) => s.perguntas.map((p) => p.id));
    assert.equal(new Set(ids).size, ids.length, nivel);
    for (const id of ["setor", "superior", "objetivo", "tarefas", "escolaridade", "experiencia", "autonomia", "erros"]) {
      assert.ok(ids.includes(id), `${nivel} sem ${id}`);
    }
  }
});

test("o operacional pergunta das condições de trabalho; o gerencial, de supervisão", () => {
  const op = questionarioDoNivel("OPERACIONAL").flatMap((s) => s.perguntas.map((p) => p.id));
  const ger = questionarioDoNivel("GERENCIAL").flatMap((s) => s.perguntas.map((p) => p.id));
  assert.ok(op.includes("risco") && op.includes("ambiente") && op.includes("contatos"));
  assert.ok(!op.includes("supervisao"));
  assert.ok(ger.includes("supervisao") && ger.includes("dinheiro") && ger.includes("dadosConfidenciais"));
  assert.ok(!ger.includes("risco"));
});

test("a lista de riscos não traz a opção de desenhos que estava no papel por engano", () => {
  const risco = questionarioDoNivel("OPERACIONAL")
    .flatMap((s) => s.perguntas)
    .find((p) => p.id === "risco");
  assert.ok(risco && risco.tipo === "escolher");
  assert.ok(!risco.opcoes.some((o) => o.toLowerCase().includes("desenho")));
});

test("lerNivelDeCargo aceita só os três níveis", () => {
  assert.equal(lerNivelDeCargo("TECNICO"), "TECNICO");
  assert.equal(lerNivelDeCargo("tecnico"), null);
  assert.equal(lerNivelDeCargo(null), null);
});

test("lerRespostas descarta pergunta de outro nível, opção inventada e tarefa vazia", () => {
  const r = lerRespostas("GERENCIAL", {
    objetivo: "  Liderar a equipe de vendas.  ",
    risco: "Risco mínimo de acidente",
    escolaridade: { marcadas: ["Superior completo", "Doutorado em Marte"], qual: { "Superior completo": "Administração" } },
    tarefas: ["Reunião semanal", "   ", 3],
    lixo: "x",
  });
  assert.equal(r.objetivo, "Liderar a equipe de vendas.");
  assert.equal(r.risco, undefined);
  assert.equal(r.lixo, undefined);
  assert.deepEqual(r.escolaridade, { marcadas: ["Superior completo"], qual: { "Superior completo": "Administração" } });
  assert.deepEqual(r.tarefas, ["Reunião semanal"]);
});

test("escolher só aceita uma das opções", () => {
  assert.equal(lerRespostas("OPERACIONAL", { peso: "Leve" }).peso, "Leve");
  assert.equal(lerRespostas("OPERACIONAL", { peso: "Levíssimo" }).peso, undefined);
});

test("toda pergunta de opção aceita Não se aplica, mas não outro texto", () => {
  const r = lerRespostas("OPERACIONAL", { esforcoVisual: NAO_SE_APLICA, ambiente: NAO_SE_APLICA, calculos: "talvez" });
  assert.equal(r.esforcoVisual, NAO_SE_APLICA);
  assert.equal(r.ambiente, NAO_SE_APLICA);
  assert.equal(r.calculos, undefined);
  const ambiente = questionarioDoNivel("OPERACIONAL").flatMap((s) => s.perguntas).find((p) => p.id === "ambiente")!;
  assert.equal(respostaEmTexto(ambiente, r.ambiente), NAO_SE_APLICA);
});

test("experiência: todo nível aceita sem experiência, e o total soma meses e anos", () => {
  assert.deepEqual(lerRespostas("GERENCIAL", { experiencia: { nenhuma: true } }).experiencia, {
    nenhuma: true,
    noCargo: { quantidade: null, unidade: "anos" },
    anteriores: [],
  });
  const op = lerRespostas("OPERACIONAL", { experiencia: { nenhuma: true } }).experiencia;
  assert.deepEqual(op, { nenhuma: true, noCargo: { quantidade: null, unidade: "anos" }, anteriores: [] });

  const e = lerRespostas("TECNICO", {
    experiencia: {
      noCargo: { quantidade: 6, unidade: "meses" },
      anteriores: [{ cargo: "Auxiliar administrativo", duracao: { quantidade: 2, unidade: "anos" } }, { cargo: "", duracao: { quantidade: 1 } }],
    },
  }).experiencia;
  assert.ok(e && typeof e === "object" && "anteriores" in e);
  assert.equal(e.anteriores.length, 1);
  assert.equal(totalDeExperiencia(e), 2.5);
});

test("tarefas: só o que faz, e o formato antigo em quatro partes ainda é lido", () => {
  const r = lerRespostas("TECNICO", { tarefas: [{ oQue: "Lança notas", como: "x", porQue: "y", quando: "z" }, "Paga boletos"] });
  assert.deepEqual(r.tarefas, ["Lança notas", "Paga boletos"]);
});

test("conferirParaEnviar pede uma tarefa e as perguntas que faltam", () => {
  const base: Respostas = lerRespostas("GERENCIAL", {});
  assert.match(conferirParaEnviar("GERENCIAL", base)!, /pelo menos uma tarefa/);
  assert.match(conferirParaEnviar("GERENCIAL", lerRespostas("GERENCIAL", { tarefas: ["a"] }))!, /^Faltam \d+ respostas/);

  const completo: Record<string, unknown> = {
    tarefas: ["a"],
    escolaridade: { marcadas: ["Superior completo"] },
    experiencia: { noCargo: { quantidade: 3, unidade: "anos" } },
  };
  for (const p of semResposta("GERENCIAL", lerRespostas("GERENCIAL", completo))) completo[p.id] = "Não se aplica.";
  assert.equal(conferirParaEnviar("GERENCIAL", lerRespostas("GERENCIAL", completo)), null);
});

test("questionarioEmTexto numera as tarefas", () => {
  const r = lerRespostas("TECNICO", { tarefas: ["Lança notas", "Paga boletos"] });
  const texto = questionarioEmTexto("TECNICO", r);
  assert.match(texto, /1\. Lança notas\n2\. Paga boletos/);
  assert.match(texto, /\(sem resposta\)/);
});

test("descricaoDaIA confere o formato e junta a responsabilidade num parágrafo", () => {
  const d = descricaoDaIA({
    missao: "Garantir o caixa.",
    responsabilidades: ["Confere o caixa\ntodo dia, no sistema, para evitar diferença.", "", 3],
    cbo: "4110-10",
    competencias: [
      { nome: "Excel", tipo: "TECNICA", nivelEsperado: 4, descricao: "Fórmulas" },
      { nome: "excel", tipo: "TECNICA" },
      { nome: "Ética", tipo: "ORGANIZACIONAL", nivelEsperado: 9 },
    ],
    especificacao: { autonomia: "Libera descontos até 5%.", inventada: "x" },
  });
  assert.deepEqual(d.responsabilidades, ["Confere o caixa todo dia, no sistema, para evitar diferença."]);
  assert.equal(d.cbo, "4110-10");
  assert.equal(d.competencias.length, 2);
  assert.equal(d.competencias[1].tipo, "ORGANIZACIONAL");
  assert.equal(d.competencias[1].nivelEsperado, 3);
  assert.deepEqual(d.especificacao, { autonomia: "Libera descontos até 5%." });
});

test("descricaoDaIA não quebra com resposta estranha e recusa CBO fora do formato", () => {
  const d = descricaoDaIA("nada");
  assert.equal(d.missao, "");
  assert.deepEqual(d.responsabilidades, []);
  assert.equal(descricaoDaIA({ cbo: "talvez 4110" }).cbo, "");
  assert.equal(descricaoDaIA({ cbo: "411010" }).cbo, "4110-10");
});

test("lerEspecificacao e lerResponsabilidades limpam o que vem do banco", () => {
  assert.deepEqual(lerEspecificacao(["x"]), {});
  assert.deepEqual(lerEspecificacao({ erros: "  Multa  ", riscos: 3 }), { erros: "Multa" });
  assert.deepEqual(lerResponsabilidades("1. Atende\n\n- Vende\n"), ["Atende", "Vende"]);
});
