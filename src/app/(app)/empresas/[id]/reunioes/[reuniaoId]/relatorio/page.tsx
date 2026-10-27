import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, todayKey } from "@/lib/dates";
import { codigoDaReuniao, situacaoDoCombinado } from "@/lib/reunioes";
import { telefoneDoWhatsApp } from "@/lib/autoavaliacao";
import {
  detalheDoCombinado,
  ordenarEmAberto,
  textoDoRelatorio,
  type RelatorioDaReuniao,
} from "@/lib/reuniao-relatorio";
import RelatorioDaReuniaoAcoes from "@/components/relatorio-da-reuniao-acoes";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatório da reunião — RH Resultados" };

/**
 * O relatório da reunião para a gestão da empresa, pronto para mandar pelo
 * WhatsApp ou salvar em PDF. Abre sozinho quando a reunião é encerrada.
 */
export default async function RelatorioDaReuniaoPage({
  params,
}: {
  params: Promise<{ id: string; reuniaoId: string }>;
}) {
  await requireSession();
  const { id, reuniaoId } = await params;

  const r = await prisma.meeting.findUnique({
    where: { id: reuniaoId },
    include: {
      company: { select: { name: true, contactName: true, contactPhone: true } },
      participants: { orderBy: { name: "asc" }, select: { name: true, present: true } },
      items: { orderBy: [{ order: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!r || r.companyId !== id) notFound();

  // Os combinados de antes que ainda não foram feitos: a gestão cobra por eles.
  const anteriores = await prisma.meetingItem.findMany({
    where: {
      kind: "COMBINADO",
      done: false,
      meetingId: { not: reuniaoId },
      meeting: { companyId: id, status: { in: ["AGENDADA", "REALIZADA"] } },
    },
    orderBy: { dueDate: "asc" },
    take: 30,
    select: {
      text: true,
      responsible: true,
      dueDate: true,
      meeting: { select: { number: true, title: true } },
    },
  });

  const hoje = todayKey();
  const relatorio: RelatorioDaReuniao = {
    empresa: r.company.name,
    titulo: r.title,
    codigo: codigoDaReuniao(r.number),
    dia: r.date ? dateToDayKey(r.date) : null,
    hora: r.startTime,
    presentes: r.participants.filter((p) => p.present).map((p) => p.name),
    ausentes: r.participants.filter((p) => !p.present).map((p) => p.name),
    resumo: r.summary ?? "",
    conversado: r.items.filter((i) => i.kind === "CONVERSADO").map((i) => i.text),
    decidido: r.items.filter((i) => i.kind === "DECIDIDO").map((i) => ({ texto: i.text, porque: i.reason })),
    combinado: r.items
      .filter((i) => i.kind === "COMBINADO")
      .map((i) => ({
        texto: i.text,
        responsavel: i.responsible,
        prazo: i.dueDate ? dateToDayKey(i.dueDate) : null,
        feito: i.done,
      })),
    emAberto: ordenarEmAberto(
      anteriores.map((i) => ({
        texto: i.text,
        responsavel: i.responsible,
        prazo: i.dueDate ? dateToDayKey(i.dueDate) : null,
        feito: false,
        reuniao: `${codigoDaReuniao(i.meeting.number)} ${i.meeting.title}`,
      })),
    ),
  };

  const telefone = telefoneDoWhatsApp(r.company.contactPhone);
  const total = relatorio.presentes.length + relatorio.ausentes.length;
  const vazia =
    !relatorio.resumo.trim() && !relatorio.decidido.length && !relatorio.combinado.length && !relatorio.conversado.length;
  const corDoPrazo = (c: { prazo: string | null; feito: boolean }) => {
    const s = situacaoDoCombinado(c, hoje);
    return s === "ATRASADO" ? "text-red-700" : s === "HOJE" ? "text-amber-700" : s === "FEITO" ? "text-emerald-700" : "text-slate-500";
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5 bg-white p-6 text-slate-800 print:max-w-none print:p-0">
      <div className="no-print space-y-3">
        <Link href={`/empresas/${id}/reunioes/${reuniaoId}`} className="text-xs text-slate-500 hover:text-brand-700">
          ‹ Voltar à reunião
        </Link>
        {vazia ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            A ata desta reunião está vazia. Grave e organize com IA, ou escreva a ata, antes de mandar o relatório.
          </p>
        ) : null}
        <RelatorioDaReuniaoAcoes
          texto={textoDoRelatorio(relatorio, hoje)}
          contato={telefone ? { nome: r.company.contactName, telefone } : null}
        />
        {!telefone ? (
          <p className="text-xs text-slate-500">
            Para o botão já abrir a conversa com a gestão, preencha o telefone do contato em Dados da empresa.
          </p>
        ) : null}
      </div>

      <header className="border-b border-slate-200 pb-3">
        <p className="text-xs uppercase tracking-[0.12em] text-brand-600">{relatorio.empresa}</p>
        <h1 className="text-xl font-semibold">Relatório de reunião</h1>
        <p className="mt-1 text-sm text-slate-600">
          {relatorio.titulo} · {relatorio.codigo}
          {relatorio.dia ? ` · ${relatorio.dia.split("-").reverse().join("/")}` : ""}
          {relatorio.hora ? ` às ${relatorio.hora}` : ""}
        </p>
      </header>

      {total ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Participantes</h2>
          <p className="text-sm">
            <strong>{relatorio.presentes.length}</strong> de {total} presentes
            {relatorio.presentes.length ? `: ${relatorio.presentes.join(", ")}` : ""}
          </p>
          {relatorio.ausentes.length ? (
            <p className="text-sm text-slate-500">Ausentes: {relatorio.ausentes.join(", ")}</p>
          ) : null}
        </section>
      ) : null}

      {relatorio.resumo.trim() ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Resumo</h2>
          <p className="whitespace-pre-line text-sm leading-relaxed">{relatorio.resumo.trim()}</p>
        </section>
      ) : null}

      {relatorio.decidido.length ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Decisões</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {relatorio.decidido.map((d, i) => (
              <li key={i}>
                {d.texto}
                {d.porque ? <span className="text-slate-500"> — {d.porque}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {relatorio.combinado.length ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Próximos passos</h2>
          <ul className="space-y-1.5 text-sm">
            {relatorio.combinado.map((c, i) => (
              <li key={i} className="border-l-2 border-brand-200 pl-3">
                {c.texto}
                <span className={`block text-xs ${corDoPrazo(c)}`}>{detalheDoCombinado(c, hoje)}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {relatorio.conversado.length ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">Assuntos tratados</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm">
            {relatorio.conversado.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        </section>
      ) : null}

      {relatorio.emAberto.length ? (
        <section className="space-y-1">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Ainda em aberto de reuniões anteriores
          </h2>
          <ul className="space-y-1.5 text-sm">
            {relatorio.emAberto.map((c, i) => (
              <li key={i} className="border-l-2 border-slate-200 pl-3">
                {c.texto}
                <span className={`block text-xs ${corDoPrazo(c)}`}>
                  {detalheDoCombinado(c, hoje)} · {c.reuniao}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
