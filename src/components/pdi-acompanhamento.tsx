"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import {
  excluirConversa,
  marcarProximaConversa,
  registrarConversa,
  type PdiState,
} from "@/app/(app)/empresas/[id]/pdi/actions";
import {
  lerStatusDaMeta,
  ROTULO_DA_META,
  STATUS_DA_META,
  statusPeloProgresso,
  TOM_DA_META,
  type SituacaoDaConversa,
  type StatusDaMeta,
} from "@/lib/pdi";
import { Field, FormError, Input, SubmitButton, Textarea } from "./form";
import { Aviso, Etiqueta } from "./ui";
import { avisar, confirmar } from "@/components/avisos";

/**
 * O acompanhamento do plano: a próxima conversa (que está na agenda) e o
 * registro de cada conversa, com onde cada meta ficou. É a linha do tempo do
 * PDI.
 */

export type ConversaDaTela = {
  id: string;
  data: string;
  resumo: string;
  combinados: string;
  autor: string | null;
  progressos: { metaTitulo: string; progresso: number; status: string; comentario: string }[];
};

type MetaResumida = {
  id: string;
  titulo: string;
  status: string;
  progresso: number;
  /** O quanto as ações da meta já foram feitas: a sugestão de progresso. */
  execucao: number | null;
};

const botaoClaro =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function ProximaConversa({
  planId,
  dia,
  hora,
  situacao,
}: {
  planId: string;
  dia: string;
  hora: string;
  situacao: SituacaoDaConversa;
}) {
  const [pending, startTransition] = useTransition();
  const [d, setD] = useState(dia);
  const [h, setH] = useState(hora || "09:00");
  useEffect(() => {
    setD(dia);
    setH(hora || "09:00");
  }, [dia, hora]);

  return (
    <div
      className={`flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 ${
        situacao === "ATRASADA" ? "bg-red-50" : situacao === "SEM_DATA" ? "bg-amber-50" : "bg-slate-50"
      } ${pending ? "opacity-60" : ""}`}
    >
      <span className="text-sm font-medium text-slate-700">Próxima conversa</span>
      {situacao === "ATRASADA" ? <Etiqueta tom="ruim">atrasada</Etiqueta> : null}
      {situacao === "SEM_DATA" ? <Etiqueta tom="atencao">sem data</Etiqueta> : null}
      <input type="date" value={d} onChange={(e) => setD(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
      <input type="time" value={h} onChange={(e) => setH(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
      <button
        type="button"
        disabled={pending || (d === dia && h === hora)}
        onClick={() =>
          startTransition(async () => {
            const r = await marcarProximaConversa(planId, d, h);
            if (r.error) avisar(r.error);
          })
        }
        className={botaoClaro}
      >
        {dia ? "Remarcar" : "Marcar na agenda"}
      </button>
      {dia ? (
        <button
          type="button"
          onClick={() =>
            startTransition(async () => {
              const r = await marcarProximaConversa(planId, "", "");
              if (r.error) avisar(r.error);
            })
          }
          className="text-xs text-slate-500 hover:text-red-600"
        >
          desmarcar
        </button>
      ) : null}
      <span className="text-micro text-slate-500">Fica na agenda da empresa como “PDI: conversa com…”.</span>
    </div>
  );
}

function NovaConversa({
  planId,
  metas,
  hoje,
  sugestaoProxima,
  onClose,
}: {
  planId: string;
  metas: MetaResumida[];
  hoje: string;
  sugestaoProxima: string;
  onClose: () => void;
}) {
  const [state, action] = useActionState<PdiState, FormData>(registrarConversa, {});
  const [progressos, setProgressos] = useState(
    metas.map((m) => ({
      metaId: m.id,
      titulo: m.titulo,
      // Parte do que as ações já andaram, se for mais do que a última conversa disse.
      progresso: m.status === "ATINGIDA" ? 100 : Math.max(m.progresso, m.execucao ?? 0),
      execucao: m.execucao,
      status: lerStatusDaMeta(m.status),
      comentario: "",
      mexeuNoStatus: false,
    })),
  );
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);

  function muda(i: number, dados: Partial<(typeof progressos)[number]>) {
    setProgressos((atual) =>
      atual.map((p, j) => {
        if (j !== i) return p;
        const novo = { ...p, ...dados };
        // O status acompanha o progresso, até ela escolher outro à mão.
        if (dados.progresso !== undefined && !p.mexeuNoStatus) novo.status = statusPeloProgresso(p.status, novo.progresso);
        return novo;
      }),
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-3">
      <input type="hidden" name="planId" value={planId} />
      <input
        type="hidden"
        name="progressos"
        value={JSON.stringify(progressos.map(({ metaId, progresso, status, comentario }) => ({ metaId, progresso, status, comentario })))}
      />
      <div className="grid gap-3 sm:grid-cols-[10rem_minmax(0,1fr)]">
        <Field label="Dia *">
          <Input name="data" type="date" required defaultValue={hoje} />
        </Field>
        <Field label="O que foi conversado *" hint="Avanços, dificuldades, exemplos concretos do período.">
          <Textarea name="resumo" rows={3} required />
        </Field>
      </div>

      {progressos.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium text-slate-700">Onde cada meta está</p>
          {progressos.map((p, i) => (
            <div key={p.metaId} className="rounded-md bg-white p-2.5">
              <p className="text-corpo font-medium text-slate-800">
                {p.titulo}
                {p.execucao != null ? (
                  <span className="ml-2 text-micro font-normal text-slate-500">ações: {p.execucao}% feito</span>
                ) : null}
              </p>
              <div className="mt-1.5 grid items-center gap-2 sm:grid-cols-[minmax(0,1fr)_3rem_10rem]">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={p.progresso}
                  onChange={(e) => muda(i, { progresso: Number(e.target.value) })}
                  className="accent-brand-600"
                  aria-label={`Progresso: ${p.titulo}`}
                />
                <span className="text-right text-sm font-semibold tabular-nums text-brand-800">{p.progresso}%</span>
                <select
                  value={p.status}
                  onChange={(e) => muda(i, { status: e.target.value as StatusDaMeta, mexeuNoStatus: true })}
                  className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                  aria-label="Situação da meta"
                >
                  {STATUS_DA_META.map((s) => (
                    <option key={s} value={s}>
                      {ROTULO_DA_META[s]}
                    </option>
                  ))}
                </select>
              </div>
              <input
                value={p.comentario}
                onChange={(e) => muda(i, { comentario: e.target.value })}
                placeholder="Comentário sobre esta meta (opcional)"
                className="mt-1.5 w-full rounded-md border border-slate-200 px-2 py-1 text-mini"
              />
            </div>
          ))}
        </div>
      ) : null}

      <Field label="Combinados até a próxima conversa">
        <Textarea name="combinados" rows={2} />
      </Field>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="Próxima conversa">
          <Input name="proximaDia" type="date" defaultValue={sugestaoProxima} />
        </Field>
        <Field label="Hora">
          <Input name="proximaHora" type="time" defaultValue="09:00" />
        </Field>
        <span className="pb-2 text-micro text-slate-500">Vai para a agenda. Deixe vazio para não marcar.</span>
      </div>
      <FormError message={state.error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={botaoClaro}>
          Cancelar
        </button>
        <SubmitButton pendingLabel="Registrando…">Registrar conversa</SubmitButton>
      </div>
    </form>
  );
}

export default function PdiAcompanhamento({
  planId,
  aberto,
  metas,
  conversas,
  proximaDia,
  proximaHora,
  situacao,
  hoje,
}: {
  planId: string | null;
  aberto: boolean;
  metas: MetaResumida[];
  conversas: ConversaDaTela[];
  proximaDia: string;
  proximaHora: string;
  situacao: SituacaoDaConversa;
  hoje: string;
}) {
  const [registrando, setRegistrando] = useState(false);
  const [pending, startTransition] = useTransition();
  const umMes = (() => {
    const d = new Date(`${hoje}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + 30);
    return d.toISOString().slice(0, 10);
  })();

  return (
    <section id="acompanhamento" className={`rounded-lg border border-slate-200 bg-white p-4 ${pending ? "opacity-60" : ""}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            <span className="mr-1.5 text-brand-600">5</span>Acompanhamento
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Uma conversa por mês costuma bastar. Em cada uma, registre o que avançou e onde cada meta está — o
            progresso das metas e do plano sai daqui.
          </p>
        </div>
        {planId && aberto && !registrando ? (
          <button
            type="button"
            onClick={() => setRegistrando(true)}
            className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            Registrar conversa
          </button>
        ) : null}
      </div>

      {!planId ? (
        <p className="text-sm text-slate-500">O acompanhamento começa quando o plano existe.</p>
      ) : (
        <div className="space-y-3">
          {aberto ? <ProximaConversa planId={planId} dia={proximaDia} hora={proximaHora} situacao={situacao} /> : null}
          {aberto && metas.length === 0 ? (
            <Aviso>O plano ainda não tem metas: crie as metas no passo 4 antes da primeira conversa.</Aviso>
          ) : null}
          {registrando ? (
            <NovaConversa
              planId={planId}
              metas={metas}
              hoje={hoje}
              sugestaoProxima={umMes}
              onClose={() => setRegistrando(false)}
            />
          ) : null}

          {conversas.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
              Nenhuma conversa registrada ainda.
            </p>
          ) : (
            <ol className="space-y-2 border-l-2 border-slate-200 pl-4">
              {conversas.map((c) => (
                <li key={c.id} className="relative">
                  <span className="absolute -left-[21px] top-3.5 h-2 w-2 rounded-full bg-brand-500 ring-2 ring-white" />
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800">{c.data}</span>
                      {c.autor ? <span className="text-micro text-slate-500">por {c.autor}</span> : null}
                      <button
                        type="button"
                        onClick={async () => {
                          if (await confirmar("Excluir o registro desta conversa?"))
                            startTransition(async () => void (await excluirConversa(c.id)));
                        }}
                        className="ml-auto text-slate-300 hover:text-red-600"
                        aria-label="Excluir conversa"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{c.resumo}</p>
                    {c.progressos.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {c.progressos.map((p, i) => {
                          const s = lerStatusDaMeta(p.status);
                          return (
                            <li key={i} className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2 text-mini">
                              <span className="truncate text-slate-600" title={p.metaTitulo}>
                                {p.metaTitulo}
                                {p.comentario ? <span className="text-slate-500"> — {p.comentario}</span> : null}
                              </span>
                              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                                <div className="h-full rounded-full bg-brand-600" style={{ width: `${p.progresso}%` }} />
                              </div>
                              <span className="flex items-center gap-1.5">
                                <span className="w-8 text-right tabular-nums text-slate-500">{p.progresso}%</span>
                                <Etiqueta tom={TOM_DA_META[s]}>{ROTULO_DA_META[s]}</Etiqueta>
                              </span>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {c.combinados ? (
                      <p className="mt-2 whitespace-pre-wrap rounded-md bg-amber-50/70 px-2.5 py-1.5 text-mini text-amber-900">
                        <span className="mr-1 font-semibold">Combinados:</span>
                        {c.combinados}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </section>
  );
}
