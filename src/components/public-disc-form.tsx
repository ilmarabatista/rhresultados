"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { responderTeste, type RespostaState } from "@/app/teste/[token]/actions";
import { LETRAS, NOTAS, QUESTOES_DISC } from "@/lib/disc";

/**
 * O DISC respondido pelo link.
 *
 * Em cada questão, as quatro opções recebem uma nota de 1 a 4. Dar a uma opção
 * um número que outra já tinha tira o número da outra, então não há como
 * empatar pela tela — a conferência de verdade é a do servidor.
 */

type Notas = (number | undefined)[][];

function Enviar({ faltam }: { faltam: number }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || faltam > 0}
      className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
    >
      {pending ? "Enviando…" : faltam > 0 ? `Faltam ${faltam} questão(ões)` : "Enviar respostas"}
    </button>
  );
}

export default function PublicDiscForm({ token }: { token: string }) {
  const [state, action] = useActionState<RespostaState, FormData>(responderTeste, {});
  const [notas, setNotas] = useState<Notas>(() => QUESTOES_DISC.map((q) => q.opcoes.map(() => undefined)));

  if (state.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <h2 className="text-lg font-semibold text-emerald-900">Respostas enviadas</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800">
          Obrigado! Suas respostas foram recebidas.
        </p>
      </div>
    );
  }

  const faltam = notas.filter((q) => q.some((n) => n === undefined)).length;

  function marcar(questao: number, opcao: number, nota: number) {
    setNotas((atual) =>
      atual.map((daQuestao, q) =>
        q !== questao ? daQuestao : daQuestao.map((n, o) => (o === opcao ? nota : n === nota ? undefined : n)),
      ),
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      <p className="rounded-lg border border-brand-100 bg-brand-50/60 px-3 py-2 text-xs leading-relaxed text-brand-900">
        Em cada questão, dê <strong>4</strong> à opção que <strong>mais</strong> tem a ver com você e <strong>1</strong> à que{" "}
        <strong>menos</strong> tem. Cada número vale uma vez só por questão: se repetir um número, ele sai da outra opção.
      </p>

      {QUESTOES_DISC.map((questao, q) => {
        const completa = notas[q].every((n) => n !== undefined);
        return (
          <fieldset
            key={q}
            className={`rounded-lg border bg-white p-3 shadow-sm ${completa ? "border-emerald-200" : "border-slate-200"}`}
          >
            <legend className="sr-only">Questão {q + 1}</legend>
            <p className="text-sm font-medium leading-snug text-slate-900">
              {q + 1}. {questao.enunciado}
            </p>
            <div className="mt-2 space-y-1.5">
              {questao.opcoes.map((opcao, o) => (
                <div
                  key={o}
                  className="flex flex-col gap-1.5 rounded-md bg-slate-50 px-2.5 py-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <p className="flex-1 text-sm leading-snug text-slate-700">
                    <span className="font-semibold text-slate-900">{LETRAS[o]}.</span> {opcao.texto}
                  </p>
                  <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`Questão ${q + 1}, opção ${LETRAS[o]}`}>
                    {NOTAS.map((nota) => (
                      <label key={nota} className="cursor-pointer">
                        <input
                          type="radio"
                          name={`q-${q}-${o}`}
                          value={nota}
                          checked={notas[q][o] === nota}
                          onChange={() => marcar(q, o, nota)}
                          className="peer sr-only"
                        />
                        <span className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm tabular-nums text-slate-600 transition hover:border-brand-400 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300">
                          {nota}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </fieldset>
        );
      })}

      {state.error ? (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      ) : null}

      <div className="flex flex-col items-end">
        <Enviar faltam={faltam} />
        <p className="mt-2 text-xs text-slate-400">O envio é definitivo: o link aceita uma resposta só.</p>
      </div>
    </form>
  );
}
