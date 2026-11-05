"use client";

import { useActionState } from "react";
import { responderDados, type DocumentoPublicoState } from "@/app/admissao/[token]/actions";
import { Field, FormError, Input, SubmitButton } from "@/components/form";

/** O formulário do link dos dados: CPF, nascimento e função. */
export default function AdmissaoDadosForm({
  token,
  respondido,
  cargos,
  valores,
}: {
  token: string;
  respondido: boolean;
  cargos: string[];
  valores: { cpf: string; dataNascimento: string; funcao: string };
}) {
  const [state, action] = useActionState<DocumentoPublicoState, FormData>(responderDados, {});

  if (state.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-white p-6 text-center">
        <h2 className="text-base font-semibold text-slate-900">Recebemos, obrigado!</h2>
        <p className="mt-1 text-sm text-slate-500">O RH vai marcar o seu exame admissional e te mandar o próximo passo.</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <input type="hidden" name="token" value={token} />
      {respondido ? <p className="text-xs text-emerald-700">Você já respondeu. Se algo estiver errado, corrija e envie de novo.</p> : null}
      <Field label="CPF">
        <Input name="cpf" defaultValue={valores.cpf} inputMode="numeric" placeholder="000.000.000-00" required autoComplete="off" />
      </Field>
      <Field label="Data de nascimento">
        <Input name="dataNascimento" type="date" defaultValue={valores.dataNascimento} required />
      </Field>
      <Field label="Função" hint="O cargo para o qual você foi contratado(a).">
        <Input name="funcao" defaultValue={valores.funcao} list="cargos-da-admissao" required maxLength={120} autoComplete="off" />
        <datalist id="cargos-da-admissao">
          {cargos.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </Field>
      <FormError message={state.error} />
      <SubmitButton className="w-full sm:w-auto">Enviar</SubmitButton>
    </form>
  );
}
