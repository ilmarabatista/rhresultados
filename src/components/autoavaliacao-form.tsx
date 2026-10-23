"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { enviarAutoavaliacao, guardarRascunho } from "@/app/autoavaliacao/[token]/actions";
import {
  conferirParaEnviar,
  emSecoes,
  LEGENDA_DA_ESCALA,
  OPCOES,
  SECAO_DO_TIPO,
  type PerguntaEnviada,
  type Respostas,
} from "@/lib/autoavaliacao";

/**
 * A autoavaliação no link, feita para o celular. Cada marcação é guardada
 * sozinha depois de uma pausa curta: a pessoa pode fechar e voltar pelo mesmo
 * link. Na nota de 1 a 4 aparece só o número, com a legenda no alto da seção.
 */

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

function Opcoes({
  p,
  valor,
  mudar,
}: {
  p: PerguntaEnviada & { tipo: keyof typeof OPCOES };
  valor: string | undefined;
  mudar: (v: string) => void;
}) {
  const opcoes = OPCOES[p.tipo];
  const escala = p.tipo === "TECNICA" || p.tipo === "COMPORTAMENTAL";
  return (
    <div
      role="radiogroup"
      aria-label={p.texto}
      className={`grid gap-1.5 ${escala ? "grid-cols-4" : opcoes.length === 4 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}
    >
      {opcoes.map((o) => {
        const marcada = valor === o.valor;
        return (
          <button
            key={o.valor}
            type="button"
            role="radio"
            aria-checked={marcada}
            title={o.rotulo}
            onClick={() => mudar(o.valor)}
            className={`rounded-lg border px-2 py-2 text-sm transition ${
              marcada
                ? "border-brand-600 bg-brand-600 font-semibold text-white"
                : "border-slate-300 bg-white text-slate-700 hover:border-brand-400"
            }`}
          >
            {escala ? o.valor : o.rotulo}
          </button>
        );
      })}
    </div>
  );
}

export default function AutoavaliacaoForm({
  token,
  instrucoes,
  perguntas,
  iniciais,
}: {
  token: string;
  instrucoes: string;
  perguntas: PerguntaEnviada[];
  iniciais: Respostas;
}) {
  const [respostas, setRespostas] = useState<Respostas>(iniciais);
  const [situacao, setSituacao] = useState<"" | "guardando" | "guardado" | "erro">("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, startTransition] = useTransition();
  const mudou = useRef(false);

  useEffect(() => {
    if (!mudou.current || enviado) return;
    const espera = setTimeout(async () => {
      setSituacao("guardando");
      const r = await guardarRascunho(token, JSON.stringify(respostas));
      setSituacao(r.error ? "erro" : "guardado");
    }, 1500);
    return () => clearTimeout(espera);
  }, [respostas, token, enviado]);

  if (enviado) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <h2 className="text-lg font-semibold text-emerald-900">Autoavaliação enviada</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800">
          Obrigado! As suas respostas são o ponto de partida do seu plano de desenvolvimento.
        </p>
      </div>
    );
  }

  const mudar = (id: string, v: string) => {
    mudou.current = true;
    setRespostas((atual) => ({ ...atual, [id]: v }));
  };

  const marcar = perguntas.filter((p) => p.tipo !== "ABERTA");
  const marcadas = marcar.filter((p) => respostas[p.id]).length;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErro("");
        const falta = conferirParaEnviar(perguntas, respostas);
        if (falta) {
          setErro(`${falta} Os itens sem marcação estão destacados.`);
          document.querySelector("[data-falta='sim']")?.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
        startTransition(async () => {
          const r = await enviarAutoavaliacao(token, JSON.stringify(respostas));
          if (r.error) setErro(r.error);
          else setEnviado(true);
        });
      }}
      className="space-y-4"
    >
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 shadow-sm">
        {instrucoes}
      </p>

      {emSecoes(perguntas).map((s, n) => {
        const info = SECAO_DO_TIPO[s.tipo];
        const escala = s.tipo === "TECNICA" || s.tipo === "COMPORTAMENTAL";
        return (
          <section key={s.tipo} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-slate-900">
              {n + 1}. {info.titulo}
            </h2>
            {escala ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{LEGENDA_DA_ESCALA}</p> : null}
            {info.ajuda ? <p className="mt-1 text-xs leading-relaxed text-slate-500">{info.ajuda}</p> : null}
            <div className="mt-3 space-y-4">
              {s.perguntas.map((p) => {
                const falta = erro && p.tipo !== "ABERTA" && !respostas[p.id];
                return (
                  <div
                    key={p.id}
                    data-falta={falta ? "sim" : undefined}
                    className={falta ? "-mx-2 rounded-lg bg-amber-50 px-2 py-1.5 ring-1 ring-amber-300" : ""}
                  >
                    <p className="mb-1.5 text-sm text-slate-800">{p.texto}</p>
                    {p.tipo === "ABERTA" ? (
                      <textarea
                        value={respostas[p.id] ?? ""}
                        onChange={(e) => mudar(p.id, e.target.value)}
                        rows={3}
                        className={campo}
                        aria-label={p.texto}
                      />
                    ) : (
                      <Opcoes p={p as PerguntaEnviada & { tipo: keyof typeof OPCOES }} valor={respostas[p.id]} mudar={(v) => mudar(p.id, v)} />
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {erro ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-fundo/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <span className="mr-auto text-xs text-slate-500" aria-live="polite">
          {marcadas}/{marcar.length} marcados
          {situacao === "guardando"
            ? " · guardando…"
            : situacao === "guardado"
              ? " · guardado, pode continuar depois pelo mesmo link"
              : situacao === "erro"
                ? " · não deu para guardar agora"
                : ""}
        </span>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar"}
        </button>
      </div>
    </form>
  );
}
