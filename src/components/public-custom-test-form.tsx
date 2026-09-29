"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { responderTeste, type RespostaState } from "@/app/teste/[token]/actions";

/**
 * Um teste cadastrado no link. Na escolha, uma alternativa por questão; nas
 * notas, cada alternativa recebe um número, e repetir um número tira ele da
 * outra alternativa. O botão só libera quando tudo foi respondido.
 */

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

export default function PublicCustomTestForm({
  token,
  modo,
  questoes,
}: {
  token: string;
  modo: "ESCOLHA" | "NOTAS";
  questoes: { enunciado: string; alternativas: string[] }[];
}) {
  const [state, action] = useActionState<RespostaState, FormData>(responderTeste, {});
  const [escolhas, setEscolhas] = useState<(number | null)[]>(() => questoes.map(() => null));
  const [notas, setNotas] = useState<(number | undefined)[][]>(() => questoes.map((q) => q.alternativas.map(() => undefined)));

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

  const faltam =
    modo === "ESCOLHA"
      ? escolhas.filter((e) => e === null).length
      : notas.filter((q) => q.some((n) => n === undefined)).length;

  function darNota(questao: number, alternativa: number, nota: number) {
    setNotas((atual) =>
      atual.map((daQuestao, q) =>
        q !== questao ? daQuestao : daQuestao.map((n, a) => (a === alternativa ? nota : n === nota ? undefined : n)),
      ),
    );
  }

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="token" value={token} />

      {questoes.map((q, i) => {
        const completa = modo === "ESCOLHA" ? escolhas[i] !== null : notas[i].every((n) => n !== undefined);
        const numeros = q.alternativas.map((_, k) => k + 1);
        return (
          <fieldset
            key={i}
            className={`rounded-lg border bg-white p-4 shadow-sm ${completa ? "border-emerald-200" : "border-slate-200"}`}
          >
            <legend className="px-1 text-xs font-medium text-slate-500">Questão {i + 1}</legend>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{q.enunciado}</p>
            <div className="mt-2 space-y-1.5">
              {q.alternativas.map((a, j) =>
                modo === "ESCOLHA" ? (
                  <label key={j} className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm text-slate-700 hover:bg-brand-50">
                    <input
                      type="radio"
                      name={`q-${i}`}
                      value={j}
                      checked={escolhas[i] === j}
                      onChange={() => setEscolhas((atual) => atual.map((m, k) => (k === i ? j : m)))}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-brand-600"
                    />
                    <span>
                      <strong className="mr-1 text-slate-400">{String.fromCharCode(65 + j)})</strong>
                      {a}
                    </span>
                  </label>
                ) : (
                  <div key={j} className="flex flex-col gap-1.5 rounded-md bg-slate-50 px-2.5 py-2 sm:flex-row sm:items-center sm:gap-3">
                    <p className="flex-1 text-sm leading-snug text-slate-700">
                      <strong className="mr-1 text-slate-400">{String.fromCharCode(65 + j)})</strong>
                      {a}
                    </p>
                    <div className="flex shrink-0 gap-1" role="radiogroup" aria-label={`Questão ${i + 1}, alternativa ${String.fromCharCode(65 + j)}`}>
                      {numeros.map((n) => (
                        <label key={n} className="cursor-pointer">
                          <input
                            type="radio"
                            name={`q-${i}-${j}`}
                            value={n}
                            checked={notas[i][j] === n}
                            onChange={() => darNota(i, j, n)}
                            className="peer sr-only"
                          />
                          <span className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-300 bg-white text-sm tabular-nums text-slate-600 transition hover:border-brand-400 peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300">
                            {n}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                ),
              )}
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
