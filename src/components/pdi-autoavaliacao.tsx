"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Trash2 } from "lucide-react";
import {
  enviarAutoavaliacao,
  excluirAutoavaliacao,
  levarParaAvaliacao,
  reabrirAutoavaliacao,
  type AutoavaliacaoState,
} from "@/app/(app)/empresas/[id]/pdi/autoavaliacoes/actions";
import {
  emSecoes,
  linkDoWhatsApp,
  mensagemDoLink,
  opcaoDaResposta,
  pedeAtencao,
  resumoDaAutoavaliacao,
  SECAO_DO_TIPO,
  type PerguntaEnviada,
  type Respostas,
} from "@/lib/autoavaliacao";
import { Field, FormError, Input, Select, SubmitButton } from "./form";
import { Etiqueta } from "./ui";
import { copiarLink, linkDaAutoavaliacao, SituacaoDoEnvio } from "./autoavaliacao-modelos";
import { avisar, confirmar } from "@/components/avisos";

/**
 * O passo da autoavaliação no PDI da pessoa: gerar o link, ver as respostas e
 * montar com elas a avaliação do PDI, que o RH completa internamente.
 */

export type AutoavaliacaoDaTela = {
  id: string;
  token: string;
  titulo: string;
  status: string;
  enviadoEm: string;
  respondidoEm: string | null;
  prazo: string | null;
  atrasado: boolean;
  avaliacaoId: string | null;
  perguntas: PerguntaEnviada[];
  respostas: Respostas;
};

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function NovoLink({
  employeeId,
  nome,
  telefone,
  modelos,
  sugerido,
  companyId,
}: {
  employeeId: string;
  nome: string;
  telefone: string | null;
  modelos: { id: string; nome: string; perguntas: number }[];
  sugerido: string;
  companyId: string;
}) {
  const [state, action] = useActionState<AutoavaliacaoState, FormData>(enviarAutoavaliacao, {});
  const [link, setLink] = useState("");
  useEffect(() => {
    if (state.ok && state.token) setLink(linkDaAutoavaliacao(state.token));
  }, [state]);

  if (modelos.length === 0) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        A empresa ainda não tem modelo de autoavaliação.{" "}
        <Link href={`/empresas/${companyId}/pdi/autoavaliacoes`} className="font-medium underline">
          Criar o modelo da função
        </Link>
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Modelo">
          <Select name="modeloId" defaultValue={sugerido}>
            {modelos.map((m) => (
              <option key={m.id} value={m.id} disabled={m.perguntas === 0}>
                {m.nome}
                {m.perguntas === 0 ? " (sem perguntas)" : ""}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Responder até">
          <Input name="prazo" type="date" />
        </Field>
        <SubmitButton pendingLabel="Gerando…">Gerar link</SubmitButton>
      </div>
      <FormError message={state.error} />
      {link ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="min-w-0 flex-1 truncate">{link}</span>
          <button type="button" onClick={() => copiarLink(state.token!)} className={botaoClaro}>
            <Copy size={13} /> Copiar link
          </button>
          <a
            href={linkDoWhatsApp(telefone, mensagemDoLink(nome, link))}
            target="_blank"
            rel="noreferrer"
            className={botaoClaro}
          >
            Mandar no WhatsApp
          </a>
        </div>
      ) : null}
    </form>
  );
}

function AsRespostas({ a }: { a: AutoavaliacaoDaTela }) {
  return (
    <div className="space-y-3 border-t border-slate-100 px-3 py-3">
      {emSecoes(a.perguntas).map((s) => (
        <div key={s.tipo}>
          <h4 className="mb-1 text-micro font-medium uppercase tracking-wider text-slate-500">{SECAO_DO_TIPO[s.tipo].titulo}</h4>
          {s.tipo === "ABERTA" ? (
            <dl className="space-y-2">
              {s.perguntas.map((p) => (
                <div key={p.id}>
                  <dt className="text-xs font-medium text-slate-700">{p.texto}</dt>
                  <dd className="whitespace-pre-line text-sm text-slate-600">{a.respostas[p.id] || "—"}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-md border border-slate-100">
              {s.perguntas.map((p) => {
                const o = opcaoDaResposta(p, a.respostas[p.id]);
                const atencao = pedeAtencao(p, a.respostas[p.id]);
                return (
                  <li key={p.id} className={`flex items-start gap-3 px-2 py-1 text-sm ${atencao ? "bg-amber-50/70" : ""}`}>
                    <span className="min-w-0 flex-1 text-slate-700">{p.texto}</span>
                    <span className={`shrink-0 text-right text-xs ${atencao ? "font-semibold text-amber-800" : "text-slate-500"}`}>
                      {o ? (s.tipo === "TECNICA" || s.tipo === "COMPORTAMENTAL" ? `${o.valor} · ${o.rotulo}` : o.rotulo) : "—"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default function PdiAutoavaliacao({
  companyId,
  employeeId,
  nome,
  telefone,
  modelos,
  sugerido,
  autoavaliacoes,
}: {
  companyId: string;
  employeeId: string;
  nome: string;
  telefone: string | null;
  modelos: { id: string; nome: string; perguntas: number }[];
  sugerido: string;
  autoavaliacoes: AutoavaliacaoDaTela[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const respondida = autoavaliacoes.find((a) => a.status === "RESPONDIDO");
  const [aberto, setAberto] = useState<string | null>(respondida && !respondida.avaliacaoId ? respondida.id : null);
  const [gerando, setGerando] = useState(autoavaliacoes.length === 0);

  const fazer = (acao: () => Promise<AutoavaliacaoState>, depois?: (r: AutoavaliacaoState) => void) =>
    startTransition(async () => {
      const r = await acao();
      if (r.error) avisar(r.error);
      else depois?.(r);
    });

  return (
    <section id="autoavaliacao" className={`rounded-lg border border-slate-200 bg-white p-4 ${pending ? "opacity-60" : ""}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            <span className="mr-1.5 text-brand-600">2</span>Autoavaliação
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            A pessoa responde pelo link, no celular. Com as respostas, monte a avaliação: cada item entra com a nota
            dela, e o que ficou abaixo do padrão já aparece como gap. O PDI ela não vê pelo sistema: é apresentado na
            conversa 1 a 1.
          </p>
        </div>
        {!gerando ? (
          <button type="button" onClick={() => setGerando(true)} className={botaoClaro}>
            Gerar novo link
          </button>
        ) : null}
      </div>

      <div className="space-y-3">
        {gerando ? (
          <NovoLink employeeId={employeeId} nome={nome} telefone={telefone} modelos={modelos} sugerido={sugerido} companyId={companyId} />
        ) : null}

        {autoavaliacoes.length > 0 ? (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {autoavaliacoes.map((a) => {
              const resumo = resumoDaAutoavaliacao(a.perguntas, a.respostas);
              return (
                <li key={a.id}>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3 py-2">
                    <div className="min-w-[12rem] flex-1">
                      <span className="text-sm font-medium text-slate-800">{a.titulo}</span>
                      <span className="block text-micro text-slate-500">
                        enviada em {a.enviadoEm}
                        {a.prazo ? ` · prazo ${a.prazo}` : ""}
                        {a.respondidoEm ? ` · respondida em ${a.respondidoEm}` : ""}
                        {a.status === "ENVIADO" && resumo.respondidos > 0
                          ? ` · ${resumo.respondidos}/${resumo.itens} marcados até agora`
                          : ""}
                      </span>
                    </div>
                    <SituacaoDoEnvio e={{ status: a.status, atrasado: a.atrasado, montada: Boolean(a.avaliacaoId) }} />
                    {a.status === "RESPONDIDO" && resumo.atencao > 0 ? (
                      <Etiqueta tom="atencao">{resumo.atencao} abaixo do padrão</Etiqueta>
                    ) : null}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {a.status === "RESPONDIDO" ? (
                        <>
                          <button type="button" className={botaoClaro} onClick={() => setAberto(aberto === a.id ? null : a.id)}>
                            {aberto === a.id ? "Fechar" : "Ver respostas"}
                          </button>
                          {a.avaliacaoId ? (
                            <Link href={`?avaliacao=${a.avaliacaoId}#avaliacao`} scroll={false} className={botaoClaro}>
                              Ver a avaliação
                            </Link>
                          ) : (
                            <button
                              type="button"
                              className="rounded-lg bg-brand-600 px-3 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700"
                              onClick={() =>
                                fazer(
                                  () => levarParaAvaliacao(a.id),
                                  (r) => r.id && router.push(`?avaliacao=${r.id}#avaliacao`),
                                )
                              }
                            >
                              Montar a avaliação do PDI →
                            </button>
                          )}
                          <button
                            type="button"
                            className={botaoClaro}
                            onClick={async () => {
                              if (await confirmar(`Reabrir o link para ${nome.split(/\s+/)[0]} corrigir as respostas?`))
                                fazer(() => reabrirAutoavaliacao(a.id));
                            }}
                          >
                            Reabrir
                          </button>
                        </>
                      ) : (
                        <>
                          <a
                            href={linkDoWhatsApp(telefone, mensagemDoLink(nome, linkDaAutoavaliacao(a.token)))}
                            target="_blank"
                            rel="noreferrer"
                            className={botaoClaro}
                          >
                            WhatsApp
                          </a>
                          <button type="button" className={botaoClaro} onClick={() => copiarLink(a.token)}>
                            <Copy size={13} /> Copiar link
                          </button>
                        </>
                      )}
                      <button
                        type="button"
                        className="p-1 text-slate-400 hover:text-red-600"
                        aria-label="Excluir a autoavaliação"
                        onClick={async () => {
                          const aviso = a.avaliacaoId
                            ? "Excluir esta autoavaliação? A avaliação montada com ela continua."
                            : "Excluir esta autoavaliação? As respostas somem e o link para de funcionar.";
                          if (await confirmar(aviso)) fazer(() => excluirAutoavaliacao(a.id));
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {aberto === a.id ? <AsRespostas a={a} /> : null}
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
