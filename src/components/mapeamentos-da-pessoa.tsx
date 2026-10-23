"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClipboardList, Plus, Send } from "lucide-react";
import { criarMapeamento } from "@/app/(app)/empresas/[id]/equipe/mapeamento-actions";
import { ROTULO_DO_STATUS, type StatusDoMapeamento } from "@/lib/mapeamento";
import { avisarSeErro } from "@/components/avisos";
import { Etiqueta } from "./ui";
import BotoesDoLink from "./mapeamento-link";

/**
 * Os mapeamentos de rotinas da pessoa, no cadastro dela: o link para ela
 * mesma preencher, ou a entrevista feita pelo RH, com a situação de cada um.
 */

const TOM: Record<StatusDoMapeamento, "neutro" | "atencao" | "bom"> = {
  RASCUNHO: "neutro",
  ENVIADO: "atencao",
  RESPONDIDO: "bom",
};

export default function MapeamentosDaPessoa({
  companyId,
  employeeId,
  nome,
  telefone,
  mapeamentos,
}: {
  companyId: string;
  employeeId: string;
  nome: string;
  telefone: string | null;
  mapeamentos: {
    id: string;
    data: string;
    entrevistador: string | null;
    versao: string;
    tarefas: number;
    passos: number;
    status: StatusDoMapeamento;
    token: string | null;
    respondidoEm: string | null;
  }[];
}) {
  const router = useRouter();
  const [criando, startCriar] = useTransition();

  function novo(porLink: boolean) {
    startCriar(async () => {
      const r = await criarMapeamento(employeeId, porLink);
      avisarSeErro(r);
      if (!r.id) return;
      if (porLink) router.refresh();
      else router.push(`/empresas/${companyId}/equipe/${employeeId}/mapeamento/${r.id}`);
    });
  }

  const href = (id: string) => `/empresas/${companyId}/equipe/${employeeId}/mapeamento/${id}`;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">
            <ClipboardList size={15} /> Mapeamento de rotinas
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            A pessoa conta pelo link o que faz no dia a dia. Dele saem os itens da autoavaliação da função e sugestões de meta
            do PDI.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={criando}
            onClick={() => novo(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            <Send size={14} /> {criando ? "Gerando…" : "Gerar link para a pessoa"}
          </button>
          <button
            type="button"
            disabled={criando}
            onClick={() => novo(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <Plus size={14} /> Preencher na entrevista
          </button>
        </div>
      </div>
      {mapeamentos.length ? (
        <ul className="divide-y divide-slate-100">
          {mapeamentos.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
              <Link href={href(m.id)} className="min-w-0 font-medium transition hover:text-brand-700">
                {m.status === "RASCUNHO" ? `Entrevista de ${m.data}` : `Link de ${m.data}`}
                {m.entrevistador && m.status === "RASCUNHO" ? (
                  <span className="font-normal text-slate-500"> · por {m.entrevistador}</span>
                ) : null}
                {m.respondidoEm ? <span className="font-normal text-slate-500"> · respondido em {m.respondidoEm}</span> : null}
              </Link>
              <span className="flex flex-wrap items-center gap-2">
                <Etiqueta tom={TOM[m.status]}>{ROTULO_DO_STATUS[m.status]}</Etiqueta>
                {m.status === "ENVIADO" && m.token ? (
                  <BotoesDoLink token={m.token} nome={nome} telefone={telefone} />
                ) : (
                  <span className="text-xs text-slate-500">
                    {m.tarefas} tarefa(s) · {m.passos} passo(s)
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-slate-500">Nenhum mapeamento ainda.</p>
      )}
    </section>
  );
}
