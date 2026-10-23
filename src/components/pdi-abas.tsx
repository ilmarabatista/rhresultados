import Link from "next/link";

/** As abas do PDI. As descrições de cargo moram na aba Cargos; aqui fica o atalho. */
export default function PdiAbas({
  companyId,
  atual,
  cargosSemDescricao = 0,
}: {
  companyId: string;
  atual: "equipe" | "autoavaliacoes";
  cargosSemDescricao?: number;
}) {
  const abas = [
    { slug: "equipe", rotulo: "Equipe", href: `/empresas/${companyId}/pdi` },
    { slug: "autoavaliacoes", rotulo: "Autoavaliações", href: `/empresas/${companyId}/pdi/autoavaliacoes` },
    { slug: "cargos", rotulo: "Descrições de cargo", href: `/empresas/${companyId}/cargos` },
  ] as const;
  return (
    <nav className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {abas.map((a) => (
        <Link
          key={a.slug}
          href={a.href}
          className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
            atual === a.slug
              ? "border-brand-600 font-semibold text-brand-800"
              : "border-transparent text-slate-500 hover:text-slate-800"
          }`}
        >
          {a.rotulo}
          {a.slug === "cargos" && cargosSemDescricao > 0 ? (
            <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-micro font-medium text-amber-800">
              {cargosSemDescricao}
            </span>
          ) : null}
        </Link>
      ))}
    </nav>
  );
}
