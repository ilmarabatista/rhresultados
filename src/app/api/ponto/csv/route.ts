import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { montarCsv } from "@/lib/csv";
import { slugify } from "@/lib/text";
import { DIAS_DA_SEMANA, diasDoMes, horarioEscrito, horas, NOME_DA_OCORRENCIA, relogio } from "@/lib/ponto";
import { calculosNoPonto, ErroDoPonto } from "@/lib/ponto-api";

/**
 * O ponto do mês como planilha: uma linha por colaborador por dia, pronta
 * para o contador lançar na folha. Os dados vêm do sistema de ponto.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("empresa");
  const mes = searchParams.get("mes") ?? "";
  if (!companyId) return NextResponse.json({ erro: "Empresa não informada." }, { status: 400 });
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ erro: "Mês inválido." }, { status: 400 });

  const company = await prisma.company.findUnique({ where: { id: companyId }, select: { name: true } });
  if (!company) return NextResponse.json({ erro: "Empresa não encontrada." }, { status: 404 });

  const dias = diasDoMes(mes);
  let calculos;
  try {
    calculos = await calculosNoPonto(companyId, dias[0], dias.at(-1)!);
  } catch (e) {
    const status = e instanceof ErroDoPonto ? e.status : 503;
    return NextResponse.json({ erro: e instanceof Error ? e.message : "Erro no ponto." }, { status });
  }

  const linhas: string[][] = [];
  for (const c of calculos) {
    for (const d of c.dias) {
      if (d.foraDoPeriodo) continue;
      linhas.push([
        c.pessoa.nome,
        c.pessoa.email,
        d.dia.split("-").reverse().join("/"),
        DIAS_DA_SEMANA[d.semana],
        horarioEscrito(d.horario),
        d.marcacoes
          .filter((m) => !m.anulada)
          .map((m) => relogio(m.minuto) + (m.origem === "MANUAL" ? "*" : ""))
          .join(" "),
        horas(d.previsto),
        horas(d.trabalhado),
        horas(d.abonado),
        horas(d.extras50),
        horas(d.extras100),
        horas(d.debito),
        d.emAndamento ? "" : horas(d.saldo),
        d.ocorrencia ? NOME_DA_OCORRENCIA[d.ocorrencia] : "",
        d.alertas.join("; "),
      ]);
    }
  }

  const csv = montarCsv(
    ["Colaborador", "Email", "Data", "Dia", "Horário", "Marcações", "Previsto", "Trabalhado", "Abonado", "Extra 50%", "Extra 100%", "Atraso/falta", "Saldo", "Ocorrência", "Alertas"],
    linhas,
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ponto-${slugify(company.name)}-${mes}.csv"`,
    },
  });
}
