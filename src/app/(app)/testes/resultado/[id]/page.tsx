import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatMoment } from "@/lib/dates";
import { LETRAS, lerResultadoDisc, QUESTOES_DISC } from "@/lib/disc";
import { lerResultadoCadastrado, lerTesteCadastrado } from "@/lib/testes-cadastrados";
import { Painel } from "@/components/ui";
import PrintButton from "@/components/print-button";
import { ResultadoDoDisc, ResultadoDoTesteCadastrado } from "@/components/resultado-teste";

export const dynamic = "force-dynamic";
export const metadata = { title: "Resultado do teste — RH Resultados" };

/** O resultado de um teste respondido, com as respostas questão a questão. */
export default async function ResultadoDoTestePage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const e = await prisma.testeEnviado.findUnique({
    where: { id },
    include: { company: { select: { name: true } } },
  });
  if (!e) notFound();

  const respostas = Array.isArray(e.respostas) ? (e.respostas as unknown[]) : [];
  const disc = e.tipo === "DISC" ? lerResultadoDisc(e.resultado) : null;
  const cad = e.tipo !== "DISC" ? lerResultadoCadastrado(e.resultado) : null;
  const teste = e.tipo !== "DISC" ? lerTesteCadastrado(e.estrutura) : null;

  return (
    <main className="mx-auto max-w-4xl space-y-3.5 px-4 py-5 sm:px-6">
      <div className="no-print flex items-center justify-between gap-2">
        <Link href="/testes" className="text-xs text-slate-500 transition hover:text-brand-700">
          ‹ Testes
        </Link>
        <PrintButton />
      </div>

      <header>
        <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{e.nomeDoTeste}</p>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{e.pessoa}</h1>
        <p className="text-xs text-slate-500">
          {[e.company?.name, `enviado ${formatMoment(e.enviadoEm)}`, e.respondidoEm ? `respondido ${formatMoment(e.respondidoEm)}` : "ainda não respondido"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      {e.status !== "RESPONDIDO" ? (
        <Painel>
          <p className="text-sm text-slate-500">A pessoa ainda não respondeu. O resultado aparece aqui assim que ela enviar.</p>
        </Painel>
      ) : (
        <>
          <Painel titulo="Resultado">
            {disc ? <ResultadoDoDisc disc={disc} /> : cad ? <ResultadoDoTesteCadastrado r={cad} /> : <p className="text-sm text-slate-500">Resultado ilegível.</p>}
          </Painel>

          <Painel titulo="Respostas" descricao={e.tipo === "DISC" ? "A nota que a pessoa deu a cada opção: 4 é a que mais tem a ver com ela, 1 a que menos." : undefined}>
            <ol className="space-y-2.5 text-[12px]">
              {e.tipo === "DISC"
                ? QUESTOES_DISC.map((q, i) => {
                    const notas = Array.isArray(respostas[i]) ? (respostas[i] as number[]) : [];
                    return (
                      <li key={i} className="break-inside-avoid">
                        <p className="font-medium text-slate-800">
                          {i + 1}. {q.enunciado}
                        </p>
                        <ul className="mt-0.5 grid gap-x-4 sm:grid-cols-2">
                          {q.opcoes.map((o, j) => (
                            <li key={j} className="flex gap-2 text-slate-600">
                              <span className={`w-5 shrink-0 text-right font-semibold tabular-nums ${notas[j] === 4 ? "text-brand-700" : "text-slate-400"}`}>
                                {notas[j] ?? "—"}
                              </span>
                              <span>
                                {LETRAS[j]}. {o.texto} <span className="text-slate-400">({o.fator})</span>
                              </span>
                            </li>
                          ))}
                        </ul>
                      </li>
                    );
                  })
                : teste?.questoes.map((q, i) => {
                    const r = respostas[i];
                    return (
                      <li key={i} className="break-inside-avoid">
                        <p className="whitespace-pre-line font-medium text-slate-800">
                          {i + 1}. {q.enunciado}
                        </p>
                        <ul className="mt-0.5 space-y-0.5">
                          {q.opcoes.map((o, j) => {
                            const escolhida = typeof r === "number" && r === j;
                            const nota = Array.isArray(r) ? (r as number[])[j] : null;
                            return (
                              <li key={j} className={`flex gap-2 ${escolhida ? "font-medium text-brand-800" : "text-slate-600"}`}>
                                <span className="w-5 shrink-0 text-right tabular-nums text-slate-400">
                                  {teste.modo === "NOTAS" ? (nota ?? "—") : escolhida ? "✓" : ""}
                                </span>
                                <span>
                                  {String.fromCharCode(65 + j)}) {o.texto} <span className="text-slate-400">[{o.fator}]</span>
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      </li>
                    );
                  })}
            </ol>
          </Painel>
        </>
      )}
    </main>
  );
}
