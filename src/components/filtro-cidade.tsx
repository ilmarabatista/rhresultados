import Link from "next/link";

export type Cidade = { id: string; nome: string; pessoas: number };

/** Valor do filtro para quem não tem unidade no cadastro. */
export const SEM_CIDADE = "sem";

/**
 * As cidades (unidades) da empresa como botões, para ver o PDI de uma cidade
 * só. Só aparece quando a empresa tem mais de uma unidade.
 */
export default function FiltroCidade({
  base,
  cidades,
  atual,
  total,
  semCidade,
}: {
  /** O endereço da página, sem o ?cidade=. */
  base: string;
  cidades: Cidade[];
  /** O id da unidade escolhida, "sem" ou null para todas. */
  atual: string | null;
  total: number;
  semCidade: number;
}) {
  if (cidades.length < 2) return null;
  const opcoes = [
    { valor: null as string | null, rotulo: "Todas", pessoas: total },
    ...cidades.map((c) => ({ valor: c.id as string | null, rotulo: c.nome, pessoas: c.pessoas })),
    ...(semCidade > 0 ? [{ valor: SEM_CIDADE as string | null, rotulo: "Sem cidade", pessoas: semCidade }] : []),
  ];
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-micro font-medium uppercase tracking-wider text-slate-500">Cidade</span>
      {opcoes.map((o) => {
        const ativo = (atual ?? null) === o.valor;
        return (
          <Link
            key={o.valor ?? "todas"}
            href={o.valor ? `${base}?cidade=${encodeURIComponent(o.valor)}` : base}
            className={`rounded-full border px-2.5 py-0.5 text-mini transition ${
              ativo
                ? "border-brand-600 bg-brand-600 font-medium text-white"
                : o.valor === SEM_CIDADE
                  ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300"
                  : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"
            }`}
          >
            {o.rotulo} <span className={ativo ? "text-white/80" : "text-slate-400"}>{o.pessoas}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Conta as pessoas por unidade e diz se a escolhida existe. */
export function cidadesDaEquipe(
  unidades: { id: string; name: string }[],
  pessoas: { branchId: string | null }[],
  escolhida: string | undefined,
) {
  const cidades: Cidade[] = unidades.map((u) => ({
    id: u.id,
    nome: u.name,
    pessoas: pessoas.filter((p) => p.branchId === u.id).length,
  }));
  const ids = new Set(unidades.map((u) => u.id));
  const semCidade = pessoas.filter((p) => !p.branchId || !ids.has(p.branchId)).length;
  const atual = escolhida === SEM_CIDADE || (escolhida && ids.has(escolhida)) ? escolhida : null;
  const naCidade = (branchId: string | null) =>
    atual == null ? true : atual === SEM_CIDADE ? !branchId || !ids.has(branchId) : branchId === atual;
  return { cidades, semCidade, atual, naCidade };
}
