import Link from "next/link";
import { notFound } from "next/navigation";
import { requireSession } from "@/lib/session";
import { formatMoment } from "@/lib/dates";
import { lerResultadoDisc } from "@/lib/disc";
import { lerResultadoCadastrado } from "@/lib/testes-cadastrados";
import { carregarPastaDoCandidato } from "@/lib/selecao-dados";
import { Etiqueta, Painel, TituloDaSecao, Vazio } from "@/components/ui";
import PrintButton from "@/components/print-button";
import FichaDoCandidato from "@/components/ficha-do-candidato";
import EntrevistaDoCandidato from "@/components/entrevista-do-candidato";
import EnviarFicha from "@/components/enviar-ficha";
import { ResultadoDoDisc, ResultadoDoTesteCadastrado } from "@/components/resultado-teste";
import CurriculoDoCandidato from "@/components/curriculo-do-candidato";
import ParecerFinal from "@/components/resultado-do-candidato";
import { BaixarPastaPdf, ImprimirAoAbrir } from "@/components/baixar-pasta-pdf";

export const dynamic = "force-dynamic";
// Organizar a entrevista chama a IA, que pode levar mais de um minuto.
export const maxDuration = 300;
export const metadata = { title: "Candidato — RH Resultados" };

const ABAS = [
  { valor: "curriculo", rotulo: "Currículo" },
  { valor: "ficha", rotulo: "Ficha" },
  { valor: "testes", rotulo: "Testes" },
  { valor: "entrevista", rotulo: "Entrevista" },
  { valor: "resultado", rotulo: "Resultado final" },
] as const;

type Aba = (typeof ABAS)[number]["valor"] | "tudo";

const SITUACAO: Record<string, { rotulo: string; tom: "azul" | "bom" | "ruim" | "neutro" }> = {
  EM_ANDAMENTO: { rotulo: "Em andamento", tom: "azul" },
  APROVADO: { rotulo: "Aprovado", tom: "bom" },
  REPROVADO: { rotulo: "Reprovado", tom: "ruim" },
  DESISTIU: { rotulo: "Desistiu", tom: "neutro" },
};

const MOVIMENTO: Record<string, string> = {
  ENTROU: "Entrou na etapa",
  APROVADO: "Aprovado na etapa",
  REPROVADO: "Reprovado",
  DESISTIU: "Desistiu",
};

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-micro text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";

/** O nome que o navegador sugere ao salvar o PDF: "Pasta - Maria da Silva - Recepcionista". */
function nomeDoPdf(candidato: string, vaga: string): string {
  return `Pasta - ${candidato} - ${vaga}`.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * A pasta do candidato dentro da vaga: a ficha que ele preencheu, os testes
 * que fez, a entrevista organizada pelas perguntas da vaga e o resultado final.
 * "Pasta inteira" junta tudo numa página só, para imprimir e mandar ao cliente.
 */
export default async function PastaDoCandidatoPage({
  params,
  searchParams,
}: {
  params: Promise<{ vagaId: string; candidatoId: string }>;
  searchParams: Promise<{ aba?: string; pdf?: string }>;
}) {
  await requireSession();
  const { vagaId, candidatoId } = await params;
  const { aba: abaPedida, pdf } = await searchParams;
  const c = await carregarPastaDoCandidato(vagaId, candidatoId);
  if (!c || !c.jobOpening) notFound();

  const aba: Aba = abaPedida === "tudo" || ABAS.some((a) => a.valor === abaPedida) ? (abaPedida as Aba) : c.curriculos.length > 0 && !c.ficha ? "curriculo" : "ficha";
  const vaga = c.jobOpening;
  const situacao = SITUACAO[c.outcome] ?? SITUACAO.EM_ANDAMENTO;
  const respondidos = c.testes.filter((t) => t.status === "RESPONDIDO").length;

  const contagem: Record<(typeof ABAS)[number]["valor"], string> = {
    curriculo: c.curriculos.length ? `${c.curriculos.length} PDF` : "nenhum",
    ficha: c.ficha ? "respondida" : c.applicationSentAt ? "esperando" : "não enviada",
    testes: c.testes.length ? `${respondidos} de ${c.testes.length}` : "nenhum",
    entrevista: c.entrevista ? "registrada" : "pendente",
    resultado: situacao.rotulo.toLowerCase(),
  };

  const curriculo = (
    <section className="space-y-2">
      {aba === "tudo" ? <h2 className="text-sm font-semibold text-brand-800">Currículo</h2> : null}
      <Painel>
        <CurriculoDoCandidato candidatoId={c.id} arquivos={c.curriculos} />
        {c.curriculos.length ? <p className="mt-1 hidden text-micro text-slate-500 print:block">O currículo é um PDF à parte, anexado no sistema.</p> : null}
      </Painel>
    </section>
  );

  const ficha = (
    <section className="space-y-2">
      {aba === "tudo" ? <h2 className="text-sm font-semibold text-brand-800">Ficha de solicitação de emprego</h2> : null}
      {c.ficha ? (
        <>
          <p className="text-micro text-slate-500">Respondida {formatMoment(c.applicationAnsweredAt)}</p>
          <FichaDoCandidato ficha={c.ficha} respondidaEm={c.applicationAnsweredAt} />
        </>
      ) : (
        <Vazio
          acao={
            c.outcome === "EM_ANDAMENTO" ? (
              <EnviarFicha
                candidatoId={c.id}
                nome={c.name}
                telefone={c.phone}
                vaga={vaga.title}
                enviada={Boolean(c.applicationSentAt)}
                className={`${botao} no-print`}
              />
            ) : null
          }
        >
          {c.applicationSentAt
            ? `Ficha enviada ${formatMoment(c.applicationSentAt)}. Ainda não foi respondida.`
            : "A ficha ainda não foi enviada a este candidato."}
        </Vazio>
      )}
    </section>
  );

  const testes = (
    <section className="space-y-2">
      {aba === "tudo" ? <h2 className="text-sm font-semibold text-brand-800">Testes</h2> : null}
      {c.testes.length === 0 ? (
        <Vazio>Nenhum teste foi mandado a este candidato. Os testes são enviados pelo cartão dele no quadro da vaga.</Vazio>
      ) : (
        c.testes.map((t) => {
          const disc = t.tipo === "DISC" ? lerResultadoDisc(t.resultado) : null;
          const cad = t.tipo !== "DISC" ? lerResultadoCadastrado(t.resultado) : null;
          return (
            <Painel
              key={t.id}
              titulo={t.nomeDoTeste}
              descricao={t.respondidoEm ? `Respondido ${formatMoment(t.respondidoEm)}` : `Enviado ${formatMoment(t.enviadoEm)} · esperando resposta`}
              acao={
                t.status === "RESPONDIDO" ? (
                  <Link href={`/testes/resultado/${t.id}`} className="no-print text-micro text-brand-700 hover:underline">
                    ver respostas
                  </Link>
                ) : null
              }
              className="break-inside-avoid"
            >
              {t.status !== "RESPONDIDO" ? (
                <p className="text-mini text-slate-500">O resultado aparece aqui quando o candidato responder.</p>
              ) : disc ? (
                <ResultadoDoDisc disc={disc} />
              ) : cad ? (
                <ResultadoDoTesteCadastrado r={cad} />
              ) : (
                <p className="text-mini text-slate-500">Resultado ilegível.</p>
              )}
            </Painel>
          );
        })
      )}
    </section>
  );

  const entrevista = (
    <section className="space-y-2">
      {aba === "tudo" ? <h2 className="text-sm font-semibold text-brand-800">Entrevista</h2> : null}
      <EntrevistaDoCandidato candidatoId={c.id} perguntas={c.perguntas} salva={c.entrevista} />
    </section>
  );

  const resultado = (
    <section className="space-y-2">
      {aba === "tudo" ? <h2 className="text-sm font-semibold text-brand-800">Resultado final</h2> : null}
      <Painel
        titulo="Situação"
        acao={<Etiqueta tom={situacao.tom}>{situacao.rotulo}</Etiqueta>}
        descricao={
          c.outcome === "EM_ANDAMENTO"
            ? `Ainda no processo${c.etapa ? `, na etapa ${c.etapa.nome}` : ""}. Aprovar, reprovar ou mover é pelo cartão no quadro da vaga.`
            : c.avisadoEm
              ? `Candidato avisado do resultado ${formatMoment(c.avisadoEm)}.`
              : "O candidato ainda não foi avisado do resultado."
        }
        className="break-inside-avoid"
      >
        {c.movimentos.length === 0 ? (
          <p className="text-mini text-slate-500">Nenhum passo registrado ainda.</p>
        ) : (
          <ol className="space-y-1.5">
            {c.movimentos.map((m) => (
              <li key={m.id} className="text-mini">
                <span className="text-slate-500">{formatMoment(m.criadoEm)} · </span>
                <span className="font-medium text-slate-800">{MOVIMENTO[m.resultado] ?? m.resultado}</span>
                <span className="text-slate-700"> · {m.etapaNome}</span>
                {m.motivo ? <p className="whitespace-pre-line text-slate-600">{m.motivo}</p> : null}
              </li>
            ))}
          </ol>
        )}
      </Painel>
      {c.anotacoes.length > 0 ? (
        <Painel titulo="Anotações das etapas" className="break-inside-avoid">
          <dl className="space-y-1.5">
            {c.anotacoes.map((a) => (
              <div key={a.etapa} className="text-mini">
                <dt className="font-medium text-slate-800">{a.etapa}</dt>
                <dd className="whitespace-pre-line text-slate-700">{a.texto}</dd>
              </div>
            ))}
          </dl>
        </Painel>
      ) : null}
      <ParecerFinal key={c.finalNotes ?? ""} candidatoId={c.id} salvo={c.finalNotes ?? ""} />
    </section>
  );

  return (
    <div className="space-y-3">
      <TituloDaSecao
        antes={`${vaga.company?.name ? `${vaga.company.name} · ` : ""}${vaga.title} ·`}
        destaque={c.name}
        acao={
          <span className="no-print flex items-center gap-3">
            <Link href={`/selecao/${vaga.id}`} className="text-micro text-slate-500 hover:text-brand-700">
              ← quadro da vaga
            </Link>
            <PrintButton />
            <BaixarPastaPdf candidato={c.name} vaga={vaga.title} />
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-2 text-micro text-slate-500">
        <Etiqueta tom={situacao.tom}>{situacao.rotulo}</Etiqueta>
        {c.etapa && c.outcome === "EM_ANDAMENTO" ? <span>na etapa {c.etapa.nome}</span> : null}
        {c.phone ? <span>· {c.phone}</span> : null}
        {c.email ? <span>· {c.email}</span> : null}
      </div>

      <nav className="no-print flex flex-wrap gap-1 border-b border-slate-200" aria-label="Partes da pasta">
        {ABAS.map((a) => (
          <Link
            key={a.valor}
            href={`?aba=${a.valor}`}
            aria-current={aba === a.valor ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-1.5 text-mini transition ${
              aba === a.valor ? "border-brand-600 font-medium text-brand-800" : "border-transparent text-slate-500 hover:text-brand-700"
            }`}
          >
            {a.rotulo} <span className="text-micro text-slate-400">· {contagem[a.valor]}</span>
          </Link>
        ))}
        <Link
          href="?aba=tudo"
          aria-current={aba === "tudo" ? "page" : undefined}
          className={`-mb-px ml-auto border-b-2 px-3 py-1.5 text-mini transition ${
            aba === "tudo" ? "border-brand-600 font-medium text-brand-800" : "border-transparent text-slate-500 hover:text-brand-700"
          }`}
        >
          Pasta inteira
        </Link>
      </nav>

      {aba === "curriculo" ? curriculo : null}
      {aba === "ficha" ? ficha : null}
      {aba === "testes" ? testes : null}
      {aba === "entrevista" ? entrevista : null}
      {aba === "resultado" ? resultado : null}
      {aba === "tudo" ? (
        <div className="space-y-5">
          {pdf === "1" ? <ImprimirAoAbrir nomeDoArquivo={nomeDoPdf(c.name, vaga.title)} /> : null}
          {curriculo}
          {ficha}
          {testes}
          {entrevista}
          {resultado}
        </div>
      ) : null}
    </div>
  );
}
