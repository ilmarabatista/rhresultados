import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calendarioDoPdi,
  camposAbertos,
  conferirParaEnviar,
  lerPerguntas,
  linkDoWhatsApp,
  modeloSugerido,
  telefoneDoWhatsApp,
  lerRespostas,
  notasDaAutoavaliacao,
  pedeAtencao,
  resumoDaAutoavaliacao,
  type PerguntaEnviada,
} from "../src/lib/autoavaliacao";

const perguntas: PerguntaEnviada[] = [
  { id: "t1", tipo: "TECNICA", texto: "Escuta ativa", destino: null },
  { id: "c1", tipo: "COMPORTAMENTAL", texto: "Pontualidade", destino: null },
  { id: "f1", tipo: "TAREFA", texto: "Fechamento da clínica", destino: null },
  { id: "f2", tipo: "TAREFA", texto: "Abrir o caixa", destino: null },
  { id: "k1", tipo: "CONDUTA", texto: "Usei o celular durante um atendimento", destino: null },
  { id: "a1", tipo: "ABERTA", texto: "O que eu faço melhor?", destino: "pontosFortes" },
  { id: "a2", tipo: "ABERTA", texto: "O que preciso da liderança?", destino: "apoio" },
];

test("lerPerguntas descarta o que não é pergunta válida", () => {
  const lidas = lerPerguntas([...perguntas, { id: "x", tipo: "OUTRO", texto: "?" }, null, "a"]);
  assert.equal(lidas.length, perguntas.length);
  assert.deepEqual(lerPerguntas("nada"), []);
});

test("lerRespostas fica só com opções que existem", () => {
  const r = lerRespostas(perguntas, { t1: "5", c1: "3", f1: "QUERO_APRENDER", k1: "NUNCA", a1: "  ", a2: "Feedback", zz: "1" });
  assert.deepEqual(r, { c1: "3", f1: "QUERO_APRENDER", k1: "NUNCA", a2: "Feedback" });
});

test("conferirParaEnviar exige todas as marcações, não as abertas", () => {
  assert.equal(conferirParaEnviar(perguntas, { t1: "1", c1: "2", f1: "SOZINHO", f2: "NAO_FACO" }), "Falta marcar 1 item.");
  assert.equal(conferirParaEnviar(perguntas, { t1: "1", c1: "2", f1: "SOZINHO", f2: "NAO_FACO", k1: "NUNCA" }), null);
});

test("notas: a escala de 1 a 4 entra igual, tarefa e conduta viram nível, Não faço fica sem nota", () => {
  const notas = notasDaAutoavaliacao(perguntas, { t1: "2", c1: "4", f1: "QUERO_APRENDER", f2: "NAO_FACO", k1: "AS_VEZES" });
  assert.deepEqual(
    notas.map((n) => [n.nome, n.tipo, n.esperado, n.pessoa]),
    [
      ["Escuta ativa", "TECNICA", 3, 2],
      ["Pontualidade", "COMPORTAMENTAL", 3, 4],
      ["Tarefa: Fechamento da clínica", "TECNICA", 3, 1],
      ["Tarefa: Abrir o caixa", "TECNICA", 3, null],
      ["Conduta: Usei o celular durante um atendimento", "COMPORTAMENTAL", 3, 2],
    ],
  );
  assert.equal(notas[2].comentario, "Na autoavaliação: quero aprender.");
});

test("pedeAtencao: abaixo do padrão, nunca em Não faço", () => {
  assert.equal(pedeAtencao({ tipo: "TECNICA" }, "2"), true);
  assert.equal(pedeAtencao({ tipo: "TECNICA" }, "3"), false);
  assert.equal(pedeAtencao({ tipo: "TAREFA" }, "COM_AJUDA"), true);
  assert.equal(pedeAtencao({ tipo: "TAREFA" }, "NAO_FACO"), false);
  assert.equal(pedeAtencao({ tipo: "CONDUTA" }, "FREQUENTE"), true);
  assert.equal(pedeAtencao({ tipo: "ABERTA" }, "texto"), false);
});

test("camposAbertos junta pergunta e resposta no destino", () => {
  const c = camposAbertos(perguntas, { a1: "Atendimento", a2: "Feedback" });
  assert.equal(c.pontosFortes, "O que eu faço melhor?\nAtendimento");
  assert.equal(c.apoio, "O que preciso da liderança?\nFeedback");
  assert.equal(c.querDesenvolver, null);
});

test("resumo conta itens, marcados e abaixo do padrão", () => {
  assert.deepEqual(resumoDaAutoavaliacao(perguntas, { t1: "1", c1: "3", f1: "COM_AJUDA" }), { itens: 5, respondidos: 3, atencao: 2 });
});

test("calendário: fim em 90 dias, conversas em 30, 60 e 90", () => {
  assert.deepEqual(calendarioDoPdi("2026-10-23"), { fim: "2027-01-21", conversas: ["2026-11-22", "2026-12-22", "2027-01-21"] });
});

test("telefoneDoWhatsApp põe o 55 e recusa o que não é celular", () => {
  assert.equal(telefoneDoWhatsApp("(11) 98765-4321"), "5511987654321");
  assert.equal(telefoneDoWhatsApp("+55 11 98765-4321"), "5511987654321");
  assert.equal(telefoneDoWhatsApp("011 3333-4444"), "551133334444");
  assert.equal(telefoneDoWhatsApp("1234"), null);
  assert.equal(telefoneDoWhatsApp(null), null);
});

test("linkDoWhatsApp sem número abre para escolher o contato", () => {
  assert.ok(linkDoWhatsApp(null, "oi").startsWith("https://wa.me/?text=oi"));
  assert.ok(linkDoWhatsApp("11987654321", "oi").startsWith("https://wa.me/5511987654321?text="));
});

test("modeloSugerido: cargo, depois nome da função", () => {
  const modelos = [
    { id: "a", nome: "Recepção", cargoId: null },
    { id: "b", nome: "Auxiliar", cargoId: "asb" },
  ];
  assert.equal(modeloSugerido(modelos, { cargoId: "asb", role: "ASB" })?.id, "b");
  assert.equal(modeloSugerido(modelos, { cargoId: null, role: "recepcao" })?.id, "a");
  assert.equal(modeloSugerido(modelos, { cargoId: null, role: "Financeiro" }), null);
});
