"use client";

import { useActionState, useEffect, useState } from "react";
import {
  saveEmployee,
  type EquipeState,
} from "@/app/(app)/empresas/[id]/equipe/actions";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";
import { linkDoWhatsApp, mensagemDoLink, telefoneDoWhatsApp } from "@/lib/autoavaliacao";
import { copiarLink } from "./autoavaliacao-modelos";
import { linkPublico } from "@/lib/link-publico";

export type ColaboradorDados = {
  id: string;
  name: string;
  document: string | null;
  role: string | null;
  cargoId: string | null;
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
  cargos,
  colaborador,
  onClose,
}: {
  companyId: string;
  unidades: { id: string; nome: string }[];
  /** A lista de cargos da empresa. */
  cargos: { id: string; nome: string }[];
  colaborador: ColaboradorDados | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<EquipeState, FormData>(
    saveEmployee,
    {},
  );

  useEffect(() => {
    // Com o link da autoavaliação pronto, a janela fica aberta para mandar.
    if (state.ok && !state.autoavaliacao) onClose();
  }, [state, onClose]);

  // Sem cargos na lista, o campo já abre para escrever o primeiro. Quem tem
  // cargo só em texto, fora da lista, também: salvar assim liga a pessoa ao
  // cargo (criando-o em Cargos), em vez de apagar o que estava escrito.
  const cargoSoEmTexto = colaborador?.role && !colaborador.cargoId ? colaborador.role : "";
  const [cargoNovo, setCargoNovo] = useState(cargos.length === 0 || Boolean(cargoSoEmTexto));
  const [cargoId, setCargoId] = useState(colaborador?.cargoId ?? "");

  if (state.ok && state.autoavaliacao) return <LinkPronto {...state.autoavaliacao} onClose={onClose} />;

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
            className="text-slate-500 transition hover:text-slate-700"
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

            <Field
              label="Cargo"
              hint={
                cargoNovo ? (
                  "Entra na lista de cargos da empresa."
                ) : cargoId ? (
                  <a
                    href={`/empresas/${companyId}/cargos?cargo=${cargoId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-brand-700 underline-offset-2 hover:underline"
                  >
                    Ver a descrição deste cargo
                  </a>
                ) : (
                  "Os cargos cadastrados em Cargos."
                )
              }
              className="sm:col-span-3"
            >
              {cargoNovo ? (
                <div className="flex gap-2">
                  <Input
                    name="novoCargo"
                    autoFocus={!colaborador}
                    defaultValue={cargoSoEmTexto}
                    placeholder="Nome do cargo novo"
                  />
                  {cargos.length > 0 ? (
                    <button
                      type="button"
                      onClick={() => setCargoNovo(false)}
                      className="shrink-0 text-xs text-slate-500 transition hover:text-slate-800"
                    >
                      da lista
                    </button>
                  ) : null}
                </div>
              ) : (
                <Select
                  name="cargoId"
                  value={cargoId}
                  onChange={(e) => {
                    if (e.target.value === "__novo") setCargoNovo(true);
                    else setCargoId(e.target.value);
                  }}
                >
                  <option value="">Sem cargo</option>
                  {cargos.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
                  <option value="__novo">+ Novo cargo…</option>
                </Select>
              )}
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
                <option value="DESLIGADO">Desativado (desligado)</option>
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

function LinkPronto({
  token,
  titulo,
  nome,
  telefone,
  onClose,
}: {
  token: string;
  titulo: string;
  nome: string;
  telefone: string | null;
  onClose: () => void;
}) {
  const link = linkPublico(`/autoavaliacao/${token}`);
  const temCelular = Boolean(telefoneDoWhatsApp(telefone));
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-slate-900">Cadastro salvo</h3>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          O link da autoavaliação de {nome.split(/\s+/)[0]} já está pronto, com o modelo {titulo}. Mande agora ou depois,
          em PDI &gt; Autoavaliações.
        </p>
        <p className="mt-3 truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">{link}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
          >
            Fechar
          </button>
          <button
            type="button"
            onClick={() => copiarLink(token)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Copiar link
          </button>
          <a
            href={linkDoWhatsApp(telefone, mensagemDoLink(nome, link))}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700"
          >
            {temCelular ? "Mandar no WhatsApp" : "Mandar no WhatsApp (escolher contato)"}
          </a>
        </div>
      </div>
    </div>
  );
}
