"use client";

import { useActionState, useState } from "react";
import { deleteCompany, type FormState } from "@/app/(app)/empresas/actions";
import { FormError, Input } from "./form";
import { useFormStatus } from "react-dom";

export type ImpactoExclusao = {
  reunioes: number;
  planos: number;
  pessoas: number;
  compromissos: number;
  vagas: number;
  filiais: number;
  atividades: number;
};

function BotaoExcluir() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
    >
      {pending ? "Excluindo…" : "Excluir permanentemente"}
    </button>
  );
}

export default function DeleteCompany({
  companyId,
  companyName,
  impacto,
}: {
  companyId: string;
  companyName: string;
  impacto: ImpactoExclusao;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, formAction] = useActionState<FormState, FormData>(
    deleteCompany,
    {},
  );

  const itens = [
    { label: "reunião(ões) com ata", n: impacto.reunioes },
    { label: "plano(s) de treinamento", n: impacto.planos },
    { label: "pessoa(s) na equipe, com ponto e exames", n: impacto.pessoas },
    { label: "compromisso(s) na agenda", n: impacto.compromissos },
    { label: "vaga(s) com candidatos", n: impacto.vagas },
    { label: "unidade(s)", n: impacto.filiais },
    { label: "registro(s) no fluxo de atividades", n: impacto.atividades },
  ].filter((i) => i.n > 0);

  return (
    <section className="mt-8 rounded-lg border border-red-200 bg-red-50/40 p-4">
      <h2 className="text-sm font-semibold text-red-900">Zona de risco</h2>
      <p className="mt-1 max-w-2xl text-xs leading-relaxed text-red-800/80">
        Excluir a empresa apaga junto tudo o que foi produzido para ela. Não há
        como desfazer, e o histórico não sobrevive em nenhum outro lugar do
        sistema.
      </p>

      {itens.length > 0 ? (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-red-800/80">
          {itens.map((i) => (
            <li key={i.label}>
              <span className="font-semibold">{i.n}</span> {i.label}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-3 text-xs text-red-800/70">
          Esta empresa ainda não tem nada registrado.
        </p>
      )}

      {!aberto ? (
        <button
          type="button"
          onClick={() => setAberto(true)}
          className="mt-5 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          Excluir esta empresa
        </button>
      ) : (
        <form action={formAction} className="mt-5 max-w-md space-y-3">
          <input type="hidden" name="companyId" value={companyId} />

          <label className="block">
            <span className="mb-1.5 block text-xs text-red-900">
              Para confirmar, digite{" "}
              <span className="font-semibold">{companyName}</span>:
            </span>
            <Input
              name="confirmacao"
              required
              autoComplete="off"
              placeholder={companyName}
              className="border-red-300 focus:border-red-500 focus:ring-red-100"
            />
          </label>

          <FormError message={state.error} />

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <BotaoExcluir />
          </div>
        </form>
      )}
    </section>
  );
}
