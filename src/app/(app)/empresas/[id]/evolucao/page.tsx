import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate, formatMoment, todayKey } from "@/lib/dates";
import { nomeDoMes, outroMes } from "@/lib/ponto";
import { codigoDaReuniao } from "@/lib/reunioes";
import { Etiqueta, Numeros, TituloDaSecao, Vazio } from "@/components/ui";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Evolução — RH Resultados" };

/**
 * O relatório do mês para o cliente: o que foi feito em cada reunião
 * realizada, com a pauta, o conversado, o decidido e os combinados — os
 * concluídos e os que ainda dependem de alguém.
 *
 * A tela é o próprio documento: o que aparece aqui é o que sai no PDF, pelo
 * "Imprimir / PDF" do navegador. Por isso o cabeçalho traz empresa e mês, e
 * cada reunião evita quebrar no meio da página.
 */

/**
 * O mês, como "2026-09", vindo do endereço ou o mês de hoje — hoje no fuso do
 * escritório, e não no do servidor (na nuvem, o servidor roda em UTC e virava
 * o mês três horas antes).
 */
function mesValido(valor: string | undefined): string {
  if (valor && /^\d{4}-(0[1-9]|1[0-2])$/.test(valor)) return valor;
  return todayKey().slice(0, 7);
}

/** "setembro de 2026" → "Setembro de 2026" (o `capitalize` do CSS viraria "De"). */
function mesEscrito(mes: string): string {
  const nome = nomeDoMes(mes);
  return nome.charAt(0).toUpperCase() + nome.slice(1);
}

function limitesDoMes(mes: string): { de: Date; ate: Date } {
  const [a, m] = mes.split("-").map(Number);
  return { de: new Date(Date.UTC(a, m - 1, 1)), ate: new Date(Date.UTC(a, m, 1)) };
}

export default async function EvolucaoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ mes?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const mes = mesValido((await searchParams).mes);
  const { de, ate } = limitesDoMes(mes);

  const [empresa, reunioes] = await Promise.all([
    prisma.company.findUnique({ where: { id }, select: { name: true } }),
    prisma.meeting.findMany({
      where: { companyId: id, status: "REALIZADA", date: { gte: de, lt: ate } },
      orderBy: [{ date: "asc" }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        title: true,
        date: true,
        startTime: true,
        location: true,
        agenda: true,
        service: { select: { name: true } },
        plano: { select: { titulo: true, service: { select: { name: true } } } },
        participants: { where: { present: true }, orderBy: { name: "asc" }, select: { id: true, name: true } },
        items: {
          orderBy: [{ kind: "asc" }, { order: "asc" }],
          select: {
            id: true,
            kind: true,
            text: true,
            reason: true,
            validFrom: true,
            responsible: true,
            dueDate: true,
            done: true,
            doneAt: true,
          },
        },
      },
    }),
  ]);
  if (!empresa) notFound();

  const decisoes = reunioes.flatMap((r) => r.items.filter((i) => i.kind === "DECIDIDO"));
  // Os combinados de TODAS as reuniões realizadas até o fim do mês, e não só
  // os das reuniões do mês: o que ficou de agosto continua em desenvolvimento
  // em setembro, e sumir dele era esconder do cliente o que falta.
  const combinadosDeTodasAsReunioes = await prisma.meetingItem.findMany({
    where: { kind: "COMBINADO", meeting: { companyId: id, status: "REALIZADA", date: { lt: ate } } },
    orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      text: true,
      responsible: true,
      dueDate: true,
      done: true,
      doneAt: true,
      meeting: { select: { id: true, title: true, date: true } },
    },
  });

  /** Feito dentro do mês, mesmo que tenha sido combinado em reunião anterior. */
  const concluidosNoMes = combinadosDeTodasAsReunioes.filter((c) => c.done && c.doneAt && c.doneAt >= de && c.doneAt < ate);
  const emDesenvolvimento = combinadosDeTodasAsReunioes.filter((c) => !c.done);
  const vindosDeAntes = emDesenvolvimento.filter((c) => c.meeting.date && c.meeting.date < de);
  const hoje = new Date();

  const href = (m: string) => `/empresas/${id}/evolucao?mes=${m}`;
  const navegaMes = (
    <div className="no-print flex items-center gap-1 text-xs">
      <Link href={href(outroMes(mes, -1))} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:text-brand-700">
        ←
      </Link>
      <span className="min-w-[8.5rem] text-center font-medium text-slate-600">{nomeDoMes(mes)}</span>
      <Link href={href(outroMes(mes, 1))} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:text-brand-700">
        →
      </Link>
    </div>
  );

  return (
    <main className="space-y-3.5">
      <div className="no-print">
        <TituloDaSecao
          antes="Evolução da"
          destaque="Empresa"
          acao={
            <div className="flex items-center gap-2">
              {navegaMes}
              {reunioes.length ? <PrintButton /> : null}
            </div>
          }
        />
      </div>

      {/* Cabeçalho do documento: no papel é a capa do relatório do mês. */}
      <header className="rounded-lg border border-slate-200 bg-white px-4 py-3">
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Relatório de atividades · RH Resultados</p>
        <h2 className="text-base font-semibold text-slate-900">{empresa.name}</h2>
        <p className="text-xs text-slate-500">{mesEscrito(mes)}</p>
      </header>

      {reunioes.length === 0 && emDesenvolvimento.length === 0 ? (
        <Vazio>
          Nenhuma reunião realizada em {nomeDoMes(mes)}, e nada em desenvolvimento de meses anteriores. Use as setas para ver
          outro mês; a reunião entra aqui quando é marcada como realizada.
        </Vazio>
      ) : (
        <>
          <Numeros
            colunas={4}
            itens={[
              { rotulo: "Reuniões realizadas", valor: reunioes.length },
              { rotulo: "Decisões tomadas", valor: decisoes.length },
              { rotulo: "Concluídos no mês", valor: concluidosNoMes.length, tom: "bom" as const },
              {
                rotulo: "Em desenvolvimento",
                valor: emDesenvolvimento.length,
                detalhe: vindosDeAntes.length > 0 ? `${vindosDeAntes.length} de meses anteriores` : undefined,
                tom: emDesenvolvimento.length > 0 ? ("atencao" as const) : ("neutro" as const),
              },
            ]}
          />

          {reunioes.map((r) => {
            const produto = r.service?.name ?? r.plano?.service?.name ?? null;
            const conversado = r.items.filter((i) => i.kind === "CONVERSADO");
            const decidido = r.items.filter((i) => i.kind === "DECIDIDO");
            const combinadosDaReuniao = r.items.filter((i) => i.kind === "COMBINADO");

            return (
              <section key={r.id} className="print-break overflow-hidden rounded-lg border border-slate-200 bg-white">
                <header className="flex flex-wrap items-baseline justify-between gap-2 bg-brand-900 px-3 py-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-white">{r.title}</h3>
                  <span className="text-[11px] text-brand-200">
                    {[formatFullDate(r.date), r.startTime, produto, r.location].filter(Boolean).join(" · ")}
                  </span>
                </header>

                <div className="space-y-2.5 px-3 py-2.5">
                  {r.participants.length > 0 ? (
                    <p className="text-[11px] text-slate-500">
                      <span className="font-medium text-slate-600">Participaram:</span>{" "}
                      {r.participants.map((p) => p.name).join(", ")}
                    </p>
                  ) : null}

                  {r.agenda ? (
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pauta</h4>
                      <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-slate-700">{r.agenda}</p>
                    </div>
                  ) : null}

                  {conversado.length > 0 ? (
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">O que foi conversado</h4>
                      <ul className="mt-0.5 space-y-0.5">
                        {conversado.map((i) => (
                          <li key={i.id} className="text-[12px] leading-relaxed text-slate-700">
                            • {i.text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {decidido.length > 0 ? (
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Decisões</h4>
                      <ul className="mt-0.5 space-y-1">
                        {decidido.map((i) => (
                          <li key={i.id} className="text-[12px] leading-relaxed text-slate-700">
                            • {i.text}
                            {i.reason ? <span className="text-slate-500"> — porque {i.reason}</span> : null}
                            {i.validFrom ? (
                              <span className="text-[10px] text-slate-400"> (vale desde {formatFullDate(i.validFrom)})</span>
                            ) : null}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  {combinadosDaReuniao.length > 0 ? (
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Combinados</h4>
                      <ul className="mt-0.5 space-y-0.5">
                        {combinadosDaReuniao.map((c) => (
                          <li key={c.id} className="flex items-start gap-2 text-[12px] leading-relaxed">
                            {c.done ? (
                              <Check size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                            ) : (
                              <span className="mt-[0.35rem] h-2 w-2 shrink-0 rounded-full border border-amber-500" />
                            )}
                            <span className="min-w-0 flex-1 text-slate-700">{c.text}</span>
                            <span className="shrink-0 text-[10px] text-slate-400">
                              {[
                                c.responsible,
                                c.done
                                  ? c.doneAt
                                    ? `concluído em ${formatMoment(c.doneAt)}`
                                    : "concluído"
                                  : c.dueDate
                                    ? `até ${formatFullDate(c.dueDate)}`
                                    : "sem prazo",
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

                  <p className="text-[10px] text-slate-400">
                    {codigoDaReuniao(r.number)}
                    {r.plano?.titulo ? ` · ${r.plano.titulo}` : ""}
                  </p>
                </div>
              </section>
            );
          })}

          {/* O que ficou pronto no mês, venha da reunião deste mês ou de antes. */}
          {concluidosNoMes.length > 0 ? (
            <section className="print-break overflow-hidden rounded-lg border border-emerald-200 bg-white">
              <header className="bg-emerald-50 px-3 py-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-emerald-800">
                  O que foi desenvolvido em {nomeDoMes(mes)}
                </h3>
              </header>
              <ul className="divide-y divide-slate-100">
                {concluidosNoMes.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-[12px]">
                    <Check size={13} className="shrink-0 text-emerald-600" />
                    <span className="min-w-0 flex-1 text-slate-700">{c.text}</span>
                    <span className="shrink-0 text-[10px] text-slate-400">
                      {[c.responsible, `combinado em ${formatFullDate(c.meeting.date)}`, c.doneAt ? `concluído em ${formatMoment(c.doneAt)}` : null]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {/* Tudo o que continua andando, de qualquer reunião — inclusive as de
              meses anteriores, que é o que o cliente precisa cobrar. */}
          {emDesenvolvimento.length > 0 ? (
            <section className="print-break overflow-hidden rounded-lg border border-amber-200 bg-white">
              <header className="flex flex-wrap items-baseline justify-between gap-2 bg-amber-50 px-3 py-2">
                <h3 className="text-[12px] font-semibold uppercase tracking-wider text-amber-800">O que está em desenvolvimento</h3>
                {vindosDeAntes.length > 0 ? (
                  <span className="text-[10px] text-amber-700">{vindosDeAntes.length} vem de reuniões anteriores</span>
                ) : null}
              </header>
              <ul className="divide-y divide-slate-100">
                {emDesenvolvimento.map((c) => {
                  const atrasado = Boolean(c.dueDate && c.dueDate < hoje);
                  return (
                    <li key={c.id} className="flex flex-wrap items-center gap-2 px-3 py-1.5 text-[12px]">
                      <span className="mt-[0.1rem] h-2 w-2 shrink-0 rounded-full border border-amber-500" />
                      <span className="min-w-0 flex-1 text-slate-700">{c.text}</span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {[c.responsible, `de ${formatFullDate(c.meeting.date)}`].filter(Boolean).join(" · ")}
                      </span>
                      <Etiqueta tom={atrasado ? "ruim" : "atencao"}>
                        {c.dueDate ? `${atrasado ? "venceu" : "até"} ${formatFullDate(c.dueDate)}` : "sem prazo"}
                      </Etiqueta>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}
        </>
      )}
    </main>
  );
}
