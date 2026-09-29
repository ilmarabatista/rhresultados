"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X } from "lucide-react";
import { criarReuniao, type ReuniaoState } from "@/app/(app)/empresas/[id]/reunioes/actions";
import type { OpcoesDaReuniao } from "@/lib/reunioes-dados";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";

/**
 * A janela de nova reunião, escrita à mão: quando, de que produto, onde, o
 * título e a pauta. Criada, a reunião abre na página dela, onde entram os
 * participantes, a ata e a apresentação usada.
 */

const rotuloMiudo = "mb-1.5 block text-[10px] font-semibold uppercase tracking-wider text-slate-500";

function Escolha({
  ativo,
  onClick,
  children,
  title,
}: {
  ativo: boolean;
  onClick: () => void;
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`max-w-[9rem] truncate rounded-md border px-2.5 py-1 text-[12px] font-medium transition ${
        ativo ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600 hover:border-brand-300"
      }`}
    >
      {children}
    </button>
  );
}

export default function NewMeetingDialog({
  companyId,
  opcoes,
  hoje,
  aoFechar,
}: {
  companyId: string;
  opcoes: OpcoesDaReuniao;
  hoje: string;
  aoFechar: () => void;
}) {
  const router = useRouter();
  const [state, action] = useActionState<ReuniaoState, FormData>(criarReuniao, {});
  const [aAgendar, setAAgendar] = useState(false);
  const [unidade, setUnidade] = useState("");

  useEffect(() => {
    if (state.ok && state.id) router.push(`/empresas/${companyId}/reunioes/${state.id}`);
  }, [state, companyId, router]);

  useEffect(() => {
    const fechar = (e: KeyboardEvent) => {
      if (e.key === "Escape") aoFechar();
    };
    document.addEventListener("keydown", fechar);
    return () => document.removeEventListener("keydown", fechar);
  }, [aoFechar]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:pt-[8vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) aoFechar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-nova-reuniao"
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between bg-brand-900 px-4 py-2.5">
          <h2 id="titulo-nova-reuniao" className="text-sm font-semibold text-white">
            Nova reunião
          </h2>
          <button
            type="button"
            onClick={aoFechar}
            className="text-brand-200 transition hover:text-white"
            aria-label="Fechar"
          >
            <X size={15} />
          </button>
        </div>

        <form action={action} className="space-y-3 p-4">
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="branchId" value={unidade} />

          <div className="flex flex-wrap gap-4">
            <div>
              <span className={rotuloMiudo}>Data e hora</span>
              <div className="flex gap-2">
                <Input
                  type="date"
                  name="dia"
                  defaultValue={hoje}
                  disabled={aAgendar}
                  required={!aAgendar}
                  className="w-40"
                />
                <Input
                  type="time"
                  name="hora"
                  defaultValue="08:00"
                  disabled={aAgendar}
                  required={!aAgendar}
                  className="w-28"
                />
              </div>
              <label className="mt-1.5 flex items-center gap-1.5 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  name="aAgendar"
                  checked={aAgendar}
                  onChange={(e) => setAAgendar(e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-600"
                />
                A agendar (ainda sem data)
              </label>
            </div>

            {opcoes.unidades.length > 0 ? (
              <div className="min-w-0">
                <span className={rotuloMiudo}>Unidade</span>
                <div className="flex flex-wrap gap-1">
                  <Escolha ativo={unidade === ""} onClick={() => setUnidade("")}>
                    Rede
                  </Escolha>
                  {opcoes.unidades.map((u) => (
                    <Escolha key={u.id} ativo={unidade === u.id} onClick={() => setUnidade(u.id)} title={u.nome}>
                      {u.nome}
                    </Escolha>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <Field label="Título">
            <Input name="titulo" required autoFocus placeholder="Ex.: Reunião semanal da recepção" />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Produto" hint="A qual produto esta reunião se refere.">
              <Select name="produtoId" defaultValue="">
                <option value="">Sem produto</option>
                {opcoes.produtos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nomeCompleto}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Setor"
              hint={opcoes.setores.length === 0 ? "Os setores vêm da aba Equipe." : undefined}
            >
              <Select name="setor" defaultValue="">
                <option value="">Sem setor</option>
                {opcoes.setores.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tipo (livre)">
              <Input name="tipo" placeholder="Equipe · Gestores · Vendedores…" />
            </Field>
            <Field label="Local (opcional)">
              <Input name="local" placeholder="Sala da gestão · Zoom…" />
            </Field>
          </div>

          <Field label="Pauta" hint="O que vai ser conversado — dá para ir enchendo durante a semana.">
            <Textarea name="pauta" rows={3} />
          </Field>

          <FormError message={state.error} />

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={aoFechar}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <SubmitButton pendingLabel="Criando…">Criar reunião</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}
