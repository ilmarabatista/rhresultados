"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import {
  saveService,
  toggleServiceActive,
  updateSettings,
  type ConfigState,
} from "@/app/(app)/configuracoes/actions";
import {
  Field,
  FormError,
  FormOk,
  Input,
  Section,
    SubmitButton,
  Textarea,
} from "./form";

export type ServicoCatalogoItem = {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
  /** Em quantos planos, reuniões e compromissos o produto já aparece. */
  usos: number;
};

function FormularioServico({
  servico,
  onClose,
}: {
  servico: ServicoCatalogoItem | null;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<ConfigState, FormData>(
    saveService,
    {},
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              {servico ? "Editar produto" : "Novo produto do catálogo"}
            </h3>
            <p className="text-xs text-slate-500">
              O que aparece para escolher no plano, na reunião e na agenda.
            </p>
          </div>
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
          {servico ? (
            <input type="hidden" name="serviceId" value={servico.id} />
          ) : null}

          <Field label="Nome do produto *">
            <Input
              name="name"
              required
              defaultValue={servico?.nome ?? ""}
              placeholder="Ex.: Avaliação de desempenho"
            />
          </Field>

          <Field
            label="O que fazemos pela empresa"
            hint="Uma ou duas frases. Serve de lembrete de o que o produto promete."
          >
            <Textarea
              name="description"
              rows={3}
              defaultValue={servico?.descricao ?? ""}
            />
          </Field>

          {servico && servico.usos > 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2.5 text-xs leading-relaxed text-slate-600">
              Este produto já aparece em {servico.usos} plano(s), reunião(ões) ou
              compromisso(s). Mudar o nome aqui muda o nome que aparece neles.
            </p>
          ) : null}

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
              {servico ? "Salvar produto" : "Criar produto"}
            </SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function CardServico({
  servico,
  onEditar,
}: {
  servico: ServicoCatalogoItem;
  onEditar: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={`rounded-xl border p-4 ${
        servico.ativo
          ? "border-slate-200 bg-white"
          : "border-slate-200 bg-slate-50/70"
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-slate-800">
              {servico.nome}
            </h3>
            {!servico.ativo ? (
              <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                INATIVO
              </span>
            ) : null}
          </div>
          {servico.descricao ? (
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              {servico.descricao}
            </p>
          ) : null}
        </div>
        <span className="shrink-0 text-[11px] text-slate-400">
          {servico.usos > 0 ? `em uso · ${servico.usos}` : "sem uso ainda"}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2.5">
        <button
          type="button"
          onClick={onEditar}
          className="text-[11px] text-brand-600 transition hover:text-brand-700"
        >
          Editar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            startTransition(() => {
              void toggleServiceActive(servico.id, !servico.ativo);
            })
          }
          className="ml-auto text-[11px] text-slate-500 transition hover:text-slate-800"
        >
          {servico.ativo ? "Desativar" : "Reativar"}
        </button>
      </div>
    </li>
  );
}

export default function SettingsPanel({
  settings,
  servicos,
  isAdmin,
}: {
  settings: {
    orgName: string;
    orgDocument: string | null;
    orgContact: string | null;
    reportFooter: string | null;
  };
  servicos: ServicoCatalogoItem[];
  isAdmin: boolean;
}) {
  const [state, formAction] = useActionState<ConfigState, FormData>(
    updateSettings,
    {},
  );
  const [novo, setNovo] = useState(false);
  const [editando, setEditando] = useState<ServicoCatalogoItem | null>(null);

  if (!isAdmin) {
    return (
      <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-9 text-center text-sm text-slate-500">
        Só administradores podem alterar as configurações.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Section
        title="Identidade da empresa de RH"
        description="Aparece no relatório entregue ao cliente."
      >
        <form action={formAction} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome *">
              <Input name="orgName" required defaultValue={settings.orgName} />
            </Field>
            <Field label="CNPJ">
              <Input
                name="orgDocument"
                defaultValue={settings.orgDocument ?? ""}
              />
            </Field>
            <Field label="Contato" className="sm:col-span-2">
              <Input
                name="orgContact"
                defaultValue={settings.orgContact ?? ""}
                placeholder="Telefone, e-mail ou site"
              />
            </Field>
            <Field label="Rodapé do relatório" className="sm:col-span-2">
              <Textarea
                name="reportFooter"
                rows={2}
                defaultValue={settings.reportFooter ?? ""}
                placeholder="Texto que fecha o relatório enviado ao cliente."
              />
            </Field>
          </div>

          <FormError message={state.error} />
          <FormOk message={state.ok ? "Configurações salvas." : undefined} />

          <div className="flex justify-end">
            <SubmitButton pendingLabel="Salvando…">Salvar</SubmitButton>
          </div>
        </form>
      </Section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Catálogo de produtos
            </h2>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
              Os produtos da consultoria. É a lista oferecida no plano de
              treinamento, na reunião e na agenda. Desativado some da lista de
              escolha, mas continua no que já foi feito.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNovo(true)}
            className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            + Produto
          </button>
        </div>

        <ul className="space-y-3">
          {servicos.map((s) => (
            <CardServico
              key={s.id}
              servico={s}
              onEditar={() => setEditando(s)}
            />
          ))}
        </ul>
      </section>

      {novo ? (
        <FormularioServico servico={null} onClose={() => setNovo(false)} />
      ) : null}
      {editando ? (
        <FormularioServico
          servico={editando}
          onClose={() => setEditando(null)}
        />
      ) : null}
    </div>
  );
}
