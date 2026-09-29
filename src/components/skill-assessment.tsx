"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Sparkles, Trash2 } from "lucide-react";
import {
  gerarPlanoTecnicoAction,
  salvarPlanoTecnico,
  type EquipeState,
  type TecnicoState,
} from "@/app/(app)/empresas/[id]/equipe/actions";
import { Field, FormError, Input, SubmitButton, Textarea } from "./form";
import DictationTextarea from "./dictation-textarea";

const PERGUNTAS: { campo: string; label: string; hint?: string }[] = [
  {
    campo: "roleTasks",
    label: "O que você faz no seu cargo?",
    hint: "As atividades do seu dia a dia.",
  },
  { campo: "strengths", label: "O que você já domina bem?" },
  {
    campo: "difficulties",
    label: "Onde você sente dificuldade?",
    hint: "Pode ser franco: é isso que orienta o plano.",
  },
  {
    campo: "toolsAndSystems",
    label: "Que ferramentas e sistemas você usa?",
  },
  { campo: "blockers", label: "O que trava o seu dia a dia?" },
  { campo: "wantsToDevelop", label: "O que você gostaria de desenvolver?" },
  { campo: "supportNeeded", label: "Que apoio você precisaria para isso?" },
  { campo: "other", label: "Mais alguma coisa que queira registrar?" },
];

type AcaoRevisao = {
  key: string;
  title: string;
  description: string;
};

/**
 * Dois caminhos para o plano: montado à mão a partir das respostas (não
 * depende de nada de fora) ou proposto pela IA, quando ela está configurada.
 * Os dois terminam na mesma revisão antes de virar PDI.
 */
function BotoesDoPlano() {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col items-end">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="submit"
          name="modo"
          value="MAO"
          disabled={pending}
          className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? "Gravando…" : "Montar o plano à mão"}
        </button>
        <button
          type="submit"
          name="modo"
          value="IA"
          disabled={pending}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
        >
          <Sparkles size={15} />
          Pedir proposta à IA
        </button>
      </div>
      {pending ? (
        <p className="mt-2 max-w-xs text-right text-xs text-slate-500">
          Com a IA costuma levar de um a três minutos. Não recarregue a página.
        </p>
      ) : null}
    </div>
  );
}

export default function SkillAssessment({
  employeeId,
  avaliacoes,
}: {
  employeeId: string;
  avaliacoes: { id: string; data: string; temPlano: boolean }[];
}) {
  const [aberto, setAberto] = useState(false);
  const [geracao, gerarAction] = useActionState<TecnicoState, FormData>(
    gerarPlanoTecnicoAction,
    {},
  );
  const [salvo, salvarAction] = useActionState<EquipeState, FormData>(
    salvarPlanoTecnico,
    {},
  );

  const [acoes, setAcoes] = useState<AcaoRevisao[] | null>(null);
  const [titulo, setTitulo] = useState("");
  const [objetivo, setObjetivo] = useState("");

  // Quando a IA responde, monta a lista editável para revisão.
  if (geracao.plano && acoes === null) {
    setAcoes(
      geracao.plano.acoes.map((a, i) => ({
        key: `acao-${i}`,
        title: a.title,
        description: a.description ?? "",
      })),
    );
    setTitulo(geracao.plano.titulo);
    setObjetivo(geracao.plano.objetivo);
  }

  const revisando = Boolean(geracao.plano) && !salvo.ok && acoes !== null;

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Treinamento técnico
          </h2>
          <p className="mt-0.5 max-w-xl text-xs leading-relaxed text-slate-500">
            A pessoa responde sobre o próprio trabalho e, a partir das lacunas
            que ela apontou, você monta o plano de desenvolvimento técnico — à
            mão ou com uma proposta da IA. O plano revisado vira um PDI.
          </p>
        </div>
        {!aberto && !revisando ? (
          <button
            type="button"
            onClick={() => setAberto(true)}
            className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            + Autoavaliação
          </button>
        ) : null}
      </div>

      {avaliacoes.length > 0 && !aberto && !revisando ? (
        <ul className="space-y-1.5">
          {avaliacoes.map((a) => (
            <li
              key={a.id}
              className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs"
            >
              <span className="text-slate-600">
                Autoavaliação de {a.data}
              </span>
              <span className="ml-auto text-slate-400">
                {a.temPlano ? "plano gerado" : "sem plano"}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {avaliacoes.length === 0 && !aberto && !revisando ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Nenhuma autoavaliação respondida ainda.
        </p>
      ) : null}

      {aberto && !revisando ? (
        <form action={gerarAction} className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />

          {PERGUNTAS.map((p) => (
            <Field key={p.campo} label={p.label} hint={p.hint}>
              <DictationTextarea name={p.campo} rows={2} />
            </Field>
          ))}

          <FormError message={geracao.error} />

          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setAberto(false)}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <BotoesDoPlano />
          </div>
        </form>
      ) : null}

      {revisando && geracao.plano && acoes ? (
        <div className="space-y-4">
          {geracao.plano.leitura ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm leading-relaxed text-slate-600">
              {geracao.plano.leitura}
            </p>
          ) : null}

          <Field label="Nome do plano">
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
            />
          </Field>

          <Field label="Objetivo">
            <Textarea
              rows={2}
              value={objetivo}
              onChange={(e) => setObjetivo(e.target.value)}
            />
          </Field>

          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Ações propostas
            </span>
            <ul className="space-y-2">
              {acoes.map((a, i) => (
                <li key={a.key} className="flex items-start gap-2">
                  <span className="mt-2 w-5 shrink-0 text-right text-xs text-slate-300">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <input
                      value={a.title}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAcoes((atual) =>
                          atual!.map((x) =>
                            x.key === a.key ? { ...x, title: v } : x,
                          ),
                        );
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                      aria-label={`Ação ${i + 1}`}
                    />
                    <input
                      value={a.description}
                      onChange={(e) => {
                        const v = e.target.value;
                        setAcoes((atual) =>
                          atual!.map((x) =>
                            x.key === a.key ? { ...x, description: v } : x,
                          ),
                        );
                      }}
                      placeholder="Como fazer (opcional)"
                      className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs outline-none transition focus:border-brand-500"
                      aria-label={`Detalhe da ação ${i + 1}`}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setAcoes((atual) =>
                        atual!.filter((x) => x.key !== a.key),
                      )
                    }
                    className="mt-1.5 shrink-0 text-slate-300 transition hover:text-red-600"
                    aria-label={`Descartar ação ${i + 1}`}
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
            <button
              type="button"
              onClick={() =>
                setAcoes((atual) => [
                  ...(atual ?? []),
                  { key: `nova-${Date.now()}`, title: "", description: "" },
                ])
              }
              className="mt-2 text-xs text-brand-700 transition hover:text-brand-800"
            >
              + Acrescentar ação
            </button>
          </div>

          <form action={salvarAction} className="flex justify-end">
            <input type="hidden" name="employeeId" value={employeeId} />
            <input
              type="hidden"
              name="assessmentId"
              value={geracao.assessmentId ?? ""}
            />
            <input type="hidden" name="title" value={titulo} />
            <input type="hidden" name="objective" value={objetivo} />
            <input
              type="hidden"
              name="acoes"
              value={JSON.stringify(
                acoes.map((a) => ({
                  title: a.title,
                  description: a.description || undefined,
                })),
              )}
            />
            <SubmitButton pendingLabel="Salvando…">
              Salvar como PDI
            </SubmitButton>
          </form>

          <FormError message={salvo.error} />
        </div>
      ) : null}
    </section>
  );
}
