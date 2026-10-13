import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checarSmart,
  comparar,
  distribuicao,
  execucaoDasAcoes,
  lerQuantoFeito,
  situacaoDaAcao,
  divergencias,
  gap,
  gapsPrioritarios,
  lerNivel,
  lerProgresso,
  metaCompleta,
  metaSugerida,
  nivelFinal,
  progressoDoPlano,
  resumoDaAvaliacao,
  situacaoDaConversa,
  statusPeloProgresso,
  type Nota,
} from "../src/lib/pdi";

const nota = (nome: string, esperado: number, pessoa: number | null, avaliador: number | null, acordado: number | null): Nota => ({
  nome,
  esperado,
  pessoa,
  avaliador,
  acordado,
});

test("nivelFinal: acordado vale mais que avaliador, que vale mais que a pessoa", () => {
  assert.equal(nivelFinal(nota("A", 4, 2, 3, 5)), 5);
  assert.equal(nivelFinal(nota("A", 4, 2, 3, null)), 3);
  assert.equal(nivelFinal(nota("A", 4, 2, null, null)), 2);
  assert.equal(nivelFinal(nota("A", 4, null, null, null)), null);
});

test("gap é o esperado menos o nível que vale", () => {
  assert.equal(gap(nota("A", 4, null, null, 2)), 2);
  assert.equal(gap(nota("A", 3, null, null, 5)), -2);
  assert.equal(gap(nota("A", 3, null, null, null)), null);
});

test("gapsPrioritarios: só quem tem gap, do maior para o menor", () => {
  const notas = [nota("A", 3, null, null, 2), nota("B", 5, null, null, 2), nota("C", 3, null, null, 4), nota("D", 4, null, null, null)];
  assert.deepEqual(
    gapsPrioritarios(notas).map((n) => n.nome),
    ["B", "A"],
  );
});

test("divergencias: dois níveis ou mais de distância", () => {
  const notas = [nota("A", 3, 5, 2, null), nota("B", 3, 3, 2, null), nota("C", 3, null, 1, null)];
  assert.deepEqual(divergencias(notas).map((n) => n.nome), ["A"]);
});

test("resumoDaAvaliacao: aderência não ganha bônus de quem passa do esperado", () => {
  const r = resumoDaAvaliacao([nota("A", 4, null, null, 2), nota("B", 2, null, null, 5), nota("C", 3, null, null, null)]);
  assert.equal(r.competencias, 3);
  assert.equal(r.avaliadas, 2);
  assert.equal(r.comGap, 1);
  // (2 + 2) / (4 + 2)
  assert.equal(r.aderencia, 67);
  assert.equal(resumoDaAvaliacao([]).aderencia, null);
});

test("comparar casa as competências pelo nome, sem caixa", () => {
  const c = comparar([nota("Excel", 4, null, null, 2)], [nota("excel ", 4, null, null, 4), nota("Novo", 3, null, null, 3)]);
  assert.deepEqual(c[0], { nome: "excel ", antes: 2, depois: 4, mudou: 2 });
  assert.equal(c[1].mudou, null);
});

test("lerNivel aceita só 1 a 5", () => {
  assert.equal(lerNivel("3"), 3);
  assert.equal(lerNivel(5), 5);
  assert.equal(lerNivel("0"), null);
  assert.equal(lerNivel("6"), null);
  assert.equal(lerNivel("2.5"), null);
  assert.equal(lerNivel(""), null);
});

test("lerProgresso fica entre 0 e 100", () => {
  assert.equal(lerProgresso("150"), 100);
  assert.equal(lerProgresso(-3), 0);
  assert.equal(lerProgresso("abc"), 0);
  assert.equal(lerProgresso("42.6"), 43);
});

test("statusPeloProgresso: 100% atinge, decisões da conversa ficam", () => {
  assert.equal(statusPeloProgresso("NAO_INICIADA", 30), "EM_ANDAMENTO");
  assert.equal(statusPeloProgresso("EM_ANDAMENTO", 100), "ATINGIDA");
  assert.equal(statusPeloProgresso("ATINGIDA", 80), "EM_ANDAMENTO");
  assert.equal(statusPeloProgresso("NAO_INICIADA", 0), "NAO_INICIADA");
  assert.equal(statusPeloProgresso("CANCELADA", 100), "CANCELADA");
  assert.equal(statusPeloProgresso("NAO_ATINGIDA", 50), "NAO_ATINGIDA");
});

test("checarSmart aponta o que falta", () => {
  const vazia = checarSmart({ titulo: "Excel", indicador: "", recursos: null, relevancia: " ", prazo: null });
  assert.deepEqual(vazia, { S: false, M: false, A: false, R: false, T: false });
  const cheia = {
    titulo: "Montar sozinha o relatório mensal de vendas",
    indicador: "Relatório de dezembro entregue sem correção",
    recursos: "Curso de Excel e 2h por semana com o líder",
    relevancia: "É a entrega principal do cargo",
    prazo: "2026-12-15",
  };
  assert.equal(metaCompleta(cheia), true);
  assert.equal(checarSmart({ ...cheia, prazo: null }).T, false);
});

test("metaSugerida já nasce específica", () => {
  const m = metaSugerida(nota("Negociação", 4, null, null, 2));
  assert.equal(m.titulo, "Levar Negociação do nível 2 para o nível 4");
  assert.equal(checarSmart({ ...m, recursos: null, prazo: null }).S, true);
});

test("progressoDoPlano: média sem as canceladas, atingida conta 100", () => {
  assert.equal(
    progressoDoPlano([
      { status: "ATINGIDA", progresso: 60 },
      { status: "EM_ANDAMENTO", progresso: 50 },
      { status: "CANCELADA", progresso: 0 },
    ]),
    75,
  );
  assert.equal(progressoDoPlano([{ status: "CANCELADA", progresso: 0 }]), null);
});

test("distribuicao mostra o 70-20-10 do plano", () => {
  assert.deepEqual(distribuicao([{ tipo: "PRATICA" }, { tipo: "PRATICA" }, { tipo: "TROCA" }, { tipo: "FORMAL" }]), {
    PRATICA: 50,
    TROCA: 25,
    FORMAL: 25,
  });
  assert.deepEqual(distribuicao([]), { PRATICA: 0, TROCA: 0, FORMAL: 0 });
});

test("situacaoDaConversa", () => {
  assert.equal(situacaoDaConversa(null, "2026-10-13"), "SEM_DATA");
  assert.equal(situacaoDaConversa("2026-10-12", "2026-10-13"), "ATRASADA");
  assert.equal(situacaoDaConversa("2026-10-13", "2026-10-13"), "PROXIMA");
  assert.equal(situacaoDaConversa("2026-10-20", "2026-10-13"), "PROXIMA");
  assert.equal(situacaoDaConversa("2026-10-21", "2026-10-13"), "EM_DIA");
});

test("lerQuantoFeito arredonda para a escala de 25 em 25", () => {
  assert.equal(lerQuantoFeito("60"), 50);
  assert.equal(lerQuantoFeito(63), 75);
  assert.equal(lerQuantoFeito(130), 100);
  assert.equal(lerQuantoFeito("x"), 0);
});

test("situacaoDaAcao cobra como um combinado até chegar a 100%", () => {
  assert.equal(situacaoDaAcao({ quantoFeito: 100, prazo: "2026-01-01" }, "2026-10-13"), "FEITA");
  assert.equal(situacaoDaAcao({ quantoFeito: 75, prazo: "2026-10-12" }, "2026-10-13"), "ATRASADA");
  assert.equal(situacaoDaAcao({ quantoFeito: 0, prazo: "2026-10-13" }, "2026-10-13"), "HOJE");
  assert.equal(situacaoDaAcao({ quantoFeito: 50, prazo: "2026-11-01" }, "2026-10-13"), "NO_PRAZO");
  assert.equal(situacaoDaAcao({ quantoFeito: 0, prazo: null }, "2026-10-13"), "SEM_DATA");
});

test("execucaoDasAcoes é a média do quanto foi feito", () => {
  assert.equal(execucaoDasAcoes([{ quantoFeito: 100 }, { quantoFeito: 50 }, { quantoFeito: 0 }]), 50);
  assert.equal(execucaoDasAcoes([]), null);
});
