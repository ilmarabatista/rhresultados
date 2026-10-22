"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { revisarTexto } from "@/app/(app)/empresas/[id]/clima/actions";
import { Painel, Vazio } from "./ui";
import { avisarSeErro } from "./avisos";

/**
 * As respostas abertas, para revisar antes do relatório: tirar um nome, um
 * setor de uma pessoa só, qualquer coisa que entregue quem escreveu. O texto
 * original continua guardado; o relatório usa o revisado, e pula o que foi
 * marcado para ficar de fora.
 */

export type TextoParaRevisar = { id: string; texto: string; textoRevisado: string | null; ocultar: boolean };
export type GrupoDeTextos = { pergunta: string; textos: TextoParaRevisar[] };

function Item({ t }: { t: TextoParaRevisar }) {
  const router = useRouter();
  const [texto, setTexto] = useState(t.textoRevisado ?? t.texto);
  const [ocultar, setOcultar] = useState(t.ocultar);
  const [salvo, setSalvo] = useState(false);
  const [pendente, start] = useTransition();
  const mudou = texto !== (t.textoRevisado ?? t.texto) || ocultar !== t.ocultar;

  return (
    <li className={`space-y-1.5 py-2.5 ${ocultar ? "opacity-60" : ""}`}>
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setSalvo(false);
        }}
        rows={Math.min(6, Math.max(2, Math.ceil(texto.length / 110)))}
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs leading-relaxed text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <div className="flex flex-wrap items-center justify-between gap-2 text-micro">
        <label className="flex items-center gap-1.5 text-slate-600">
          <input
            type="checkbox"
            checked={ocultar}
            onChange={(e) => {
              setOcultar(e.target.checked);
              setSalvo(false);
            }}
            className="accent-brand-600"
          />
          Deixar fora do relatório
        </label>
        <div className="flex items-center gap-2">
          {t.textoRevisado ? <span className="text-amber-700">revisado</span> : null}
          {texto !== t.texto ? (
            <button type="button" onClick={() => setTexto(t.texto)} className="text-slate-500 hover:text-brand-700">
              ver o original
            </button>
          ) : null}
          {salvo ? <span className="text-emerald-700">salvo</span> : null}
          {mudou ? (
            <button
              type="button"
              disabled={pendente}
              onClick={() =>
                start(async () => {
                  const r = await revisarTexto(t.id, texto, ocultar);
                  avisarSeErro(r);
                  if (r.ok) {
                    setSalvo(true);
                    router.refresh();
                  }
                })
              }
              className="rounded-md bg-brand-700 px-2.5 py-1 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
            >
              {pendente ? "Salvando…" : "Salvar"}
            </button>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export default function ClimaSugestoes({ grupos }: { grupos: GrupoDeTextos[] }) {
  if (grupos.every((g) => g.textos.length === 0)) return <Vazio>Nenhuma resposta aberta ainda.</Vazio>;
  return (
    <div className="space-y-3.5">
      {grupos.map((g) => (
        <Painel
          key={g.pergunta}
          titulo={g.pergunta}
          descricao={`${g.textos.length} respostas. Revise o que possa identificar alguém antes de levar ao relatório.`}
        >
          <ul className="divide-y divide-slate-100">
            {g.textos.map((t) => (
              <Item key={t.id} t={t} />
            ))}
          </ul>
        </Painel>
      ))}
    </div>
  );
}
