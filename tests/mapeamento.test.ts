import { test } from "node:test";
import assert from "node:assert/strict";
import {
  chaveDoTexto,
  conferirMapeamento,
  dadosParaAPessoa,
  juntarDaPessoa,
  itensDaIA,
  itensSemIA,
  juntarRascunho,
  lerDados,
  mapeamentoVazio,
  metasDoMapeamento,
} from "../src/lib/mapeamento";

test("lerDados aceita o que é do formato e descarta o resto", () => {
  const d = lerDados({
    cargo: "  Inadimplência (Cobrança e NPS) ",
    resumo: 42,
    tarefas: [
      { descricao: "Cobrança de boletos em atraso", periodicidade: "diária", criticidade: "alta" },
      { descricao: "  ", periodicidade: "DIARIA" },
      { descricao: "Encaminhar intercorrências", periodicidade: "sob demanda", criticidade: "talvez" },
      "texto solto",
    ],
    passos: ["Acessar o CAIO", "", null],
    ferramentas: [{ nome: "CAIO", uso: "Boletos" }, { uso: "sem nome" }],
  });
  assert.equal(d.cargo, "Inadimplência (Cobrança e NPS)");
  assert.equal(d.resumo, "");
  assert.deepEqual(d.tarefas, [
    { descricao: "Cobrança de boletos em atraso", periodicidade: "DIARIA", criticidade: "ALTA" },
    { descricao: "Encaminhar intercorrências", periodicidade: "SOB_DEMANDA", criticidade: null },
  ]);
  assert.deepEqual(d.passos, ["Acessar o CAIO"]);
  assert.deepEqual(d.ferramentas, [{ nome: "CAIO", uso: "Boletos", acesso: "" }]);
  assert.deepEqual(lerDados(null), mapeamentoVazio());
});

test("juntarRascunho não apaga o que a IA deixou em branco", () => {
  const atual = { ...mapeamentoVazio(), cargo: "Recepção", resumo: "Escrito pelo RH", passos: ["um"] };
  const daIA = { ...mapeamentoVazio(), resumo: "Da IA", tarefas: [{ descricao: "Abrir a clínica", periodicidade: null, criticidade: null }] };
  const r = juntarRascunho(atual, daIA);
  assert.equal(r.cargo, "Recepção");
  assert.equal(r.resumo, "Da IA");
  assert.deepEqual(r.passos, ["um"]);
  assert.equal(r.tarefas.length, 1);
});

test("itensDaIA filtra tipo inválido e repetidos", () => {
  const itens = itensDaIA({
    itens: [
      { tipo: "TAREFA", texto: "Cobrança: cobro os boletos em atraso todo dia", origem: "Tarefa 1" },
      { tipo: "tarefa", texto: "Cobrança: cobro os boletos em atraso todo dia." },
      { tipo: "ABERTA", texto: "Pergunta aberta?" },
      { tipo: "TECNICA", texto: "x" },
    ],
  });
  assert.equal(itens.length, 1);
  assert.equal(itens[0].tipo, "TAREFA");
  assert.equal(chaveDoTexto("Renegociação: CAIO!"), "renegociacao caio");
});

test("itensSemIA e metasDoMapeamento", () => {
  const d = {
    ...mapeamentoVazio(),
    tarefas: [{ descricao: "Envio de lembretes", periodicidade: null, criticidade: null }],
    rhAtencao: "- Validar o indicador do CAIO\n\n- Critério para dívidas abaixo de R$ 5.000",
    rhProximosPassos: "1. Formalizar o sistema de cores",
    gargalos: [{ situacao: "Migração Clinicorp para CAIO", impacto: "Checklist do fluxo" }],
  };
  assert.deepEqual(itensSemIA(d), [{ tipo: "TAREFA", texto: "Envio de lembretes", origem: "Tarefa 1" }]);
  const metas = metasDoMapeamento(d);
  assert.deepEqual(
    metas.map((m) => m.origem),
    ["Ponto de atenção", "Ponto de atenção", "Próximo passo", "Gargalo"],
  );
  assert.equal(metas[2].titulo, "Formalizar o sistema de cores");
  assert.equal(metas[3].titulo, "Migração Clinicorp para CAIO. Checklist do fluxo");
});

test("o link não leva nem aceita as observações do RH", () => {
  const gravado = { ...mapeamentoVazio(), rhAtencao: "Só o RH vê", resumo: "antes" };
  assert.equal(dadosParaAPessoa(gravado).rhAtencao, "");
  const junto = juntarDaPessoa(gravado, { resumo: "Faço a cobrança", rhAtencao: "tentativa da pessoa" });
  assert.equal(junto.resumo, "Faço a cobrança");
  assert.equal(junto.rhAtencao, "Só o RH vê");
  assert.match(conferirMapeamento(junto) ?? "", /tarefa/);
  assert.equal(conferirMapeamento({ ...junto, tarefas: [{ descricao: "Cobrar", periodicidade: null, criticidade: null }] }), null);
});
