"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  deleteBranch,
  saveBranch,
  setHeadquarters,
  type FormState,
} from "@/app/(app)/empresas/actions";
import { Field, FormError, Input, SubmitButton } from "./form";

export type UnidadeItem = {
  id: string;
  name: string;
  isHeadquarters: boolean;
  street: string | null;
  number: string | null;
  complement: string | null;
  district: string | null;
  city: string | null;
  state: string | null;
  zipCode: string | null;
  employeeCount: number | null;
  phone: string | null;
};

function enderecoDe(u: UnidadeItem) {
  return (
    [
      u.street && `${u.street}${u.number ? `, ${u.number}` : ""}`,
      u.complement,
      u.district,
      u.city && u.state ? `${u.city}/${u.state}` : u.city,
      u.zipCode,
    ]
      .filter(Boolean)
      .join(" · ") || "Endereço não informado"
  );
}

function FormularioUnidade({
  companyId,
  unidade,
  onClose,
}: {
  companyId: string;
  unidade: UnidadeItem | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(
    saveBranch,
    {},
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {unidade ? "Editar unidade" : "Nova unidade"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="companyId" value={companyId} />
          {unidade ? (
            <input type="hidden" name="branchId" value={unidade.id} />
          ) : null}

          <div className="grid gap-3 sm:grid-cols-6">
            <Field label="Nome da unidade *" className="sm:col-span-3">
              <Input
                name="name"
                required
                defaultValue={unidade?.name ?? ""}
                placeholder="Ex.: Matriz Centro"
              />
            </Field>
            <Field label="Funcionários" className="sm:col-span-1">
              <Input
                name="employeeCount"
                type="number"
                min={0}
                defaultValue={unidade?.employeeCount ?? ""}
              />
            </Field>
            <Field label="Telefone" className="sm:col-span-2">
              <Input name="phone" defaultValue={unidade?.phone ?? ""} />
            </Field>
            <Field label="CEP" className="sm:col-span-2">
              <Input name="zipCode" defaultValue={unidade?.zipCode ?? ""} />
            </Field>
            <Field label="Rua" className="sm:col-span-3">
              <Input name="street" defaultValue={unidade?.street ?? ""} />
            </Field>
            <Field label="Número" className="sm:col-span-1">
              <Input name="number" defaultValue={unidade?.number ?? ""} />
            </Field>
            <Field label="Complemento" className="sm:col-span-2">
              <Input
                name="complement"
                defaultValue={unidade?.complement ?? ""}
              />
            </Field>
            <Field label="Bairro" className="sm:col-span-2">
              <Input name="district" defaultValue={unidade?.district ?? ""} />
            </Field>
            <Field label="Cidade" className="sm:col-span-1">
              <Input name="city" defaultValue={unidade?.city ?? ""} />
            </Field>
            <Field label="UF" className="sm:col-span-1">
              <Input
                name="state"
                maxLength={2}
                defaultValue={unidade?.state ?? ""}
              />
            </Field>
          </div>

          <FormError message={state.error} />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <SubmitButton pendingLabel="Salvando…">
              {unidade ? "Salvar unidade" : "Cadastrar unidade"}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function BranchesManager({
  companyId,
  unidades,
}: {
  companyId: string;
  unidades: UnidadeItem[];
}) {
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<UnidadeItem | null>(null);

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Unidades e filiais
          </h2>
          <p className="text-xs text-slate-500">
            A matriz é a unidade de referência da empresa.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          + Unidade
        </button>
      </div>

      {unidades.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Nenhuma unidade cadastrada.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {unidades.map((u) => (
            <CardUnidade
              key={u.id}
              unidade={u}
              companyId={companyId}
              podeExcluir={unidades.length > 1}
              onEditar={() => setEditando(u)}
            />
          ))}
        </ul>
      )}

      {novo ? (
        <FormularioUnidade
          companyId={companyId}
          unidade={null}
          onClose={() => setNovo(false)}
        />
      ) : null}

      {editando ? (
        <FormularioUnidade
          companyId={companyId}
          unidade={editando}
          onClose={() => setEditando(null)}
        />
      ) : null}
    </section>
  );
}

/** A edição é controlada pelo componente pai, para haver só um modal na tela. */
function CardUnidade({
  unidade,
  podeExcluir,
  onEditar,
}: {
  unidade: UnidadeItem;
  companyId: string;
  podeExcluir: boolean;
  onEditar: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={`rounded-xl border p-4 transition ${
        unidade.isHeadquarters
          ? "border-brand-200 bg-brand-50/40"
          : "border-slate-200 bg-slate-50/60"
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-slate-800">{unidade.name}</h3>
        {unidade.isHeadquarters ? (
          <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
            MATRIZ
          </span>
        ) : null}
      </div>

      <p className="mt-1 text-xs leading-relaxed text-slate-500">
        {enderecoDe(unidade)}
      </p>
      {unidade.employeeCount || unidade.phone ? (
        <p className="mt-1 text-[11px] text-slate-400">
          {[
            unidade.employeeCount && `${unidade.employeeCount} funcionários`,
            unidade.phone,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-200/70 pt-2.5">
        {!unidade.isHeadquarters ? (
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(() => {
                void setHeadquarters(unidade.id);
              })
            }
            className="text-[11px] text-slate-500 transition hover:text-brand-700"
          >
            Tornar matriz
          </button>
        ) : null}
        <button
          type="button"
          onClick={onEditar}
          disabled={pending}
          className="text-[11px] text-brand-600 transition hover:text-brand-700"
        >
          Editar
        </button>
        {podeExcluir ? (
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Excluir a unidade "${unidade.name}"?`)) return;
              startTransition(() => {
                void deleteBranch(unidade.id);
              });
            }}
            className="ml-auto text-[11px] text-red-500 transition hover:text-red-700"
          >
            Excluir
          </button>
        ) : null}
      </div>
    </li>
  );
}
