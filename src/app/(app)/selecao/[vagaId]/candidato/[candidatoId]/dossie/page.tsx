import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { formatMoment } from "@/lib/dates";
import { lerResultadoDisc } from "@/lib/disc";
import { lerResultadoCadastrado } from "@/lib/testes-cadastrados";
import { semResposta } from "@/lib/entrevista";
import { carregarPastaDoCandidato } from "@/lib/selecao-dados";
import FichaDoCandidato from "@/components/ficha-do-candidato";
import PaginasDoCurriculo from "@/components/paginas-do-curriculo";
import { ResultadoDoDisc, ResultadoDoTesteCadastrado } from "@/components/resultado-teste";
import PrintButton from "@/components/print-button";
import { ImprimirAoAbrir } from "@/components/baixar-pasta-pdf";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dossiê do candidato — RH Resultados" };

/**
 * O dossiê do candidato: a pasta arrumada para entregar ao cliente, que a
 * gestão lê para decidir. Capa, currículo, ficha, testes, entrevista e o
 * parecer final da consultoria. Fica de fora tudo o que é da tela: botões,
 * instruções, a avaliação automática, as medidas da redação e qualquer
 * menção à IA.
 *
 * Na impressão, a margem da folha é zero para o navegador não pôr título,
 * endereço e hora no alto e no pé; o cabeçalho e o rodapé da tabela se
 * repetem em cada folha e fazem as vezes de margem.
 */

/** O nome que o navegador sugere ao salvar o PDF: "Dossiê - Maria da Silva - Recepcionista". */
function nomeDoPdf(candidato: string, vaga: string): string {
  return `Dossiê - ${candidato} - ${vaga}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

const IMPRESSAO = `
@media print {
  @page { size: A4; margin: 0; }
  html, body { background: #fff !important; }
  .dossie { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
}
`;

function Secao({ numero, titulo, children, primeira }: { numero: number; titulo: string; children: React.ReactNode; primeira?: boolean }) {
  return (
    <section className={`space-y-3 ${primeira ? "" : "break-before-page"} pt-6 print:pt-0`}>
      <div className="flex items-baseline gap-3 border-b-2 border-brand-700 pb-1.5">
        <span className="text-2xl font-light tabular-nums text-brand-300">{String(numero).padStart(2, "0")}</span>
        <h2 className="text-lg font-semibold tracking-tight text-brand-900">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

export default async function DossiePage({
  params,
  searchParams,
}: {
  params: Promise<{ vagaId: string; candidatoId: string }>;
  searchParams: Promise<{ pdf?: string }>;
}) {
  await requireSession();
  const { vagaId, candidatoId } = await params;
  const { pdf } = await searchParams;
  const c = await carregarPastaDoCandidato(vagaId, candidatoId);
  if (!c || !c.jobOpening) notFound();

  const vaga = c.jobOpening;
  const empresa = vaga.company?.name ?? null;
  const nome = c.ficha?.pessoal.nome || c.name;

  // O mesmo arquivo anexado duas vezes entra uma vez só.
  const vistos = new Set<string>();
  const curriculos = c.curriculos.filter((a) => {
    const chave = `${a.nome}|${a.tamanho}`;
    if (vistos.has(chave)) return false;
    vistos.add(chave);
    return true;
  });
  const testes = c.testes.filter((t) => t.status === "RESPONDIDO");
  const respostas = (c.entrevista?.respostas ?? []).filter((r) => !semResposta(r.resposta));
  const outrosPontos = c.entrevista?.outros.trim() ?? "";
  const avaliacaoDaEntrevista = c.entrevista?.avaliacao.trim() ?? "";
  const temEntrevista = respostas.length > 0 || outrosPontos !== "" || avaliacaoDaEntrevista !== "";
  const parecer = c.finalNotes?.trim() ?? "";

  const secoes = [
    curriculos.length > 0 ? "Currículo" : null,
    c.ficha ? "Ficha de solicitação de emprego" : null,
    testes.length > 0 ? "Testes" : null,
    temEntrevista ? "Entrevista" : null,
    parecer ? "Parecer final" : null,
  ].filter((s): s is string => s !== null);
  const numero = (s: string) => secoes.indexOf(s) + 1;

  return (
    <div className="dossie min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style>{IMPRESSAO}</style>
      {pdf === "1" ? <ImprimirAoAbrir nomeDoArquivo={nomeDoPdf(nome, vaga.title)} /> : null}

      <div className="no-print mx-auto mb-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4">
        <Link href={`/selecao/${vaga.id}/candidato/${c.id}`} className="text-micro text-slate-500 hover:text-brand-700">
          ← voltar à pasta
        </Link>
        <span className="flex items-center gap-3">
          <span className="text-micro text-slate-500">É assim que o cliente recebe. Para salvar, escolha &ldquo;Salvar como PDF&rdquo;.</span>
          <PrintButton />
        </span>
      </div>

      {/* Capa */}
      <div className="mx-auto flex max-w-[210mm] flex-col bg-white shadow-sm print:h-[293mm] print:max-w-none print:overflow-hidden print:shadow-none">
        <div className="bg-brand-900 px-[18mm] py-8 text-white">
          <p className="text-xl font-semibold tracking-tight">RH Resultados</p>
          <p className="mt-0.5 text-micro uppercase tracking-[0.2em] text-brand-200">Recrutamento e seleção</p>
        </div>
        <div className="flex flex-1 flex-col justify-center px-[18mm] py-16">
          <p className="text-micro font-semibold uppercase tracking-[0.25em] text-brand-600">Dossiê do candidato</p>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight text-brand-950">{nome}</h1>
          <div className="mt-6 h-1 w-16 bg-brand-500" />
          <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 text-sm">
            <div>
              <dt className="text-micro uppercase tracking-wider text-slate-500">Vaga</dt>
              <dd className="mt-0.5 font-medium text-slate-900">{vaga.title}</dd>
            </div>
            {empresa ? (
              <div>
                <dt className="text-micro uppercase tracking-wider text-slate-500">Empresa</dt>
                <dd className="mt-0.5 font-medium text-slate-900">{empresa}</dd>
              </div>
            ) : null}
          </dl>
          {secoes.length > 0 ? (
            <ol className="mt-12 space-y-2 border-l-2 border-brand-100 pl-5">
              {secoes.map((s, i) => (
                <li key={s} className="flex items-baseline gap-3 text-sm text-slate-700">
                  <span className="w-6 tabular-nums text-brand-400">{String(i + 1).padStart(2, "0")}</span>
                  {s}
                </li>
              ))}
            </ol>
          ) : null}
        </div>
        <div className="flex items-end justify-between gap-4 border-t border-slate-200 px-[18mm] py-6 text-micro text-slate-500">
          <span>
            Documento confidencial{empresa ? `, para uso da ${empresa}` : ""} neste processo seletivo.
          </span>
          <span className="shrink-0">Emitido em {formatMoment(new Date())}</span>
        </div>
      </div>

      {secoes.length > 0 ? (
        <table className="mx-auto mt-6 w-full max-w-[210mm] break-before-page border-collapse bg-white shadow-sm print:mt-0 print:max-w-none print:shadow-none">
          <thead>
            <tr>
              <td className="px-[18mm] pb-5 pt-[10mm]">
                <div className="flex items-baseline justify-between border-b border-slate-200 pb-1.5 text-micro text-slate-500">
                  <span className="font-semibold text-brand-800">RH Resultados</span>
                  <span>
                    {nome} · {vaga.title}
                    {empresa ? ` · ${empresa}` : ""}
                  </span>
                </div>
              </td>
            </tr>
          </thead>
          <tfoot>
            <tr>
              <td className="px-[18mm] pb-[9mm] pt-4">
                <div className="border-t border-slate-200 pt-1.5 text-center text-micro text-slate-400">Documento confidencial · RH Resultados</div>
              </td>
            </tr>
          </tfoot>
          <tbody>
            <tr>
              <td className="px-[18mm] align-top">
                <div className="space-y-8 print:space-y-0">
                  {curriculos.length > 0 ? (
                    <Secao numero={numero("Currículo")} titulo="Currículo" primeira={numero("Currículo") === 1}>
                      <PaginasDoCurriculo arquivos={curriculos} quebrarAntes={false} className="space-y-3" />
                    </Secao>
                  ) : null}

                  {c.ficha ? (
                    <Secao numero={numero("Ficha de solicitação de emprego")} titulo="Ficha de solicitação de emprego" primeira={numero("Ficha de solicitação de emprego") === 1}>
                      {c.applicationAnsweredAt ? <p className="text-micro text-slate-500">Preenchida em {formatMoment(c.applicationAnsweredAt)}</p> : null}
                      <FichaDoCandidato ficha={c.ficha} respondidaEm={c.applicationAnsweredAt} />
                    </Secao>
                  ) : null}

                  {testes.length > 0 ? (
                    <Secao numero={numero("Testes")} titulo="Testes" primeira={numero("Testes") === 1}>
                      {testes.map((t) => {
                        const disc = t.tipo === "DISC" ? lerResultadoDisc(t.resultado) : null;
                        const cad = t.tipo !== "DISC" ? lerResultadoCadastrado(t.resultado) : null;
                        if (!disc && !cad) return null;
                        return (
                          <div key={t.id} className="break-inside-avoid space-y-2 rounded-lg border border-slate-200 p-3 print:rounded-none print:border-slate-300">
                            <p className="flex items-baseline justify-between gap-2">
                              <span className="text-sm font-semibold text-slate-900">{t.nomeDoTeste}</span>
                              {t.respondidoEm ? <span className="text-micro text-slate-500">Respondido em {formatMoment(t.respondidoEm)}</span> : null}
                            </p>
                            {disc ? <ResultadoDoDisc disc={disc} /> : cad ? <ResultadoDoTesteCadastrado r={cad} /> : null}
                          </div>
                        );
                      })}
                    </Secao>
                  ) : null}

                  {temEntrevista ? (
                    <Secao numero={numero("Entrevista")} titulo="Entrevista" primeira={numero("Entrevista") === 1}>
                      {respostas.length > 0 ? (
                        <ol className="space-y-3">
                          {respostas.map((r, i) => (
                            <li key={i} className="break-inside-avoid">
                              <p className="text-mini font-semibold text-slate-900">
                                {i + 1}. {r.pergunta}
                              </p>
                              <p className="mt-0.5 whitespace-pre-line text-mini leading-relaxed text-slate-700">{r.resposta}</p>
                            </li>
                          ))}
                        </ol>
                      ) : null}
                      {outrosPontos ? (
                        <div className="break-inside-avoid">
                          <h3 className="text-mini font-semibold text-brand-800">Outros pontos da conversa</h3>
                          <p className="mt-0.5 whitespace-pre-line text-mini leading-relaxed text-slate-700">{outrosPontos}</p>
                        </div>
                      ) : null}
                      {avaliacaoDaEntrevista ? (
                        <div className="break-inside-avoid rounded-lg bg-brand-50 p-3 print:rounded-none">
                          <h3 className="text-mini font-semibold text-brand-800">Avaliação da entrevista</h3>
                          <p className="mt-0.5 whitespace-pre-line text-mini leading-relaxed text-slate-800">{avaliacaoDaEntrevista}</p>
                        </div>
                      ) : null}
                    </Secao>
                  ) : null}

                  {parecer ? (
                    <Secao numero={numero("Parecer final")} titulo="Parecer final" primeira={numero("Parecer final") === 1}>
                      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{parecer}</p>
                    </Secao>
                  ) : null}
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </div>
  );
}
