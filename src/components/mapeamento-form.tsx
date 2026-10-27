"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { enviarMapeamento, guardarMapeamento } from "@/app/mapeamento/[token]/actions";
import { conferirMapeamento, type DadosDoMapeamento } from "@/lib/mapeamento";
import MapeamentoSecoes from "./mapeamento-secoes";

/**
 * O mapeamento de rotinas no link da pessoa, feito para o celular. Cada
 * mudança é guardada sozinha depois de uma pausa: a pessoa pode fechar e
 * voltar pelo mesmo link. As observações do RH não aparecem aqui.
 */
export default function MapeamentoForm({ token, iniciais }: { token: string; iniciais: DadosDoMapeamento }) {
  const [d, setD] = useState(iniciais);
  const [situacao, setSituacao] = useState<"" | "guardando" | "guardado" | "erro">("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, startTransition] = useTransition();
  const mudou = useRef(false);

  useEffect(() => {
    if (!mudou.current || enviado) return;
    const espera = setTimeout(async () => {
      setSituacao("guardando");
      const r = await guardarMapeamento(token, JSON.stringify(d));
      setSituacao(r.error ? "erro" : "guardado");
    }, 1500);
    return () => clearTimeout(espera);
  }, [d, token, enviado]);

  if (enviado) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <h2 className="text-lg font-semibold text-emerald-900">Mapeamento enviado</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800">
          Obrigado! O RH vai ler o que você contou e conversar com você sobre a sua rotina.
        </p>
      </div>
    );
  }

  function muda<K extends keyof DadosDoMapeamento>(campo: K, valor: DadosDoMapeamento[K]) {
    mudou.current = true;
    setD((atual) => ({ ...atual, [campo]: valor }));
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErro("");
        const falta = conferirMapeamento(d);
        if (falta) return setErro(falta);
        startTransition(async () => {
          const r = await enviarMapeamento(token, JSON.stringify(d));
          if (r.error) setErro(r.error);
          else setEnviado(true);
        });
      }}
      className="space-y-4"
    >
      <p className="rounded-lg border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-600 shadow-sm">
        Conte como é o seu trabalho, do jeito que você explicaria para alguém que vai começar na sua função. Não existe
        resposta certa: queremos entender a sua rotina para organizar os processos e o seu desenvolvimento. Escreva com as
        suas palavras, sem pressa. O que você escrever fica guardado, e você pode voltar depois pelo mesmo link.
      </p>

      <MapeamentoSecoes d={d} muda={muda} publico />

      {erro ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

      <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 bg-fundo/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0">
        <span className="mr-auto text-xs text-slate-500" aria-live="polite">
          {d.tarefas.length} tarefa(s)
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
