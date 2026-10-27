import "server-only";
import { prisma } from "./prisma";
import { addDaysUTC, dateToDayKey, dayKeyToDate, todayKey } from "./dates";
import {
  calcularDias,
  horarioDaPessoa,
  horarioValido,
  HORARIO_PADRAO,
  type Horario,
  minutoNoDia,
  totalizar,
  type DiaCalculado,
  type DiaParaCalcular,
  type RegrasPonto,
  type TipoOcorrencia,
  type Totais,
} from "./calculo";

/**
 * O ponto lido do banco: batidas, ocorrências e lançamentos de uma empresa,
 * passados pelo cálculo de `calculo.ts`. É o que a API entrega ao RH e o que
 * vai no relatório do colaborador.
 */

export type EmpresaDoPonto = NonNullable<Awaited<ReturnType<typeof empresaPorRh>>>;

export async function empresaPorRh(rhCompanyId: string) {
  return prisma.empresa.findUnique({ where: { rhCompanyId } });
}

/** O horário gravado da empresa, ou o padrão se algo estiver fora do formato. */
export function horarioDaEmpresa(empresa: { horario: unknown }): Horario {
  return horarioValido(empresa.horario) ? empresa.horario : HORARIO_PADRAO;
}

export type PessoaDoPonto = {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  trocarSenha: boolean;
  horario: Horario | null;
  admissao: string | null;
};

export async function pessoasDoPonto(empresaId: string, ids?: string[]): Promise<PessoaDoPonto[]> {
  const lista = await prisma.colaborador.findMany({
    where: { empresaId, ...(ids ? { id: { in: ids } } : {}) },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }, { email: "asc" }],
  });
  return lista.map((p) => ({
    id: p.id,
    nome: p.nome ?? p.email,
    email: p.email,
    ativo: p.ativo,
    trocarSenha: p.trocarSenha,
    horario: horarioValido(p.horario) ? p.horario : null,
    admissao: p.admissao ? dateToDayKey(p.admissao) : null,
  }));
}

export type MarcacaoDoDia = {
  id: string;
  nsr: number;
  minuto: number;
  origem: "APLICATIVO" | "MANUAL";
  motivo: string | null;
  anulada: boolean;
  anuladaMotivo: string | null;
  temFoto: boolean;
  latitude: number | null;
  longitude: number | null;
  precisao: number | null;
};

export type DiaDoEspelho = DiaCalculado & {
  marcacoes: MarcacaoDoDia[];
  ocorrenciaId: string | null;
  ocorrenciaDescricao: string | null;
  /** Antes da admissão ou antes do início do ponto. */
  foraDoPeriodo: boolean;
};

export type CalculoDaPessoa = {
  pessoa: PessoaDoPonto;
  dias: DiaDoEspelho[];
  totais: Totais;
};

function regrasDe(empresa: EmpresaDoPonto, pessoa: PessoaDoPonto): RegrasPonto {
  return {
    regime: empresa.regime,
    horario: horarioDaPessoa(horarioDaEmpresa(empresa), pessoa.horario),
    tolerancia: empresa.tolerancia,
    intervaloMinimo: empresa.intervaloMinimo,
    porSemana: empresa.regime === "BANCO_DE_HORAS" && empresa.bancoSemanal,
  };
}

/**
 * Calcula cada pessoa de `desde` a `ate` (dias "AAAA-MM-DD", inclusive).
 * O dia de hoje entra como em andamento; os dias depois de hoje não entram.
 */
export async function calcularPessoas(
  empresa: EmpresaDoPonto,
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
    prisma.marcacao.findMany({
      where: { empresaId: empresa.id, colaboradorId: { in: ids }, dia: { gte: inicioDaBusca, lte: dayKeyToDate(fim) } },
      orderBy: { momento: "asc" },
      select: {
        id: true,
        nsr: true,
        colaboradorId: true,
        dia: true,
        momento: true,
        origem: true,
        motivo: true,
        anuladaEm: true,
        anuladaMotivo: true,
        latitude: true,
        longitude: true,
        precisao: true,
        foto: { select: { marcacaoId: true } },
      },
    }),
    prisma.ocorrencia.findMany({
      where: {
        empresaId: empresa.id,
        OR: [{ colaboradorId: null }, { colaboradorId: { in: ids } }],
        dia: { gte: inicioDaBusca, lte: dayKeyToDate(fim) },
      },
      select: { id: true, colaboradorId: true, dia: true, tipo: true, descricao: true },
    }),
  ]);

  const marcacoesPor = new Map<string, MarcacaoDoDia[]>();
  for (const m of marcacoes) {
    const dia = dateToDayKey(m.dia);
    const chave = `${m.colaboradorId}|${dia}`;
    const lista = marcacoesPor.get(chave) ?? [];
    lista.push({
      id: m.id,
      nsr: m.nsr,
      minuto: minutoNoDia(m.momento, dia),
      origem: m.origem,
      motivo: m.motivo,
      anulada: Boolean(m.anuladaEm),
      anuladaMotivo: m.anuladaMotivo,
      temFoto: Boolean(m.foto),
      latitude: m.latitude,
      longitude: m.longitude,
      precisao: m.precisao,
    });
    marcacoesPor.set(chave, lista);
  }

  // A ocorrência da pessoa vale mais que a da empresa (férias num feriado continuam férias).
  const daEmpresa = new Map<string, (typeof ocorrencias)[number]>();
  const daPessoa = new Map<string, (typeof ocorrencias)[number]>();
  for (const o of ocorrencias) {
    const dia = dateToDayKey(o.dia);
    if (o.colaboradorId) daPessoa.set(`${o.colaboradorId}|${dia}`, o);
    else daEmpresa.set(dia, o);
  }

  const inicioDoPonto = dateToDayKey(empresa.inicio);

  return pessoas.map((pessoa) => {
    const primeiro = [desde, inicioDoPonto, pessoa.admissao ?? ""].sort().at(-1)!;

    const entradas: DiaParaCalcular[] = [];
    const extras = new Map<string, { marcacoes: MarcacaoDoDia[]; ocorrenciaId: string | null; descricao: string | null; fora: boolean }>();

    for (let d = inicioDaBusca; dateToDayKey(d) <= fim; d = addDaysUTC(d, 1)) {
      const dia = dateToDayKey(d);
      const doDia = (marcacoesPor.get(`${pessoa.id}|${dia}`) ?? []).sort((a, b) => a.minuto - b.minuto);
      const oc = daPessoa.get(`${pessoa.id}|${dia}`) ?? daEmpresa.get(dia) ?? null;
      const fora = dia < primeiro;

      entradas.push({
        dia,
        batidas: fora ? [] : doDia.filter((m) => !m.anulada).map((m) => m.minuto),
        ocorrencia: fora ? "FOLGA" : ((oc?.tipo as TipoOcorrencia | undefined) ?? null),
        emAndamento: dia === hoje,
      });
      extras.set(dia, { marcacoes: doDia, ocorrenciaId: oc?.id ?? null, descricao: oc?.descricao ?? null, fora });
    }

    const calculados = calcularDias(entradas, regrasDe(empresa, pessoa))
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

    return { pessoa, dias: calculados, totais: totalizar(calculados.filter((d) => !d.foraDoPeriodo)) };
  });
}

export type SaldoDoBanco = { dias: number; lancamentos: number; total: number };

/** O saldo do banco de horas de cada pessoa: os dias desde o início do ponto mais os lançamentos. */
export async function saldosDoBanco(empresa: EmpresaDoPonto, pessoas: PessoaDoPonto[]): Promise<Record<string, SaldoDoBanco>> {
  const [calculos, lancamentos] = await Promise.all([
    calcularPessoas(empresa, pessoas, dateToDayKey(empresa.inicio), todayKey()),
    prisma.lancamento.groupBy({
      by: ["colaboradorId"],
      where: { empresaId: empresa.id, colaboradorId: { in: pessoas.map((p) => p.id) } },
      _sum: { minutos: true },
    }),
  ]);
  const porPessoa = new Map(lancamentos.map((l) => [l.colaboradorId, l._sum.minutos ?? 0]));
  return Object.fromEntries(
    calculos.map((c) => {
      const lanc = porPessoa.get(c.pessoa.id) ?? 0;
      return [c.pessoa.id, { dias: c.totais.saldo, lancamentos: lanc, total: c.totais.saldo + lanc }];
    }),
  );
}

/** Quem está dentro agora: bateu entrada e ainda não saiu. */
export async function presentesAgora(empresaId: string) {
  const hoje = todayKey();
  const ontem = dateToDayKey(addDaysUTC(dayKeyToDate(hoje), -1));
  const marcacoes = await prisma.marcacao.findMany({
    where: { empresaId, anuladaEm: null, dia: { gte: dayKeyToDate(ontem), lte: dayKeyToDate(hoje) } },
    orderBy: { momento: "asc" },
    select: { colaboradorId: true, dia: true, momento: true, colaborador: { select: { nome: true, email: true } } },
  });

  const porJornada = new Map<string, { nome: string; dia: string; batidas: Date[] }>();
  for (const m of marcacoes) {
    const dia = dateToDayKey(m.dia);
    const chave = `${m.colaboradorId}|${dia}`;
    const j = porJornada.get(chave) ?? { nome: m.colaborador.nome ?? m.colaborador.email, dia, batidas: [] };
    j.batidas.push(m.momento);
    porJornada.set(chave, j);
  }

  const presentes: { nome: string; desde: string }[] = [];
  let bateramHoje = 0;
  for (const j of porJornada.values()) {
    if (j.dia === hoje) bateramHoje += 1;
    if (j.batidas.length % 2 === 1) {
      const desde = j.batidas[j.batidas.length - 1];
      // Jornada de ontem aberta há mais de 16h é esquecimento, não presença.
      if (Date.now() - desde.getTime() < 16 * 3_600_000) presentes.push({ nome: j.nome, desde: desde.toISOString() });
    }
  }
  presentes.sort((a, b) => a.nome.localeCompare(b.nome));
  return { presentes, bateramHoje };
}
