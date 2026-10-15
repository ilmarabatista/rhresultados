"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FICHA_TABS } from "@/lib/nav";

/**
 * As seções da ficha do cliente, na coluna da esquerda.
 *
 * Eram uma tira horizontal no alto. Passaram de dez, e a tira começou a cortar
 * o nome da última — coluna tem espaço para crescer, tira não tem. No celular
 * a coluna empurrava o conteúdo para baixo, então lá elas voltam a ser uma
 * tira, que rola para o lado.
 */
export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const base = `/empresas/${companyId}`;

  return (
    <nav
      aria-label="Seções da empresa"
      className="scroll-thin flex overflow-x-auto rounded-lg border border-slate-200 bg-white lg:block lg:overflow-hidden"
    >
      {FICHA_TABS.map((tab) => {
        const href = `${base}/${tab.slug}`;
        const ativa = pathname.startsWith(href);

        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={ativa ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-micro leading-tight transition lg:border-b-0 lg:border-l-2 lg:px-2.5 lg:py-1.5 ${
              ativa
                ? "border-brand-600 bg-brand-50/60 font-semibold text-brand-800"
                : "border-transparent text-slate-600 hover:bg-slate-50 hover:text-brand-700"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
