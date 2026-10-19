import "server-only";
import { prisma } from "./prisma";
import { diasDoMes, cargaSemanal, horarioDaPessoa, type Regime, type TipoOcorrencia, type Totais } from "./calculo";
import { calcularPessoas, horarioDaEmpresa, pessoasDoPonto, saldosDoBanco, type EmpresaDoPonto } from "./dados";

/**
 * O relatório individual do mês: o espelho de ponto como ficou no momento do
 * envio. É o que o colaborador recebe para conferir.
 */
export type DadosDoRelatorio = {
  empresa: string;
  pessoa: { nome: string; email: string };
  mes: string;
  regime: Regime;
  cargaSemanal: number;
  dias: {
    dia: string;
    semana: number;
    batidas: { minuto: number; manual: boolean }[];
    ocorrencia: TipoOcorrencia | null;
    previsto: number;
    trabalhado: number;
    abonado: number;
    extras50: number;
    extras100: number;
    debito: number;
    saldo: number;
    alertas: string[];
    foraDoPeriodo: boolean;
    emAndamento: boolean;
  }[];
  totais: Totais;
  /** Saldo do banco de horas no envio, quando a empresa usa banco. */
  saldoBanco: number | null;
};

export async function montarRelatorio(empresa: EmpresaDoPonto, colaboradorId: string, mes: string): Promise<DadosDoRelatorio | null> {
  const [pessoa] = await pessoasDoPonto(empresa.id, [colaboradorId]);
  if (!pessoa) return null;
  const dias = diasDoMes(mes);
  const [calculo] = await calcularPessoas(empresa, [pessoa], dias[0], dias.at(-1)!);
  const banco = empresa.regime === "BANCO_DE_HORAS" ? (await saldosDoBanco(empresa, [pessoa]))[pessoa.id] : null;

  return {
    empresa: empresa.nome,
    pessoa: { nome: pessoa.nome, email: pessoa.email },
    mes,
    regime: empresa.regime,
    cargaSemanal: cargaSemanal(horarioDaPessoa(horarioDaEmpresa(empresa), pessoa.horario)),
    dias: calculo.dias.map((d) => ({
      dia: d.dia,
      semana: d.semana,
      batidas: d.marcacoes.filter((m) => !m.anulada).map((m) => ({ minuto: m.minuto, manual: m.origem === "MANUAL" })),
      ocorrencia: d.ocorrencia,
      previsto: d.previsto,
      trabalhado: d.trabalhado,
      abonado: d.abonado,
      extras50: d.extras50,
      extras100: d.extras100,
      debito: d.debito,
      saldo: d.saldo,
      alertas: d.alertas,
      foraDoPeriodo: d.foraDoPeriodo,
      emAndamento: d.emAndamento,
    })),
    totais: calculo.totais,
    saldoBanco: banco?.total ?? null,
  };
}

export async function enviarRelatorio(empresa: EmpresaDoPonto, colaboradorId: string, mes: string, autor: string | null) {
  const dados = await montarRelatorio(empresa, colaboradorId, mes);
  if (!dados) return null;
  // Reenviar o mesmo mês troca o retrato e pede a ciência de novo.
  return prisma.relatorio.upsert({
    where: { colaboradorId_mes: { colaboradorId, mes } },
    create: { colaboradorId, mes, dados, enviadoPor: autor },
    update: { dados, enviadoPor: autor, enviadoEm: new Date(), cienteEm: null },
    select: { id: true, enviadoEm: true },
  });
}
