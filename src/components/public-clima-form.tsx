"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { responderClima, type RespostaClimaState } from "@/app/pesquisa/[token]/actions";
import { escala, porDimensao, type PerguntaAplicada, type PerguntaDePerfil } from "@/lib/clima";

/**
 * A pesquisa de clima no celular de quem responde: o perfil primeiro, depois
 * uma dimensão por tela, com a barra de progresso. Todas as telas ficam no
 * mesmo formulário (só escondidas), e o envio vai de uma vez no fim.
 *
 * Depois de enviar, o aparelho guarda só um aviso de "já respondeu", para a
 * pessoa não mandar duas vezes sem querer. Num aparelho dividido (o tablet da
 * fábrica), o próximo colaborador aperta "outra pessoa vai responder".
 */

const botaoPrimario =
  "rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60";
const botaoClaro =
  "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50";

function chaveLocal(token: string) {
  return `clima-respondida:${token}`;
}

function lerLocal(token: string): boolean {
  try {
    return window.localStorage.getItem(chaveLocal(token)) === "1";
  } catch {
    return false;
  }
}

function gravarLocal(token: string, valor: boolean) {
  try {
    if (valor) window.localStorage.setItem(chaveLocal(token), "1");
    else window.localStorage.removeItem(chaveLocal(token));
  } catch {
    // Sem armazenamento (aba anônima): o aviso só não aparece.
  }
}

function Escala({ pergunta }: { pergunta: PerguntaAplicada }) {
  const faixa = escala(pergunta)!;
  const notas = Array.from({ length: faixa.max - faixa.min + 1 }, (_, i) => faixa.min + i);
  return (
    <div>
      <div className={`grid gap-1 ${notas.length === 11 ? "grid-cols-11" : "grid-cols-10"}`}>
        {notas.map((n) => (
          <label key={n} className="cursor-pointer">
            <input type="radio" name={`p.${pergunta.id}`} value={n} className="peer sr-only" />
            <span className="flex h-10 items-center justify-center rounded-md border border-slate-300 bg-white text-sm tabular-nums text-slate-700 transition peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-checked:font-semibold peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-brand-300 hover:border-brand-400">
              {n}
            </span>
          </label>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-micro text-slate-500">
        <span>{pergunta.enps ? "Não recomendaria" : "Pouco"}</span>
        <span>{pergunta.enps ? "Recomendaria com certeza" : "Muito"}</span>
      </div>
    </div>
  );
}

function Opcoes({ pergunta }: { pergunta: PerguntaAplicada }) {
  const multipla = pergunta.tipo === "MULTIPLA";
  const max = multipla ? pergunta.maxEscolhas ?? pergunta.opcoes.length : 1;
  const [marcadas, setMarcadas] = useState<string[]>([]);
  return (
    <div className="space-y-1.5">
      {multipla && max < pergunta.opcoes.length ? (
        <p className="text-xs text-slate-500">Escolha até {max}.</p>
      ) : null}
      {pergunta.opcoes.map((o) => {
        const marcada = marcadas.includes(o);
        const bloqueada = multipla && !marcada && marcadas.length >= max;
        return (
          <label
            key={o}
            className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm transition ${
              marcada ? "border-brand-500 bg-brand-50 text-brand-900" : "border-slate-200 bg-white text-slate-700"
            } ${bloqueada ? "opacity-50" : "hover:border-brand-300"}`}
          >
            <input
              type={multipla ? "checkbox" : "radio"}
              name={`p.${pergunta.id}`}
              value={o}
              disabled={bloqueada}
              onChange={(e) =>
                setMarcadas((atual) =>
                  multipla ? (e.target.checked ? [...atual, o] : atual.filter((x) => x !== o)) : [o],
                )
              }
              className="accent-brand-600"
            />
            {o}
          </label>
        );
      })}
    </div>
  );
}

function Pergunta({ pergunta, numero }: { pergunta: PerguntaAplicada; numero: number }) {
  return (
    <fieldset className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm" data-pergunta={pergunta.id} data-tipo={pergunta.tipo}>
      <legend className="sr-only">{pergunta.enunciado}</legend>
      <p className="mb-3 text-sm font-medium leading-snug text-slate-900">
        <span className="mr-1.5 text-slate-400">{numero}.</span>
        {pergunta.enunciado}
      </p>
      {pergunta.tipo === "NOTA" ? (
        <Escala pergunta={pergunta} />
      ) : pergunta.tipo === "TEXTO" ? (
        <textarea
          name={`p.${pergunta.id}`}
          rows={4}
          maxLength={4000}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      ) : (
        <Opcoes pergunta={pergunta} />
      )}
    </fieldset>
  );
}

/** Confere se cada pergunta da tela foi respondida antes de passar adiante. */
function faltaNaTela(tela: HTMLElement | null): string | null {
  if (!tela) return null;
  for (const bloco of tela.querySelectorAll<HTMLElement>("[data-pergunta], [data-perfil]")) {
    const campos = bloco.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>("input, textarea");
    const respondida = [...campos].some((c) =>
      c instanceof HTMLTextAreaElement ? c.value.trim() !== "" : c.checked,
    );
    if (!respondida) {
      bloco.scrollIntoView({ behavior: "smooth", block: "center" });
      return "Responda todas as perguntas desta tela para continuar.";
    }
  }
  return null;
}

export default function PublicClimaForm({
  token,
  empresa,
  introducao,
  perfil,
  perguntas,
}: {
  token: string;
  empresa: string;
  introducao: string;
  perfil: PerguntaDePerfil[];
  perguntas: PerguntaAplicada[];
}) {
  const [state, action, enviando] = useActionState<RespostaClimaState, FormData>(responderClima, {});
  const [tela, setTela] = useState(0);
  const [aviso, setAviso] = useState<string | null>(null);
  const [jaRespondeu, setJaRespondeu] = useState(false);
  const telas = useRef<(HTMLElement | null)[]>([]);
  const topo = useRef<HTMLDivElement>(null);

  const grupos = porDimensao(perguntas);
  const total = grupos.length + 1;
  const numeros = new Map(perguntas.map((p, i) => [p.id, i + 1]));

  useEffect(() => setJaRespondeu(lerLocal(token)), [token]);
  useEffect(() => {
    if (state.ok) gravarLocal(token, true);
  }, [state.ok, token]);
  useEffect(() => {
    if (state.error) setAviso(state.error);
  }, [state]);

  function ir(destino: number) {
    if (destino > tela) {
      const falta = faltaNaTela(telas.current[tela]);
      if (falta) return setAviso(falta);
    }
    setAviso(null);
    setTela(destino);
    topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (state.ok || jaRespondeu) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-fundo px-4 py-7">
        <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-slate-900">Obrigado por participar!</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">
            {state.ok
              ? "As suas respostas foram registradas de forma anônima."
              : "Uma resposta já foi enviada deste aparelho."}
          </p>
          <button
            type="button"
            onClick={() => {
              gravarLocal(token, false);
              window.location.reload();
            }}
            className="mt-5 text-xs text-brand-700 underline-offset-2 hover:underline"
          >
            Outra pessoa vai responder neste aparelho
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-fundo">
      <div ref={topo} className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
        <header className="mb-4">
          <p className="text-xs uppercase tracking-[0.12em] text-brand-600">{empresa}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">Pesquisa de clima</h1>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200" aria-hidden>
            <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${((tela + 1) / total) * 100}%` }} />
          </div>
          <p className="mt-1 text-micro text-slate-500">
            Parte {tela + 1} de {total}
          </p>
        </header>

        {/* Envio pelo onSubmit, e não pelo action do form: o React limpa o
            formulário depois de um action, e um erro do servidor apagaria
            todas as respostas. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const falta = faltaNaTela(telas.current[tela]);
            if (falta) return setAviso(falta);
            const dados = new FormData(e.currentTarget);
            startTransition(() => action(dados));
          }}
          className="space-y-3"
        >
          <input type="hidden" name="token" value={token} />

          <section ref={(el) => { telas.current[0] = el; }} hidden={tela !== 0} className="space-y-3">
            <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 shadow-sm">
              {introducao.split(/\r?\n/).filter(Boolean).map((linha, i) => (
                <p key={i} className={i ? "mt-2" : ""}>{linha}</p>
              ))}
              <p className="mt-2 text-xs text-slate-500">Todas as perguntas são obrigatórias. Escolha a resposta que mais combina com você.</p>
            </div>
            {perfil.map((p) => (
              <fieldset key={p.chave} data-perfil={p.chave} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <legend className="sr-only">{p.rotulo}</legend>
                <p className="mb-2.5 text-sm font-medium text-slate-900">{p.rotulo}</p>
                <div className="space-y-1.5">
                  {p.opcoes.map((o) => (
                    <label key={o} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:border-brand-300 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
                      <input type="radio" name={`perfil.${p.chave}`} value={o} className="accent-brand-600" />
                      {o}
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </section>

          {grupos.map((g, i) => (
            <section key={g.dimensao} ref={(el) => { telas.current[i + 1] = el; }} hidden={tela !== i + 1} className="space-y-3">
              <h2 className="text-micro font-semibold uppercase tracking-wider text-brand-700">{g.dimensao}</h2>
              {g.perguntas.map((p) => (
                <Pergunta key={p.id} pergunta={p} numero={numeros.get(p.id) ?? 0} />
              ))}
            </section>
          ))}

          {aviso ? (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {aviso}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-1">
            {tela > 0 ? (
              <button type="button" onClick={() => ir(tela - 1)} className={botaoClaro}>
                Voltar
              </button>
            ) : (
              <span />
            )}
            {tela < total - 1 ? (
              <button type="button" onClick={() => ir(tela + 1)} className={botaoPrimario}>
                Continuar
              </button>
            ) : (
              <button type="submit" disabled={enviando} className={botaoPrimario}>
                {enviando ? "Enviando…" : "Enviar respostas"}
              </button>
            )}
          </div>
        </form>
      </div>
    </main>
  );
}
