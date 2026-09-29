"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FICHA_TABS } from "@/lib/nav";

/**
 * As seções da ficha do cliente, na coluna da esquerda.
 *
 * Eram uma tira horizontal no alto. Passaram de dez, e a tira começou a cortar
 * o nome da última — coluna tem espaço para crescer, tira não tem.
 */
export default function CompanyTabs({ companyId }: { companyId: string }) {
  const pathname = usePathname();
  const base = `/empresas/${companyId}`;

  return (
    <nav className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      {FICHA_TABS.map((tab) => {
        const href = `${base}/${tab.slug}`;
        const ativa = pathname.startsWith(href);

        return (
          <Link
            key={tab.slug}
            href={href}
            aria-current={ativa ? "page" : undefined}
            className={`flex items-center gap-2 border-l-2 px-2.5 py-1.5 text-[11px] leading-tight transition ${
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
