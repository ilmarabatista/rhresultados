"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus } from "lucide-react";
import { criarMapeamento } from "@/app/(app)/empresas/[id]/equipe/mapeamento-actions";
import { avisarSeErro } from "@/components/avisos";

/**
 * Os mapeamentos de rotinas da pessoa, no cadastro dela: cada entrevista com
 * a data e quanto já foi preenchido, e o botão de começar uma nova.
 */
export default function MapeamentosDaPessoa({
  companyId,
  employeeId,
  mapeamentos,
}: {
  companyId: string;
  employeeId: string;
  mapeamentos: { id: string; data: string; entrevistador: string | null; versao: string; tarefas: number; passos: number }[];
}) {
  const router = useRouter();
  const [criando, startCriar] = useTransition();

  function novo() {
    startCriar(async () => {
      const r = await criarMapeamento(employeeId);
      avisarSeErro(r);
      if (r.id) router.push(`/empresas/${companyId}/equipe/${employeeId}/mapeamento/${r.id}`);
    });
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ClipboardList size={15} /> Mapeamento de rotinas
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            A entrevista sobre o que a pessoa faz. Dela saem os itens da autoavaliação da função e sugestões de meta do PDI.
          </p>
        </div>
        <button
          type="button"
          disabled={criando}
          onClick={novo}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          <Plus size={14} /> {criando ? "Abrindo…" : "Novo mapeamento"}
        </button>
      </div>
      {mapeamentos.length ? (
        <ul className="divide-y divide-slate-100">
          {mapeamentos.map((m) => (
            <li key={m.id}>
              <Link
                href={`/empresas/${companyId}/equipe/${employeeId}/mapeamento/${m.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm transition hover:text-brand-700"
              >
                <span className="font-medium">
                  Entrevista de {m.data}
                  {m.entrevistador ? <span className="font-normal text-slate-500"> · por {m.entrevistador}</span> : null}
                </span>
                <span className="text-xs text-slate-500">
                  v{m.versao} · {m.tarefas} tarefa(s) · {m.passos} passo(s)
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Nenhum mapeamento ainda.</p>
      )}
    </section>
  );
}
