import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";
import type { DadosDoRelatorio } from "@/lib/relatorio";
import { EspelhoDoRelatorio } from "@/components/espelho";
import { BotaoEnviar } from "@/components/formularios";
import { Topo } from "@/components/ui";
import { darCiencia } from "../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Relatório — Ponto" };

const FORMATO = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function RelatorioPage({ params }: { params: Promise<{ mes: string }> }) {
  const s = await exigirColaborador();
  const { mes } = await params;
  if (!/^\d{4}-\d{2}$/.test(mes)) notFound();
  const r = await prisma.relatorio.findUnique({ where: { colaboradorId_mes: { colaboradorId: s.id, mes } } });
  if (!r) notFound();

  return (
    <>
      <div className="print:hidden">
        <Topo titulo="Ponto" nome={s.nome} links={[{ href: "/", rotulo: "Registrar" }, { href: "/relatorios", rotulo: "Relatórios" }]} />
      </div>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 print:p-0">
        <EspelhoDoRelatorio d={r.dados as unknown as DadosDoRelatorio} />
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          {r.cienteEm ? (
            <p className="text-sm text-emerald-800">Você conferiu este relatório em {FORMATO.format(r.cienteEm)}.</p>
          ) : (
            <form action={darCiencia.bind(null, mes)}>
              <BotaoEnviar pendente="Confirmando…">Conferi e estou ciente</BotaoEnviar>
            </form>
          )}
          <p className="text-xs text-slate-500">
            Enviado pelo RH em {FORMATO.format(r.enviadoEm)}. Se algo estiver errado, fale com o RH antes de confirmar.
          </p>
        </div>
      </main>
    </>
  );
}
