import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { addDaysUTC, dayKeyToDate, formatFullDate } from "@/lib/dates";
import { diaValido } from "@/lib/agenda";
import { montarCsv } from "@/lib/csv";
import { codigoDaReuniao } from "@/lib/reunioes";
import { slugify } from "@/lib/text";

/**
 * As reuniões realizadas no período em CSV, uma por linha, para análise fora
 * do sistema: produto, plano, presentes, decisões e combinados.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("empresa");
  const de = searchParams.get("de");
  const ate = searchParams.get("ate");

  if (!companyId) {
    return NextResponse.json({ erro: "Empresa não informada." }, { status: 400 });
  }

  // Data mexida na URL virava "Invalid Date" dentro da consulta, e a
  // resposta era um erro 500 em vez de uma mensagem.
  if ((de && !diaValido(de)) || (ate && !diaValido(ate))) {
    return NextResponse.json(
      { erro: "Período inválido. Use datas no formato AAAA-MM-DD." },
      { status: 400 },
    );
  }

  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { name: true },
  });
  if (!company) {
    return NextResponse.json({ erro: "Empresa não encontrada." }, { status: 404 });
  }

  const periodo = {
    ...(de ? { gte: dayKeyToDate(de) } : {}),
    ...(ate ? { lt: addDaysUTC(dayKeyToDate(ate), 1) } : {}),
  };

  const reunioes = await prisma.meeting.findMany({
    where: { companyId, status: "REALIZADA", ...(de || ate ? { date: periodo } : {}) },
    orderBy: [{ date: "asc" }, { number: "asc" }],
    select: {
      number: true,
      title: true,
      date: true,
      startTime: true,
      location: true,
      service: { select: { name: true } },
      plano: { select: { titulo: true, service: { select: { name: true } } } },
      participants: { where: { present: true }, select: { name: true } },
      items: { select: { kind: true, done: true } },
    },
  });

  const csv = montarCsv(
    [
      "Empresa",
      "Código",
      "Data",
      "Hora",
      "Reunião",
      "Produto",
      "Plano",
      "Local",
      "Presentes",
      "Decisões",
      "Combinados",
      "Combinados cumpridos",
    ],
    reunioes.map((r) => [
      company.name,
      codigoDaReuniao(r.number),
      r.date ? formatFullDate(r.date) : "",
      r.startTime ?? "",
      r.title,
      r.service?.name ?? r.plano?.service?.name ?? "",
      r.plano?.titulo ?? "",
      r.location ?? "",
      r.participants.map((p) => p.name).join(", "),
      String(r.items.filter((i) => i.kind === "DECIDIDO").length),
      String(r.items.filter((i) => i.kind === "COMBINADO").length),
      String(r.items.filter((i) => i.kind === "COMBINADO" && i.done).length),
    ]),
  );

  const arquivo = `relatorio-${slugify(company.name)}-${de ?? "inicio"}-a-${ate ?? "hoje"}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${arquivo}"`,
    },
  });
}
