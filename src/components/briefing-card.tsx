"use client";

import { useActionState, useEffect, useState } from "react";
import { salvarBriefing } from "@/app/(app)/empresas/actions";
import { FormError, FormOk, SubmitButton } from "./form";
import DictationTextarea from "./dictation-textarea";

/**
 * Briefing da primeira reunião.
 *
 * Fica no alto da ficha porque é digitado durante a conversa, com o cliente
 * na frente — e a reunião de briefing é onde o processo comercial começa. Os
 * tópicos abaixo do campo são um roteiro, não um formulário: a ordem da
 * conversa é de quem conduz.
 */

const ROTEIRO = [
  "O que a empresa faz, há quanto tempo e quantas pessoas tem",
  "Como o RH funciona hoje, e quem cuida dele",
  "O que trouxe a empresa até aqui — a dor que fez procurar ajuda",
  "O que já tentaram e não funcionou",
  "Rotatividade, absenteísmo, clima: o que incomoda no dia a dia",
  "Quem decide, e em quanto tempo pretendem começar",
];

export default function BriefingCard({
  companyId,
  briefing,
  registradoEm,
}: {
  companyId: string;
  briefing: string | null;
  /** Data por extenso de quando o briefing foi gravado. */
  registradoEm: string | null;
}) {
  const [state, action] = useActionState<
    { error?: string; ok?: boolean },
    FormData
  >(salvarBriefing, {});
  const [aberto, setAberto] = useState(!briefing);
  const [salvo, setSalvo] = useState(false);

  useEffect(() => {
    if (state.ok) {
      setSalvo(true);
      const t = setTimeout(() => setSalvo(false), 3000);
      return () => clearTimeout(t);
    }
  }, [state.ok]);

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Briefing</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {registradoEm
              ? `Registrado em ${registradoEm}.`
              : "A primeira reunião é de briefing e fechamento. Digite aqui durante a conversa."}
          </p>
        </div>

        {briefing && !aberto ? (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            Editar
          </button>
        ) : null}
      </div>

      {aberto ? (
        <form action={action} className="space-y-3">
          <input type="hidden" name="companyId" value={companyId} />

          <DictationTextarea
            name="briefing"
            rows={10}
            defaultValue={briefing ?? ""}
            placeholder="O que a empresa contou na reunião…"
          />

          <details className="rounded-lg bg-slate-50 px-3 py-2">
            <summary className="cursor-pointer text-xs font-medium text-slate-600">
              Roteiro da conversa
            </summary>
            <ul className="mt-2 space-y-1">
              {ROTEIRO.map((r) => (
                <li
                  key={r}
                  className="flex gap-2 text-xs leading-relaxed text-slate-500"
                >
                  <span aria-hidden className="text-slate-300">
                    •
                  </span>
                  {r}
                </li>
              ))}
            </ul>
          </details>

          <FormError message={state.error} />
          {salvo ? <FormOk message="Briefing gravado." /> : null}

          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Gravando…">
              Gravar briefing
            </SubmitButton>
            {briefing ? (
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="text-sm text-slate-500 transition hover:text-slate-800"
              >
                Fechar
              </button>
            ) : null}
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {briefing}
        </p>
      )}
    </section>
  );
}
