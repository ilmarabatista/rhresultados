"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { metaDoMapeamento } from "@/app/(app)/empresas/[id]/equipe/mapeamento-actions";
import { avisarSeErro } from "@/components/avisos";
import type { MetaSugerida } from "@/lib/mapeamento";

/**
 * As sugestões de meta que vêm do mapeamento de rotinas mais recente: pontos
 * de atenção, próximos passos e gargalos. Cada uma entra no plano em andamento
 * com um clique e se ajusta lá como qualquer meta.
 */
export default function PdiMapeamento({
  href,
  data,
  sugestoes,
  planId,
  jaNoPlano,
}: {
  href: string;
  data: string;
  sugestoes: MetaSugerida[];
  planId: string | null;
  jaNoPlano: string[];
}) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const ja = new Set(jaNoPlano);

  function adicionar(s: MetaSugerida) {
    if (!planId) return;
    start(async () => {
      const r = await metaDoMapeamento(planId, s.titulo, s.origem);
      avisarSeErro(r);
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sugestões do mapeamento de rotinas</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Da entrevista de {data}.{" "}
            {planId ? "Cada uma entra no plano em andamento como meta, para você completar." : "Crie um plano para usar as sugestões como metas."}
          </p>
        </div>
        <Link href={href} className="text-xs text-brand-700 hover:text-brand-800">
          Abrir o mapeamento ›
        </Link>
      </div>
      {sugestoes.length ? (
        <ul className="divide-y divide-slate-100 text-sm">
          {sugestoes.map((s, i) => (
            <li key={i} className="flex items-start justify-between gap-3 py-2">
              <span>
                <span className="mr-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-micro text-slate-600">{s.origem}</span>
                {s.titulo}
              </span>
              {ja.has(s.titulo) ? (
                <span className="shrink-0 text-xs text-emerald-700">No plano</span>
              ) : planId ? (
                <button
                  type="button"
                  disabled={pendente}
                  onClick={() => adicionar(s)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                >
                  <Plus size={12} /> Meta
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">
          O mapeamento ainda não tem pontos de atenção, próximos passos ou gargalos.
        </p>
      )}
    </section>
  );
}
