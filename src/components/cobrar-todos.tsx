"use client";

import { useState } from "react";
import { Bell } from "lucide-react";
import { linkDoWhatsApp, telefoneDoWhatsApp } from "@/lib/autoavaliacao";

/**
 * "Cobrar todos que não responderam": uma faixa com quem está devendo a
 * resposta e um botão só para cobrar todo mundo.
 *
 * O WhatsApp não deixa mandar em massa por um link, e o navegador só abre uma
 * aba por clique. Então o botão abre a conversa da primeira pessoa, já com o
 * recado, e vira "próximo": cada clique seguinte abre a da pessoa seguinte.
 */

export type ParaCobrar = { id: string; nome: string; telefone: string | null; mensagem: string };

const botaoWhats =
  "inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60";
const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50";

export default function CobrarTodos({
  pessoas,
  aoCobrar,
}: {
  pessoas: ParaCobrar[];
  /** Chamado a cada conversa aberta, para marcar a cobrança onde houver onde marcar. */
  aoCobrar?: (id: string) => void;
}) {
  const [fila, setFila] = useState<ParaCobrar[] | null>(null);
  const [cobrados, setCobrados] = useState<Set<string>>(() => new Set());

  if (pessoas.length === 0 && !fila) return null;

  const abrir = (p: ParaCobrar) => {
    window.open(linkDoWhatsApp(p.telefone, p.mensagem), "_blank", "noreferrer");
    setCobrados((atual) => new Set(atual).add(p.id));
    aoCobrar?.(p.id);
  };
  const faltam = pessoas.filter((p) => !cobrados.has(p.id));
  const comecar = () => {
    if (faltam.length === 0) return;
    setFila(faltam);
    abrir(faltam[0]);
  };
  const proximo = fila?.find((p) => !cobrados.has(p.id));
  const feitos = fila ? fila.length - fila.filter((p) => !cobrados.has(p.id)).length : 0;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2 text-sm">
      {!fila ? (
        <>
          <span className="min-w-0 flex-1 text-slate-700">
            {pessoas.length === 1 ? "1 pessoa ainda não respondeu." : `${pessoas.length} pessoas ainda não responderam.`}
            {cobrados.size > 0 ? ` ${pessoas.length - faltam.length} já cobrada(s) agora.` : ""}
          </span>
          <button type="button" className={botaoWhats} onClick={comecar} disabled={faltam.length === 0}>
            <Bell size={13} /> Cobrar todos que não responderam ({faltam.length})
          </button>
        </>
      ) : proximo ? (
        <>
          <span className="min-w-0 flex-1 text-slate-700">
            {feitos} de {fila.length} cobrados. Aperte enviar no WhatsApp e volte aqui. Próximo: <strong>{proximo.nome}</strong>
            {telefoneDoWhatsApp(proximo.telefone) ? "" : " (sem celular no cadastro, escolha o contato)"}.
          </span>
          <button type="button" className={botaoWhats} onClick={() => abrir(proximo)}>
            <Bell size={13} /> Cobrar {proximo.nome.split(" ")[0]}
          </button>
          <button type="button" className={botaoClaro} onClick={() => setFila(null)}>
            Parar
          </button>
        </>
      ) : (
        <>
          <span className="min-w-0 flex-1 text-slate-700">
            Pronto: a cobrança foi aberta no WhatsApp para {fila.length === 1 ? "1 pessoa" : `as ${fila.length} pessoas`}.
          </span>
          <button type="button" className={botaoClaro} onClick={() => setFila(null)}>
            Fechar
          </button>
        </>
      )}
    </div>
  );
}
