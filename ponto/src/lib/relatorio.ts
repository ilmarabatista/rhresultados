import "server-only";
import { prisma } from "./prisma";
import { dateToDayKey, todayKey } from "./dates";
import { diasDoMes, cargaSemanal, horarioDaPessoa, mesesAte, mesLiberado, type Regime, type TipoOcorrencia, type Totais } from "./calculo";
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
  // Reenviar o mesmo mês troca o retrato e pede a aprovação de novo.
  await prisma.fotoRelatorio.deleteMany({ where: { relatorio: { colaboradorId, mes } } });
  return prisma.relatorio.upsert({
    where: { colaboradorId_mes: { colaboradorId, mes } },
    create: { colaboradorId, mes, dados, enviadoPor: autor },
    update: { dados, enviadoPor: autor, enviadoEm: new Date(), cienteEm: null },
    select: { id: true, enviadoEm: true },
  });
}

// ------------------------------------------------------------ colaborador

/**
 * Os meses que o colaborador pode abrir: do primeiro mês em que o ponto conta
 * para ele até o atual, do mais novo para o mais antigo.
 */
export async function mesesDoColaborador(colaboradorId: string): Promise<string[]> {
  const p = await prisma.colaborador.findUnique({
    where: { id: colaboradorId },
    select: { createdAt: true, empresa: { select: { inicio: true } } },
  });
  if (!p) return [];
  const inicio = dateToDayKey(p.empresa.inicio);
  const cadastro = dateToDayKey(p.createdAt);
  return mesesAte(inicio > cadastro ? inicio : cadastro, todayKey());
}

/**
 * Os meses já fechados (ou enviados pelo RH) que o colaborador ainda não
 * aprovou, do mais antigo para o mais novo.
 */
export async function mesesParaAprovar(colaboradorId: string): Promise<string[]> {
  const hoje = todayKey();
  const [meses, relatorios] = await Promise.all([
    mesesDoColaborador(colaboradorId),
    prisma.relatorio.findMany({ where: { colaboradorId }, select: { mes: true, cienteEm: true } }),
  ]);
  const aprovados = new Set(relatorios.filter((r) => r.cienteEm).map((r) => r.mes));
  const enviados = relatorios.filter((r) => !r.cienteEm).map((r) => r.mes);
  const pendentes = new Set([...meses.filter((m) => mesLiberado(m, hoje)), ...enviados].filter((m) => !aprovados.has(m)));
  return [...pendentes].sort();
}

/**
 * O colaborador aprova o mês: guarda o espelho como está agora, a hora e a
 * foto tirada na hora, como comprovante.
 */
export async function aprovarMes(colaboradorId: string, mes: string, foto: Buffer) {
  const p = await prisma.colaborador.findUnique({ where: { id: colaboradorId }, select: { empresa: true } });
  if (!p) return null;
  const dados = await montarRelatorio(p.empresa, colaboradorId, mes);
  if (!dados) return null;
  const agora = new Date();
  return prisma.$transaction(async (tx) => {
    const r = await tx.relatorio.upsert({
      where: { colaboradorId_mes: { colaboradorId, mes } },
      create: { colaboradorId, mes, dados, enviadoPor: "Fechamento do mês", enviadoEm: agora, cienteEm: agora },
      update: { dados, cienteEm: agora },
      select: { id: true, cienteEm: true },
    });
    await tx.fotoRelatorio.upsert({
      where: { relatorioId: r.id },
      create: { relatorioId: r.id, dados: new Uint8Array(foto) },
      update: { dados: new Uint8Array(foto) },
    });
    return r;
  });
}
