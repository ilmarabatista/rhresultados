"use client";

import { useActionState, useEffect } from "react";
import {
  saveEmployee,
  type EquipeState,
} from "@/app/(app)/empresas/[id]/equipe/actions";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";

export type ColaboradorDados = {
  id: string;
  name: string;
  document: string | null;
  role: string | null;
  department: string | null;
  email: string | null;
  phone: string | null;
  branchId: string | null;
  birthDate: string;
  hiredAt: string;
  terminatedAt: string;
  status: string;
  notes: string | null;
};

export default function EmployeeForm({
  companyId,
  unidades,
  colaborador,
  onClose,
}: {
  companyId: string;
  unidades: { id: string; nome: string }[];
  colaborador: ColaboradorDados | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<EquipeState, FormData>(
    saveEmployee,
    {},
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {colaborador ? "Editar colaborador" : "Novo colaborador"}
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
          {colaborador ? (
            <input type="hidden" name="employeeId" value={colaborador.id} />
          ) : null}

          <div className="grid gap-4 sm:grid-cols-6">
            <Field label="Nome *" className="sm:col-span-4">
              <Input name="name" required defaultValue={colaborador?.name ?? ""} />
            </Field>
            <Field label="CPF" className="sm:col-span-2">
              <Input name="document" defaultValue={colaborador?.document ?? ""} />
            </Field>

            <Field label="Cargo" className="sm:col-span-3">
              <Input name="role" defaultValue={colaborador?.role ?? ""} />
            </Field>
            <Field label="Setor" className="sm:col-span-3">
              <Input
                name="department"
                defaultValue={colaborador?.department ?? ""}
              />
            </Field>

            <Field label="E-mail" className="sm:col-span-3">
              <Input
                name="email"
                type="email"
                defaultValue={colaborador?.email ?? ""}
              />
            </Field>
            <Field label="Telefone" className="sm:col-span-3">
              <Input name="phone" defaultValue={colaborador?.phone ?? ""} />
            </Field>

            {unidades.length > 0 ? (
              <Field label="Unidade" className="sm:col-span-3">
                <Select
                  name="branchId"
                  defaultValue={colaborador?.branchId ?? ""}
                >
                  <option value="">Não informada</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </Select>
              </Field>
            ) : null}
            <Field label="Situação" className="sm:col-span-3">
              <Select name="status" defaultValue={colaborador?.status ?? "ATIVO"}>
                <option value="ATIVO">Ativo</option>
                <option value="AFASTADO">Afastado</option>
                <option value="DESLIGADO">Desligado</option>
              </Select>
            </Field>

            <Field label="Nascimento" className="sm:col-span-2">
              <Input
                name="birthDate"
                type="date"
                defaultValue={colaborador?.birthDate ?? ""}
              />
            </Field>
            <Field label="Admissão" className="sm:col-span-2">
              <Input
                name="hiredAt"
                type="date"
                defaultValue={colaborador?.hiredAt ?? ""}
              />
            </Field>
            <Field label="Desligamento" className="sm:col-span-2">
              <Input
                name="terminatedAt"
                type="date"
                defaultValue={colaborador?.terminatedAt ?? ""}
              />
            </Field>

            <Field
              label="Observações gerais"
              hint="Contexto permanente sobre a pessoa. Fatos com data vão na linha do tempo."
              className="sm:col-span-6"
            >
              <Textarea
                name="notes"
                rows={3}
                defaultValue={colaborador?.notes ?? ""}
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
              {colaborador ? "Salvar" : "Cadastrar"}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
