"use client";

import { useState, useTransition } from "react";
import { salvarParecerFinal } from "@/app/(app)/selecao/actions";
import { avisar } from "./avisos";
import { FormError, Textarea } from "./form";
import { Painel } from "./ui";

/**
 * O parecer final da consultoria sobre o candidato: o fecho da pasta, que vai
 * junto quando ela imprime para o cliente.
 */

const botaoPrimario =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60";

export default function ParecerFinal({ candidatoId, salvo }: { candidatoId: string; salvo: string }) {
  const [texto, setTexto] = useState(salvo);
  const [erro, setErro] = useState<string>();
  const [salvando, iniciar] = useTransition();
  const alterado = texto !== salvo;

  function salvar() {
    setErro(undefined);
    iniciar(async () => {
      const r = await salvarParecerFinal(candidatoId, texto);
      if (r.error) setErro(r.error);
      else avisar("Parecer salvo.");
    });
  }

  return (
    <Painel titulo="Parecer final" descricao="A conclusão da consultoria sobre o candidato, com base em tudo o que está na pasta." className="break-inside-avoid">
      <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} className="text-mini print:hidden" />
      <p className="hidden whitespace-pre-line text-mini text-slate-700 print:block">{texto || "Sem parecer."}</p>
      <FormError message={erro} />
      <div className="no-print mt-2 flex items-center justify-end gap-2">
        {alterado ? <span className="text-micro text-amber-700">Há mudanças não salvas.</span> : null}
        <button type="button" className={botaoPrimario} disabled={salvando || !alterado} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar parecer"}
        </button>
      </div>
    </Painel>
  );
}
