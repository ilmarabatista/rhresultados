"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Plus, X } from "lucide-react";
import {
  adicionarEtapaDeIntegracao,
  gerarIntegracao,
  marcarEtapaDeIntegracao,
  removerEtapaDeIntegracao,
} from "@/app/(app)/empresas/[id]/treinamentos/actions";
import { avisarSeErro as avisar, confirmar } from "@/components/avisos";

/**
 * O que é de treinamento na ficha da pessoa: o checklist de integração (nasce
 * quando ela entra na equipe) e os treinamentos — o que fez, saído das turmas
 * em que esteve presente, e o que o cargo ainda pede. Nada aqui se digita: só
 * se marca.
 */

export type EtapaDaFicha = { id: string; texto: string; feito: boolean; feitoEm: string | null };

export type TreinamentoFeito = {
  reuniaoId: string;
  nome: string;
  categoria: string;
  dia: string;
  horas: string;
  instrutor: string | null;
  modalidade: string;
};

export type TreinamentoPendente = {
  nome: string;
  categoria: string;
  /** A turma programada em que a pessoa já está convocada, se houver. */
  turma: { reuniaoId: string; quando: string } | null;
};

function Integracao({ employeeId, etapas }: { employeeId: string; etapas: EtapaDaFicha[] }) {
  const [pending, startTransition] = useTransition();
  const [novo, setNovo] = useState("");
  const feitas = etapas.filter((e) => e.feito).length;
  const pct = etapas.length ? Math.round((feitas / etapas.length) * 100) : 0;

  if (etapas.length === 0) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3">
        <p className="text-sm text-slate-500">Esta pessoa entrou antes do checklist de integração existir.</p>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => avisar(await gerarIntegracao(employeeId)))}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          Gerar checklist de integração
        </button>
      </div>
    );
  }

  return (
    <div className={pending ? "opacity-60" : ""}>
      <div className="mb-2 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
          <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        <span className="text-xs text-slate-500">
          {feitas}/{etapas.length}
          {feitas === etapas.length ? " · integração concluída" : ""}
        </span>
      </div>
      <ul className="divide-y divide-slate-50">
        {etapas.map((e) => (
          <li key={e.id} className="group flex items-center gap-3 py-1.5">
            <button
              type="button"
              onClick={() => startTransition(async () => avisar(await marcarEtapaDeIntegracao(e.id, !e.feito)))}
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                e.feito ? "border-violet-600 bg-violet-600 text-white" : "border-slate-300 bg-white"
              }`}
              aria-label={e.feito ? `Desmarcar ${e.texto}` : `Marcar ${e.texto}`}
            >
              {e.feito ? <Check size={11} /> : null}
            </button>
            <span className={`flex-1 text-sm ${e.feito ? "text-slate-400 line-through" : "text-slate-700"}`}>
              {e.texto}
            </span>
            {e.feitoEm ? <span className="text-[11px] text-slate-400">{e.feitoEm}</span> : null}
            <button
              type="button"
              onClick={async () => {
                if (await confirmar(`Tirar "${e.texto}" do checklist desta pessoa?`)) {
                  startTransition(async () => avisar(await removerEtapaDeIntegracao(e.id)));
                }
              }}
              className="text-slate-300 opacity-0 transition hover:text-red-600 group-hover:opacity-100"
              aria-label={`Tirar ${e.texto}`}
            >
              <X size={13} />
            </button>
          </li>
        ))}
      </ul>
      <form
        className="mt-2 flex gap-2"
        onSubmit={(ev) => {
          ev.preventDefault();
          if (!novo.trim()) return;
          startTransition(async () => {
            const r = await adicionarEtapaDeIntegracao(employeeId, novo);
            avisar(r);
            if (r.ok) setNovo("");
          });
        }}
      >
        <input
          value={novo}
          onChange={(ev) => setNovo(ev.target.value)}
          placeholder="Mais um item só para esta pessoa"
          className="min-w-0 flex-1 rounded-md border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500"
        />
        <button
          type="submit"
          className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
        >
          <Plus size={12} /> item
        </button>
      </form>
    </div>
  );
}

export default function EmployeeTraining({
  companyId,
  employeeId,
  temCargo,
  etapas,
  feitos,
  pendentes,
  totalDeHoras,
}: {
  companyId: string;
  employeeId: string;
  temCargo: boolean;
  etapas: EtapaDaFicha[];
  feitos: TreinamentoFeito[];
  pendentes: TreinamentoPendente[];
  totalDeHoras: string;
}) {
  return (
    <>
      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Integração</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">
          O checklist de quem entra na equipe. Os itens vêm do modelo da empresa, na aba Treinamentos.
        </p>
        <Integracao employeeId={employeeId} etapas={etapas} />
      </section>

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Treinamentos</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              O histórico sai sozinho das turmas em que a pessoa esteve presente; o que falta vem da matriz do cargo.
            </p>
          </div>
          {feitos.length > 0 ? (
            <span className="text-xs text-slate-500">
              {feitos.length} feito{feitos.length > 1 ? "s" : ""} · {totalDeHoras}
            </span>
          ) : null}
        </div>

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Falta fazer</p>
        {!temCargo ? (
          <p className="mb-3 text-sm text-slate-400">Sem cargo no cadastro: a matriz não tem o que pedir.</p>
        ) : pendentes.length === 0 ? (
          <p className="mb-3 text-sm text-emerald-700">Em dia com a matriz do cargo.</p>
        ) : (
          <ul className="mb-3 space-y-1">
            {pendentes.map((p) => (
              <li key={p.nome} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
                <span className="text-slate-700">{p.nome}</span>
                <span className="text-[11px] text-slate-400">{p.categoria}</span>
                {p.turma ? (
                  <Link
                    href={`/empresas/${companyId}/reunioes/${p.turma.reuniaoId}`}
                    className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 hover:bg-sky-100"
                  >
                    convocado · {p.turma.quando}
                  </Link>
                ) : (
                  <span className="rounded bg-orange-50 px-1.5 py-0.5 text-[10px] font-medium text-orange-700">
                    sem turma
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}

        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Histórico</p>
        {feitos.length === 0 ? (
          <p className="text-sm text-slate-400">Nenhum treinamento realizado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] text-slate-400">
                <tr>
                  <th className="py-1 pr-3 font-medium">Treinamento</th>
                  <th className="py-1 pr-3 font-medium">Categoria</th>
                  <th className="py-1 pr-3 font-medium">Data</th>
                  <th className="py-1 pr-3 font-medium">Horas</th>
                  <th className="py-1 pr-3 font-medium">Instrutor</th>
                  <th className="py-1 font-medium">Tipo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {feitos.map((f) => (
                  <tr key={f.reuniaoId}>
                    <td className="py-1.5 pr-3">
                      <Link
                        href={`/empresas/${companyId}/reunioes/${f.reuniaoId}`}
                        className="text-slate-800 hover:text-brand-700"
                      >
                        {f.nome}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-3 text-slate-500">{f.categoria}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{f.dia}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{f.horas}</td>
                    <td className="py-1.5 pr-3 text-slate-500">{f.instrutor ?? "—"}</td>
                    <td className="py-1.5 text-slate-500">{f.modalidade === "EXTERNO" ? "Externo" : "Interno"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
