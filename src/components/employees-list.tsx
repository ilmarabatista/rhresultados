"use client";

import Link from "next/link";
import { useState } from "react";
import EmployeeForm from "./employee-form";
import { iniciais } from "@/lib/text";

export type ColaboradorItem = {
  id: string;
  nome: string;
  cargo: string | null;
  setor: string | null;
  unidade: string | null;
  status: string;
  planos: number;
  advertencias: number;
  faltas: number;
  atestados: number;
};

const STATUS_STYLE: Record<string, string> = {
  ATIVO: "bg-emerald-50 text-emerald-700",
  AFASTADO: "bg-amber-50 text-amber-700",
  DESLIGADO: "bg-slate-100 text-slate-500",
};

export default function EmployeesList({
  companyId,
  unidades,
  colaboradores,
}: {
  companyId: string;
  unidades: { id: string; nome: string }[];
  colaboradores: ColaboradorItem[];
}) {
  const [novo, setNovo] = useState(false);
  const [busca, setBusca] = useState("");

  const termo = busca.trim().toLowerCase();
  const lista = termo
    ? colaboradores.filter((c) =>
        [c.nome, c.cargo, c.setor]
          .filter(Boolean)
          .some((v) => v!.toLowerCase().includes(termo)),
      )
    : colaboradores;

  const ativos = colaboradores.filter((c) => c.status === "ATIVO").length;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Equipe
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
            Os colaboradores desta empresa cliente. Cada um tem linha do tempo e
            plano de desenvolvimento próprios.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          + Colaborador
        </button>
      </div>

      {colaboradores.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-9 text-center">
          <p className="text-sm font-medium text-slate-700">
            Nenhum colaborador cadastrado.
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Cadastre as pessoas desta empresa para acompanhar PDI, observações,
            advertências, faltas e atestados.
          </p>
          <button
            type="button"
            onClick={() => setNovo(true)}
            className="mt-5 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Cadastrar colaborador
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por nome, cargo ou setor…"
              className="w-full max-w-xs rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
            />
            <p className="text-xs text-slate-500">
              {ativos} ativo(s) de {colaboradores.length}
            </p>
          </div>

          {lista.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-7 text-center text-sm text-slate-500">
              Ninguém encontrado para essa busca.
            </p>
          ) : (
            <ul className="space-y-2">
              {lista.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/empresas/${companyId}/equipe/${c.id}`}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-[11px] font-semibold text-brand-700 ring-1 ring-brand-100">
                      {iniciais(c.nome)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">
                        {c.nome}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {[c.cargo, c.setor, c.unidade]
                          .filter(Boolean)
                          .join(" · ") || "Sem cargo informado"}
                      </span>
                    </span>

                    <span className="flex shrink-0 flex-wrap items-center gap-1.5">
                      {c.planos > 0 ? (
                        <span className="rounded bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                          {c.planos} PDI
                        </span>
                      ) : null}
                      {c.advertencias > 0 ? (
                        <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                          {c.advertencias} advert.
                        </span>
                      ) : null}
                      {c.faltas > 0 ? (
                        <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                          {c.faltas} falta{c.faltas > 1 ? "s" : ""}
                        </span>
                      ) : null}
                      {c.atestados > 0 ? (
                        <span className="rounded bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700">
                          {c.atestados} atest.
                        </span>
                      ) : null}
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                          STATUS_STYLE[c.status] ?? STATUS_STYLE.DESLIGADO
                        }`}
                      >
                        {c.status}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {novo ? (
        <EmployeeForm
          companyId={companyId}
          unidades={unidades}
          colaborador={null}
          onClose={() => setNovo(false)}
        />
      ) : null}
    </>
  );
}
