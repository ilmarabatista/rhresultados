import "server-only";
import { prisma } from "./prisma";
import { addDaysUTC, dateToDayKey, dayKeyToDate, todayKey } from "./dates";
import {
  calcularDias,
  jornadaDaPessoa,
  minutoNoDia,
  totalizar,
  type DiaCalculado,
  type DiaParaCalcular,
  type RegrasPonto,
  type TipoOcorrencia,
  type Totais,
} from "./ponto";

/**
 * O ponto lido do banco: batidas, ocorrências e lançamentos de uma empresa,
 * passados pelo cálculo de `ponto.ts`.
 */

export type ConfigPonto = NonNullable<Awaited<ReturnType<typeof configDoPonto>>>;

export async function configDoPonto(companyId: string) {
  return prisma.pontoConfig.findUnique({ where: { companyId } });
}

export type PessoaDoPonto = {
  id: string;
  nome: string;
  documento: string | null;
  cargo: string | null;
  status: string;
  temPin: boolean;
  jornada: number[] | null;
  admissao: string | null;
  desligamento: string | null;
};

export async function pessoasDoPonto(companyId: string): Promise<PessoaDoPonto[]> {
  const pessoas = await prisma.employee.findMany({
    where: { companyId },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      document: true,
      role: true,
      status: true,
      pontoPin: true,
      pontoJornada: true,
      hiredAt: true,
      terminatedAt: true,
    },
  });
  return pessoas.map((p) => ({
    id: p.id,
    nome: p.name,
    documento: p.document,
    cargo: p.role,
    status: p.status,
    temPin: Boolean(p.pontoPin),
    jornada: p.pontoJornada.length === 7 ? p.pontoJornada : null,
    admissao: p.hiredAt ? dateToDayKey(p.hiredAt) : null,
    desligamento: p.terminatedAt ? dateToDayKey(p.terminatedAt) : null,
  }));
}

export type MarcacaoDoDia = {
  id: string;
  nsr: number;
  minuto: number;
  origem: "RELOGIO" | "MANUAL" | "IMPORTADA";
  motivo: string | null;
  anulada: boolean;
  anuladaMotivo: string | null;
};

export type DiaDoEspelho = DiaCalculado & {
  marcacoes: MarcacaoDoDia[];
  ocorrenciaId: string | null;
  ocorrenciaDescricao: string | null;
  /** Fora do contrato (antes da admissão, depois do desligamento ou antes do início do ponto). */
  foraDoPeriodo: boolean;
};

export type CalculoDaPessoa = {
  pessoa: PessoaDoPonto;
  dias: DiaDoEspelho[];
  totais: Totais;
};

function regrasDe(config: ConfigPonto, pessoa: PessoaDoPonto): RegrasPonto {
  return {
    regime: config.regime,
    jornada: jornadaDaPessoa(config.jornada, pessoa.jornada),
    tolerancia: config.tolerancia,
    intervaloMinimo: config.intervaloMinimo,
  };
}

/**
 * Calcula cada pessoa de `desde` a `ate` (dias "AAAA-MM-DD", inclusive).
 *
 * O dia de hoje entra como em andamento. Os dias depois de hoje não entram.
 */
export async function calcularPessoas(
  companyId: string,
  config: ConfigPonto,
  pessoas: PessoaDoPonto[],
  desde: string,
  ate: string,
): Promise<CalculoDaPessoa[]> {
  const hoje = todayKey();
  const fim = ate < hoje ? ate : hoje;
  if (pessoas.length === 0 || fim < desde) {
    return pessoas.map((pessoa) => ({ pessoa, dias: [], totais: totalizar([]) }));
  }

  // Um dia antes, para ver o descanso entre a jornada de ontem e a primeira do período.
  const inicioDaBusca = addDaysUTC(dayKeyToDate(desde), -1);
  const ids = pessoas.map((p) => p.id);

  const [marcacoes, ocorrencias] = await Promise.all([
    prisma.pontoMarcacao.findMany({
      where: {
        companyId,
        employeeId: { in: ids },
        dia: { gte: inicioDaBusca, lte: dayKeyToDate(fim) },
      },
      orderBy: { momento: "asc" },
      select: {
        id: true,
        nsr: true,
        employeeId: true,
        dia: true,
        momento: true,
        origem: true,
        motivo: true,
        anuladaEm: true,
        anuladaMotivo: true,
      },
    }),
    prisma.pontoOcorrencia.findMany({
      where: {
        companyId,
        OR: [{ employeeId: null }, { employeeId: { in: ids } }],
        dia: { gte: inicioDaBusca, lte: dayKeyToDate(fim) },
      },
      select: { id: true, employeeId: true, dia: true, tipo: true, descricao: true },
    }),
  ]);

  const marcacoesPor = new Map<string, MarcacaoDoDia[]>();
  for (const m of marcacoes) {
    const dia = dateToDayKey(m.dia);
    const chave = `${m.employeeId}|${dia}`;
    const lista = marcacoesPor.get(chave) ?? [];
    lista.push({
      id: m.id,
      nsr: m.nsr,
      minuto: minutoNoDia(m.momento, dia),
      origem: m.origem,
      motivo: m.motivo,
      anulada: Boolean(m.anuladaEm),
      anuladaMotivo: m.anuladaMotivo,
    });
    marcacoesPor.set(chave, lista);
  }

  // A ocorrência da pessoa vale mais que a da empresa (férias num feriado continuam férias).
  const ocorrenciaDaEmpresa = new Map<string, (typeof ocorrencias)[number]>();
  const ocorrenciaDaPessoa = new Map<string, (typeof ocorrencias)[number]>();
  for (const o of ocorrencias) {
    const dia = dateToDayKey(o.dia);
    if (o.employeeId) ocorrenciaDaPessoa.set(`${o.employeeId}|${dia}`, o);
    else ocorrenciaDaEmpresa.set(dia, o);
  }

  const inicioDoPonto = dateToDayKey(config.inicio);

  return pessoas.map((pessoa) => {
    const primeiro = [desde, inicioDoPonto, pessoa.admissao ?? ""].sort().at(-1)!;
    const ultimo = pessoa.desligamento && pessoa.desligamento < fim ? pessoa.desligamento : fim;

    const entradas: DiaParaCalcular[] = [];
    const extras = new Map<string, { marcacoes: MarcacaoDoDia[]; ocorrenciaId: string | null; descricao: string | null; fora: boolean }>();

    for (let d = inicioDaBusca; dateToDayKey(d) <= fim; d = addDaysUTC(d, 1)) {
      const dia = dateToDayKey(d);
      const doDia = (marcacoesPor.get(`${pessoa.id}|${dia}`) ?? []).sort((a, b) => a.minuto - b.minuto);
      const oc = ocorrenciaDaPessoa.get(`${pessoa.id}|${dia}`) ?? ocorrenciaDaEmpresa.get(dia) ?? null;
      const fora = dia < primeiro || dia > ultimo;

      entradas.push({
        dia,
        batidas: fora ? [] : doDia.filter((m) => !m.anulada).map((m) => m.minuto),
        ocorrencia: fora ? "FOLGA" : ((oc?.tipo as TipoOcorrencia | undefined) ?? null),
        emAndamento: dia === hoje,
      });
      extras.set(dia, { marcacoes: doDia, ocorrenciaId: oc?.id ?? null, descricao: oc?.descricao ?? null, fora });
    }

    const calculados = calcularDias(entradas, regrasDe(config, pessoa))
      .filter((d) => d.dia >= desde)
      .map((d): DiaDoEspelho => {
        const e = extras.get(d.dia)!;
        return {
          ...d,
          ocorrencia: e.fora ? null : d.ocorrencia,
          marcacoes: e.marcacoes,
          ocorrenciaId: e.fora ? null : e.ocorrenciaId,
          ocorrenciaDescricao: e.fora ? null : e.descricao,
          foraDoPeriodo: e.fora,
        };
      });

    return {
      pessoa,
      dias: calculados,
      totais: totalizar(calculados.filter((d) => !d.foraDoPeriodo)),
    };
  });
}

/**
 * O saldo do banco de horas de cada pessoa até ontem: todos os dias desde o
 * início do ponto, mais os lançamentos (saldo trazido, horas pagas).
 */
export async function saldosDoBanco(
  companyId: string,
  config: ConfigPonto,
  pessoas: PessoaDoPonto[],
): Promise<Map<string, { dias: number; lancamentos: number; total: number }>> {
  const inicio = dateToDayKey(config.inicio);
  const [calculos, lancamentos] = await Promise.all([
    calcularPessoas(companyId, config, pessoas, inicio, todayKey()),
    prisma.pontoLancamento.groupBy({
      by: ["employeeId"],
      where: { companyId, employeeId: { in: pessoas.map((p) => p.id) } },
      _sum: { minutos: true },
    }),
  ]);

  const porPessoa = new Map(lancamentos.map((l) => [l.employeeId, l._sum.minutos ?? 0]));
  return new Map(
    calculos.map((c) => {
      const lanc = porPessoa.get(c.pessoa.id) ?? 0;
      return [c.pessoa.id, { dias: c.totais.saldo, lancamentos: lanc, total: c.totais.saldo + lanc }];
    }),
  );
}

/** Quem está dentro agora: bateu entrada hoje e ainda não saiu. */
export async function presentesAgora(companyId: string) {
  const hoje = todayKey();
  const ontem = dateToDayKey(addDaysUTC(dayKeyToDate(hoje), -1));
  const marcacoes = await prisma.pontoMarcacao.findMany({
    where: {
      companyId,
      anuladaEm: null,
      dia: { gte: dayKeyToDate(ontem), lte: dayKeyToDate(hoje) },
    },
    orderBy: { momento: "asc" },
    select: { employeeId: true, dia: true, momento: true, employee: { select: { name: true } } },
  });

  const porJornada = new Map<string, { nome: string; dia: string; batidas: Date[] }>();
  for (const m of marcacoes) {
    const dia = dateToDayKey(m.dia);
    const chave = `${m.employeeId}|${dia}`;
    const j = porJornada.get(chave) ?? { nome: m.employee.name, dia, batidas: [] };
    j.batidas.push(m.momento);
    porJornada.set(chave, j);
  }

  const presentes: { nome: string; desde: Date }[] = [];
  let bateramHoje = 0;
  for (const j of porJornada.values()) {
    if (j.dia === hoje) bateramHoje += 1;
    if (j.batidas.length % 2 === 1) {
      const desde = j.batidas[j.batidas.length - 1];
      // Jornada de ontem aberta há mais de 16h é esquecimento, não presença.
      if (Date.now() - desde.getTime() < 16 * 3_600_000) presentes.push({ nome: j.nome, desde });
    }
  }
  presentes.sort((a, b) => a.nome.localeCompare(b.nome));
  return { presentes, bateramHoje };
}
