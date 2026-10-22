import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate } from "@/lib/dates";
import { lerTipoDeCompetencia, TIPOS_DE_COMPETENCIA, type TipoDeCompetencia } from "@/lib/pdi";
import { CAMPOS_DA_ESPECIFICACAO, lerEspecificacao, lerNivelDeCargo, lerResponsabilidades, ROTULO_DO_NIVEL_DE_CARGO } from "@/lib/cargos";
import PrintButton from "@/components/print-button";

export const dynamic = "force-dynamic";
export const metadata = { title: "Descrição de cargo — RH Resultados" };

const TITULO_DO_TIPO: Record<TipoDeCompetencia, string> = {
  TECNICA: "Competências técnicas",
  COMPORTAMENTAL: "Competências comportamentais",
  ORGANIZACIONAL: "Competências organizacionais",
};

/** A descrição do cargo em uma folha, para entregar ao cliente ou anexar ao PDI. */
export default async function ImprimirCargoPage({ params }: { params: Promise<{ id: string; cargoId: string }> }) {
  await requireSession();
  const { id, cargoId } = await params;

  const cargo = await prisma.cargo.findFirst({
    where: { id: cargoId, companyId: id },
    include: {
      company: { select: { name: true } },
      competencias: { orderBy: [{ ordem: "asc" }, { nome: "asc" }] },
    },
  });
  if (!cargo) notFound();

  const nivel = lerNivelDeCargo(cargo.nivel);
  const responsabilidades = lerResponsabilidades(cargo.responsabilidades);
  const especificacao = lerEspecificacao(cargo.especificacao);
  const condicoes = CAMPOS_DA_ESPECIFICACAO.filter(({ chave }) => especificacao[chave]);
  const identificacao = [
    ["Setor", cargo.setor],
    ["Nível", nivel ? ROTULO_DO_NIVEL_DE_CARGO[nivel] : null],
    ["CBO", cargo.cbo],
    ["Reporta-se a", cargo.superior],
    ["Cargos subordinados", cargo.subordinados],
  ].filter(([, v]) => v);

  return (
    <main className="mx-auto max-w-4xl space-y-5 bg-white p-6 text-slate-800 print:p-0">
      <div className="no-print flex items-center justify-between">
        <Link href={`/empresas/${id}/cargos?cargo=${cargo.id}`} className="text-sm text-slate-500 hover:text-slate-900">
          ← Voltar ao cargo
        </Link>
        <PrintButton />
      </div>

      <header className="border-b-2 border-brand-900 pb-3">
        <p className="text-micro uppercase tracking-wider text-slate-500">Descrição de cargo · {cargo.company.name}</p>
        <h1 className="mt-1 text-xl font-semibold">{cargo.nome}</h1>
        {identificacao.length ? (
          <p className="mt-1 text-sm text-slate-600">{identificacao.map(([r, v]) => `${r}: ${v}`).join(" · ")}</p>
        ) : null}
        <p className="mt-1 text-micro text-slate-500">
          {cargo.aprovadaEm ? `Aprovada em ${formatFullDate(cargo.aprovadaEm)}` : "Rascunho, ainda não aprovada"}
        </p>
      </header>

      {cargo.missao ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-800">Missão</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{cargo.missao}</p>
        </section>
      ) : null}

      {responsabilidades.length ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-800">Responsabilidades</h2>
          <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed">
            {responsabilidades.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ol>
        </section>
      ) : null}

      {TIPOS_DE_COMPETENCIA.map((tipo) => {
        const lista = cargo.competencias.filter((c) => lerTipoDeCompetencia(c.tipo) === tipo);
        if (!lista.length) return null;
        return (
          <section key={tipo} className="break-inside-avoid">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-800">{TITULO_DO_TIPO[tipo]}</h2>
            <table className="w-full border-collapse text-mini">
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className="w-1/3 border border-slate-200 px-2 py-1 align-top font-medium">{c.nome}</td>
                    <td className="border border-slate-200 px-2 py-1 align-top text-slate-600">{c.descricao}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        );
      })}

      {cargo.requisitos ? (
        <section>
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-800">Requisitos</h2>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{cargo.requisitos}</p>
        </section>
      ) : null}

      {condicoes.length ? (
        <section className="break-inside-avoid">
          <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-brand-800">Condições do cargo</h2>
          <dl className="grid gap-x-4 gap-y-2 text-mini sm:grid-cols-2">
            {condicoes.map(({ chave, rotulo }) => (
              <div key={chave}>
                <dt className="font-semibold">{rotulo}</dt>
                <dd className="whitespace-pre-wrap text-slate-600">{especificacao[chave]}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
    </main>
  );
}
