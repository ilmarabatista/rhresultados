"use client";

import { useActionState, useState } from "react";
import {
  Field,
  FormError,
  FormOk,
  Input,
  Section,
  Select,
  SubmitButton,
  Textarea,
} from "./form";
import DictationTextarea from "./dictation-textarea";
import type { FormState } from "@/app/(app)/empresas/actions";

export type CompanyDefaults = {
  id?: string;
  name?: string | null;
  legalName?: string | null;
  cnpj?: string | null;
  industry?: string | null;
  tone?: string | null;
  employeeCount?: number | null;
  website?: string | null;
  description?: string | null;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contractService?: string | null;
  contractValue?: string | null;
  contractDate?: string | null;
  contractEndDate?: string | null;
  contractStatus?: string | null;
  paymentDay?: number | null;
  notes?: string | null;
};

const SERVICOS = [
  "Recrutamento e Seleção",
  "Departamento Pessoal",
  "Consultoria de RH",
  "Treinamento e Desenvolvimento",
  "Avaliação de Desempenho",
  "Clima e Cultura Organizacional",
  "Cargos e Salários",
  "BPO de RH completo",
  "Outro",
];

export default function CompanyForm({
  action,
  submitLabel,
  defaults,
  withBranches = true,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  defaults?: CompanyDefaults;
  withBranches?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const [unidades, setUnidades] = useState<number[]>([0]);
  const [matriz, setMatriz] = useState(0);
  const d = defaults ?? {};

  return (
    <form action={formAction} className="space-y-4">
      {d.id ? <input type="hidden" name="companyId" value={d.id} /> : null}

      <Section
        title="Identificação"
        description="Como a empresa aparece no sistema."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome da empresa *" className="sm:col-span-2">
            <Input name="name" required defaultValue={d.name ?? ""} placeholder="Ex.: Padaria Central" />
          </Field>
          <Field label="Razão social">
            <Input name="legalName" defaultValue={d.legalName ?? ""} />
          </Field>
          <Field label="CNPJ">
            <Input name="cnpj" defaultValue={d.cnpj ?? ""} placeholder="00.000.000/0000-00" />
          </Field>
          <Field label="Ramo / nicho">
            <Input name="industry" defaultValue={d.industry ?? ""} placeholder="Ex.: Varejo alimentício" />
          </Field>
          <Field label="Quantidade de funcionários">
            <Input name="employeeCount" type="number" min={0} defaultValue={d.employeeCount ?? ""} />
          </Field>
          <Field
            label="Tom da empresa"
            hint="Como a comunicação com essa empresa deve soar."
          >
            <Input name="tone" defaultValue={d.tone ?? ""} placeholder="Ex.: Formal, próximo, técnico" />
          </Field>
          <Field label="Site">
            <Input name="website" defaultValue={d.website ?? ""} placeholder="https://" />
          </Field>
          <Field
            label="Descrição / contexto"
            hint="Pode ser ditado por voz."
            className="sm:col-span-2"
          >
            <DictationTextarea
              name="description"
              rows={4}
              defaultValue={d.description ?? ""}
              placeholder="Contexto do negócio, estrutura de RH atual, dores conhecidas…"
            />
          </Field>
        </div>
      </Section>

      <Section title="Contato responsável">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Nome">
            <Input name="contactName" defaultValue={d.contactName ?? ""} />
          </Field>
          <Field label="E-mail">
            <Input name="contactEmail" type="email" defaultValue={d.contactEmail ?? ""} />
          </Field>
          <Field label="Telefone">
            <Input name="contactPhone" defaultValue={d.contactPhone ?? ""} />
          </Field>
        </div>
      </Section>

      <Section title="Contrato">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Serviço contratado">
            <Select name="contractService" defaultValue={d.contractService ?? ""}>
              <option value="">Selecione…</option>
              {/* O valor gravado aparece mesmo fora da lista: senão salvar o
                  cadastro apagaria o serviço contratado sem ninguém ver. */}
              {[
                ...SERVICOS,
                ...(d.contractService && !SERVICOS.includes(d.contractService) ? [d.contractService] : []),
              ].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Valor do contrato (R$)">
            <Input name="contractValue" inputMode="decimal" defaultValue={d.contractValue ?? ""} placeholder="0,00" />
          </Field>
          <Field label="Data do contrato">
            <Input name="contractDate" type="date" defaultValue={d.contractDate ?? ""} />
          </Field>
          <Field label="Vigência até">
            <Input name="contractEndDate" type="date" defaultValue={d.contractEndDate ?? ""} />
          </Field>
          <Field label="Situação">
            <Select name="contractStatus" defaultValue={d.contractStatus ?? "ATIVO"}>
              {/* Sem esta opção, salvar a ficha de um prospecto o virava
                  cliente ativo em silêncio: o navegador escolhia a primeira. */}
              <option value="PROSPECTO">Prospecto</option>
              <option value="ATIVO">Ativo</option>
              <option value="PAUSADO">Pausado</option>
              <option value="ENCERRADO">Encerrado</option>
            </Select>
          </Field>
          <Field label="Dia de pagamento">
            <Input name="paymentDay" type="number" min={1} max={31} defaultValue={d.paymentDay ?? ""} />
          </Field>
        </div>
      </Section>

      {withBranches ? (
        <Section
          title="Unidades / filiais"
          description="Marque qual unidade é a matriz. Deixe apenas uma se a empresa não tiver filiais."
        >
          <div className="space-y-4">
            {unidades.map((idx, pos) => (
              <div
                key={idx}
                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                    <input
                      type="radio"
                      name="matrizIndex"
                      value={idx}
                      checked={matriz === idx}
                      onChange={() => setMatriz(idx)}
                      className="h-4 w-4 accent-brand-600"
                    />
                    Matriz
                  </label>
                  {unidades.length > 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        setUnidades((u) => u.filter((v) => v !== idx));
                        if (matriz === idx) setMatriz(unidades[0] === idx ? unidades[1] : unidades[0]);
                      }}
                      className="text-xs text-red-600 transition hover:text-red-700"
                    >
                      Remover unidade
                    </button>
                  ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-6">
                  <Field label="Nome da unidade" className="sm:col-span-3">
                    <Input
                      name={`filiais[${idx}][name]`}
                      placeholder={pos === 0 ? "Matriz" : `Filial ${pos + 1}`}
                    />
                  </Field>
                  <Field label="Funcionários" className="sm:col-span-1">
                    <Input name={`filiais[${idx}][employeeCount]`} type="number" min={0} />
                  </Field>
                  <Field label="Telefone" className="sm:col-span-2">
                    <Input name={`filiais[${idx}][phone]`} />
                  </Field>
                  <Field label="CEP" className="sm:col-span-2">
                    <Input name={`filiais[${idx}][zipCode]`} />
                  </Field>
                  <Field label="Rua" className="sm:col-span-3">
                    <Input name={`filiais[${idx}][street]`} />
                  </Field>
                  <Field label="Número" className="sm:col-span-1">
                    <Input name={`filiais[${idx}][number]`} />
                  </Field>
                  <Field label="Complemento" className="sm:col-span-2">
                    <Input name={`filiais[${idx}][complement]`} />
                  </Field>
                  <Field label="Bairro" className="sm:col-span-2">
                    <Input name={`filiais[${idx}][district]`} />
                  </Field>
                  <Field label="Cidade" className="sm:col-span-1">
                    <Input name={`filiais[${idx}][city]`} />
                  </Field>
                  <Field label="UF" className="sm:col-span-1">
                    <Input name={`filiais[${idx}][state]`} maxLength={2} />
                  </Field>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() =>
                setUnidades((u) => [...u, (u[u.length - 1] ?? 0) + 1])
              }
              className="rounded-lg border border-dashed border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:border-brand-400 hover:text-brand-700"
            >
              + Adicionar filial
            </button>
          </div>
        </Section>
      ) : null}

      <Section title="Observações">
        <Textarea
          name="notes"
          rows={3}
          defaultValue={d.notes ?? ""}
          placeholder="Qualquer informação relevante sobre o cliente."
        />
      </Section>

      <FormError message={state.error} />
      <FormOk message={state.ok ? "Alterações salvas." : undefined} />

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Salvando…">{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
