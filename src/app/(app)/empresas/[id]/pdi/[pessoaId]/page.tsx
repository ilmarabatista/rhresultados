import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, formatFullDate, todayKey } from "@/lib/dates";
import { linhasComoItens } from "@/lib/text";
import { execucaoDasAcoes, gap, nivelFinal, situacaoDaConversa } from "@/lib/pdi";
import PdiAvaliacao from "@/components/pdi-avaliacao";
import PdiPlano from "@/components/pdi-plano";
import PdiAcompanhamento from "@/components/pdi-acompanhamento";
import PdiAutoavaliacao from "@/components/pdi-autoavaliacao";
import { lerPerguntas, lerRespostas } from "@/lib/autoavaliacao";
import { semAcento } from "@/lib/text";

export const dynamic = "force-dynamic";
export const metadata = { title: "PDI — RH Resultados" };

const dia = (d: Date | null) => (d ? dateToDayKey(d) : "");

/**
 * O PDI de uma pessoa, nos cinco passos: a descrição do cargo, a
 * autoavaliação que a pessoa responde pelo link, a avaliação dos gaps, o plano
 * com metas SMART e o acompanhamento.
 */
export default async function PdiDaPessoaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pessoaId: string }>;
  searchParams: Promise<{ avaliacao?: string; plano?: string }>;
}) {
  await requireSession();
  const { id, pessoaId } = await params;
  const sp = await searchParams;
  const hoje = todayKey();

  const [pessoa, treinamentos, presencas, modelos] = await Promise.all([
    prisma.employee.findFirst({
      where: { id: pessoaId, companyId: id },
      select: {
        id: true,
        name: true,
        role: true,
        department: true,
        autoavaliacoes: { orderBy: { enviadoEm: "desc" } },
        cargo: {
          select: {
            id: true,
            nome: true,
            missao: true,
            responsabilidades: true,
            requisitos: true,
            competencias: { orderBy: [{ ordem: "asc" }, { nome: "asc" }], select: { nome: true, nivelEsperado: true } },
          },
        },
        avaliacoes: {
          orderBy: [{ data: "desc" }, { createdAt: "desc" }],
          include: { notas: { orderBy: { ordem: "asc" } }, _count: { select: { planos: true } } },
        },
        plans: {
          orderBy: { createdAt: "desc" },
          include: {
            visit: { select: { startTime: true } },
            metas: {
              orderBy: { ordem: "asc" },
              include: {
                acoes: { orderBy: { order: "asc" }, include: { treinamento: { select: { codigo: true, nome: true } } } },
              },
            },
            actions: { where: { metaId: null }, orderBy: { order: "asc" } },
            conversas: {
              orderBy: { data: "desc" },
              include: {
                createdBy: { select: { name: true } },
                progressos: { include: { meta: { select: { titulo: true, ordem: true } } } },
              },
            },
          },
        },
      },
    }),
    prisma.treinamento.findMany({
      where: { companyId: id, ativo: true },
      orderBy: [{ codigo: "asc" }, { nome: "asc" }],
      select: { id: true, codigo: true, nome: true },
    }),
    // Presença em turma realizada: é o que cumpre a ação ligada a um treinamento.
    prisma.meetingParticipant.findMany({
      where: { employeeId: pessoaId, present: true, meeting: { companyId: id, status: "REALIZADA", turma: { isNot: null } } },
      select: { meeting: { select: { date: true, turma: { select: { treinamentoId: true } } } } },
    }),
    prisma.modeloDeAutoavaliacao.findMany({
      where: { companyId: id },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, cargoId: true, _count: { select: { perguntas: true } } },
    }),
  ]);
  if (!pessoa) notFound();

  // Treinamento feito: vale a turma mais recente em que a pessoa esteve.
  const fezEm = new Map<string, Date | null>();
  for (const p of presencas) {
    const t = p.meeting.turma!.treinamentoId;
    const atual = fezEm.get(t);
    if (!fezEm.has(t) || (p.meeting.date && (!atual || p.meeting.date > atual))) fezEm.set(t, p.meeting.date);
  }

  const cargo = pessoa.cargo;
  const avaliacoes = pessoa.avaliacoes.map((a) => ({
    id: a.id,
    dia: dateToDayKey(a.data),
    data: formatFullDate(a.data),
    cargoNome: a.cargoNome,
    pontosFortes: a.pontosFortes ?? "",
    querDesenvolver: a.querDesenvolver ?? "",
    apoio: a.apoio ?? "",
    carreira: a.carreira ?? "",
    planos: a._count.planos,
    notas: a.notas.map((n) => ({
      id: n.id,
      nome: n.nome,
      tipo: n.tipo,
      esperado: n.esperado,
      pessoa: n.pessoa,
      avaliador: n.avaliador,
      acordado: n.acordado,
      comentario: n.comentario ?? "",
    })),
  }));

  const planos = pessoa.plans.map((p) => ({
    id: p.id,
    title: p.title,
    objective: p.objective ?? "",
    startDate: dia(p.startDate),
    endDate: dia(p.endDate),
    periodo:
      p.startDate || p.endDate ? `${p.startDate ? formatFullDate(p.startDate) : "—"} a ${p.endDate ? formatFullDate(p.endDate) : "—"}` : null,
    status: p.status,
    balanco: p.balanco ?? "",
    criadoEm: formatFullDate(p.createdAt),
    avaliacaoId: p.avaliacaoId,
    metas: p.metas.map((m) => ({
      id: m.id,
      notaId: m.notaId ?? "",
      competencia: m.competencia ?? "",
      titulo: m.titulo,
      indicador: m.indicador ?? "",
      recursos: m.recursos ?? "",
      relevancia: m.relevancia ?? "",
      prazo: dia(m.prazo),
      prazoTexto: m.prazo ? formatFullDate(m.prazo) : null,
      status: m.status,
      progresso: m.progresso,
      acoes: m.acoes.map((a) => {
        const turma = a.treinamentoId && fezEm.has(a.treinamentoId) ? fezEm.get(a.treinamentoId) : undefined;
        return {
          id: a.id,
          title: a.title,
          tipo: a.tipo,
          responsavel: a.responsavel ?? "",
          dueDate: dia(a.dueDate),
          prazo: a.dueDate ? formatFullDate(a.dueDate) : null,
          done: a.done,
          quantoFeito: a.quantoFeito,
          observacao: a.observacao ?? "",
          treinamentoId: a.treinamentoId ?? "",
          treinamentoNome: a.treinamento ? (a.treinamento.codigo ? `${a.treinamento.codigo} · ${a.treinamento.nome}` : a.treinamento.nome) : null,
          feitoNaTurma: turma === undefined ? null : turma ? formatFullDate(turma) : "turma realizada",
        };
      }),
    })),
    acoesSoltas: p.actions.map((a) => ({ id: a.id, title: a.title, done: a.done })),
    proximaDia: dia(p.proximaConversa),
    proximaHora: p.visit?.startTime ?? "",
    conversas: p.conversas.map((c) => ({
      id: c.id,
      data: formatFullDate(c.data),
      resumo: c.resumo,
      combinados: c.combinados ?? "",
      autor: c.createdBy?.name ?? null,
      progressos: c.progressos
        .sort((a, b) => a.meta.ordem - b.meta.ordem)
        .map((x) => ({ metaTitulo: x.meta.titulo, progresso: x.progresso, status: x.status, comentario: x.comentario ?? "" })),
    })),
  }));

  const plano =
    planos.find((p) => p.id === sp.plano) ?? planos.find((p) => p.status === "EM_ANDAMENTO") ?? planos[0] ?? null;

  // Os gaps que a meta pode trabalhar: os da avaliação do plano, ou a mais recente.
  const avaliacaoDoPlano = avaliacoes.find((a) => a.id === plano?.avaliacaoId) ?? avaliacoes[0] ?? null;
  const gaps = (avaliacaoDoPlano?.notas ?? []).map((n) => {
    const g = gap(n);
    return {
      id: n.id,
      nome: n.nome,
      detalhe: g != null && g > 0 ? `(${nivelFinal(n)} → ${n.esperado})` : g != null ? "(sem gap)" : "(sem nota)",
    };
  });

  const autoavaliacoes = pessoa.autoavaliacoes.map((a) => {
    const perguntas = lerPerguntas(a.perguntas);
    return {
      id: a.id,
      token: a.token,
      titulo: a.titulo,
      status: a.status,
      enviadoEm: formatFullDate(a.enviadoEm),
      respondidoEm: a.respondidoEm ? formatFullDate(a.respondidoEm) : null,
      prazo: a.prazo ? formatFullDate(a.prazo) : null,
      atrasado: a.status === "ENVIADO" && a.prazo != null && dateToDayKey(a.prazo) < hoje,
      avaliacaoId: a.avaliacaoId,
      perguntas,
      respostas: lerRespostas(perguntas, a.respostas),
    };
  });
  // O modelo sugerido: o do cargo da pessoa; senão, o que tem o nome do cargo.
  const chave = (t: string | null | undefined) => semAcento(t ?? "").trim().toLowerCase();
  const sugerido =
    modelos.find((m) => cargo && m.cargoId === cargo.id) ??
    modelos.find((m) => pessoa.role && chave(m.nome) === chave(pessoa.role)) ??
    modelos.find((m) => m._count.perguntas > 0);

  const passos = [
    { n: 1, rotulo: "Cargo", href: "#cargo", feito: (cargo?.competencias.length ?? 0) > 0 },
    { n: 2, rotulo: "Autoavaliação", href: "#autoavaliacao", feito: autoavaliacoes.some((a) => a.status === "RESPONDIDO") },
    { n: 3, rotulo: "Avaliação", href: "#avaliacao", feito: avaliacoes.length > 0 },
    { n: 4, rotulo: "Plano", href: "#plano", feito: Boolean(plano && plano.metas.length > 0) },
    { n: 5, rotulo: "Acompanhamento", href: "#acompanhamento", feito: Boolean(plano && plano.conversas.length > 0) },
  ];

  return (
    <main className="space-y-3.5">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <Link href={`/empresas/${id}/pdi`} className="text-slate-500 transition hover:text-slate-900">
          ← PDI da equipe
        </Link>
        <Link href={`/empresas/${id}/equipe/${pessoa.id}`} className="text-slate-500 transition hover:text-slate-900">
          Ficha da pessoa
        </Link>
        <Link
          href={`/empresas/${id}/pdi/${pessoa.id}/imprimir${plano ? `?plano=${plano.id}` : ""}`}
          className="ml-auto rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50"
        >
          PDI para a conversa 1 a 1
        </Link>
      </div>

      <header>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">PDI · {pessoa.name}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {[pessoa.role, pessoa.department].filter(Boolean).join(" · ") || "Sem cargo informado"}
        </p>
        <ol className="mt-3 flex flex-wrap gap-1.5">
          {passos.map((p) => (
            <li key={p.n}>
              <a
                href={p.href}
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                  p.feito
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-slate-200 bg-white text-slate-500 hover:border-brand-300"
                }`}
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded-full text-micro font-semibold ${
                    p.feito ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {p.feito ? "✓" : p.n}
                </span>
                {p.rotulo}
              </a>
            </li>
          ))}
        </ol>
      </header>

      <section id="cargo" className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-900">
            <span className="mr-1.5 text-brand-600">1</span>Descrição do cargo{cargo ? `: ${cargo.nome}` : ""}
          </h2>
          {cargo ? (
            <Link href={`/empresas/${id}/pdi?aba=cargos&cargo=${cargo.id}`} className="text-xs text-brand-700 hover:text-brand-800">
              Editar a descrição do cargo ›
            </Link>
          ) : null}
        </div>
        {!cargo ? (
          <p className="text-sm text-slate-500">
            A pessoa está sem cargo.{" "}
            <Link href={`/empresas/${id}/equipe/${pessoa.id}`} className="text-brand-700 underline">
              Escolha o cargo na ficha
            </Link>
            .
          </p>
        ) : (
          <details open={avaliacoes.length === 0} className="group">
            <summary className="cursor-pointer text-xs text-slate-500 marker:text-slate-300">
              {cargo.missao ? cargo.missao : "Missão não descrita"} · {cargo.competencias.length} competência(s)
            </summary>
            <div className="mt-3 grid gap-4 text-sm md:grid-cols-3">
              <div>
                <h3 className="mb-1 text-micro font-semibold uppercase tracking-wider text-slate-500">Responsabilidades</h3>
                {cargo.responsabilidades ? (
                  <ul className="list-disc space-y-0.5 pl-4 text-slate-600">
                    {linhasComoItens(cargo.responsabilidades).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-slate-500">—</p>
                )}
              </div>
              <div>
                <h3 className="mb-1 text-micro font-semibold uppercase tracking-wider text-slate-500">Requisitos</h3>
                <p className="whitespace-pre-wrap text-slate-600">{cargo.requisitos || "—"}</p>
              </div>
              <div>
                <h3 className="mb-1 text-micro font-semibold uppercase tracking-wider text-slate-500">Competências e nível</h3>
                {cargo.competencias.length === 0 ? (
                  <p className="text-amber-700">
                    Nenhuma ainda.{" "}
                    <Link href={`/empresas/${id}/pdi?aba=cargos&cargo=${cargo.id}`} className="underline">
                      Descrever
                    </Link>
                  </p>
                ) : (
                  <ul className="space-y-0.5 text-slate-600">
                    {cargo.competencias.map((c) => (
                      <li key={c.nome} className="flex justify-between gap-2">
                        <span className="truncate">{c.nome}</span>
                        <span className="tabular-nums text-slate-500">{c.nivelEsperado}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>
        )}
      </section>

      <PdiAutoavaliacao
        companyId={id}
        employeeId={pessoa.id}
        nome={pessoa.name}
        modelos={modelos.map((m) => ({ id: m.id, nome: m.nome, perguntas: m._count.perguntas }))}
        sugerido={sugerido?.id ?? ""}
        autoavaliacoes={autoavaliacoes}
      />

      <PdiAvaliacao
        companyId={id}
        employeeId={pessoa.id}
        nome={pessoa.name}
        temCargo={Boolean(cargo)}
        cargoDescrito={(cargo?.competencias.length ?? 0) > 0}
        avaliacoes={avaliacoes}
        escolhida={sp.avaliacao ?? null}
        temPlanoAtivo={planos.some((p) => p.status === "EM_ANDAMENTO")}
        hoje={hoje}
      />

      <PdiPlano
        planos={planos}
        escolhido={plano?.id ?? null}
        gaps={gaps}
        treinamentos={treinamentos.map((t) => ({ id: t.id, nome: t.codigo ? `${t.codigo} · ${t.nome}` : t.nome }))}
        hoje={hoje}
      />

      <PdiAcompanhamento
        planId={plano?.id ?? null}
        aberto={plano?.status === "EM_ANDAMENTO"}
        metas={(plano?.metas ?? [])
          .filter((m) => m.status !== "CANCELADA")
          .map((m) => ({
            id: m.id,
            titulo: m.titulo,
            status: m.status,
            progresso: m.progresso,
            execucao: execucaoDasAcoes(m.acoes.map((a) => ({ quantoFeito: a.feitoNaTurma ? 100 : a.quantoFeito }))),
          }))}
        conversas={plano?.conversas ?? []}
        proximaDia={plano?.proximaDia ?? ""}
        proximaHora={plano?.proximaHora ?? ""}
        situacao={situacaoDaConversa(plano?.proximaDia || null, hoje)}
        hoje={hoje}
      />
    </main>
  );
}
