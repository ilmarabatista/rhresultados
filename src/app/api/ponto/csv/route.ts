import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { montarCsv } from "@/lib/csv";
import { slugify } from "@/lib/text";
import { DIAS_DA_SEMANA, diasDoMes, horas, NOME_DA_OCORRENCIA, relogio } from "@/lib/ponto";
import { calcularPessoas, configDoPonto, pessoasDoPonto } from "@/lib/ponto-dados";

/**
 * O ponto do mês como planilha: uma linha por pessoa por dia, pronta para o
 * contador lançar na folha.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const companyId = searchParams.get("empresa");
  const mes = searchParams.get("mes") ?? "";
  if (!companyId) return NextResponse.json({ erro: "Empresa não informada." }, { status: 400 });
  if (!/^\d{4}-\d{2}$/.test(mes)) return NextResponse.json({ erro: "Mês inválido." }, { status: 400 });

  const [company, config] = await Promise.all([
    prisma.company.findUnique({ where: { id: companyId }, select: { name: true } }),
    configDoPonto(companyId),
  ]);
  if (!company || !config) return NextResponse.json({ erro: "Ponto não encontrado." }, { status: 404 });

  const pessoas = (await pessoasDoPonto(companyId)).filter((p) => p.status !== "DESLIGADO" || p.desligamento);
  const dias = diasDoMes(mes);
  const calculos = await calcularPessoas(companyId, config, pessoas, dias[0], dias.at(-1)!);

  const linhas: string[][] = [];
  for (const c of calculos) {
    for (const d of c.dias) {
      if (d.foraDoPeriodo) continue;
      linhas.push([
        c.pessoa.nome,
        c.pessoa.documento ?? "",
        d.dia.split("-").reverse().join("/"),
        DIAS_DA_SEMANA[d.semana],
        d.marcacoes.filter((m) => !m.anulada).map((m) => relogio(m.minuto) + (m.origem === "MANUAL" ? "*" : "")).join(" "),
        horas(d.previsto),
        horas(d.trabalhado),
        horas(d.abonado),
        d.emAndamento ? "" : horas(d.saldo),
        horas(d.extras50),
        horas(d.extras100),
        horas(d.debito),
        d.ocorrencia ? NOME_DA_OCORRENCIA[d.ocorrencia] : "",
        d.alertas.join("; "),
      ]);
    }
  }

  const csv = montarCsv(
    ["Pessoa", "CPF", "Data", "Dia", "Marcações", "Previsto", "Trabalhado", "Abonado", "Saldo", "Extra 50%", "Extra 100%", "Atraso/falta", "Ocorrência", "Alertas"],
    linhas,
  );

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ponto-${slugify(company.name)}-${mes}.csv"`,
    },
  });
}
