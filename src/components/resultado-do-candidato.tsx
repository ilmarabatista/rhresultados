"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { salvarParecerFinal, sugerirParecer } from "@/app/(app)/selecao/actions";
import { avisar } from "./avisos";
import { FormError, Textarea } from "./form";
import { Painel } from "./ui";

/**
 * O parecer final da consultoria sobre o candidato: o fecho da pasta, que vai
 * junto quando ela imprime para o cliente. A IA pode escrever um rascunho a
 * partir da pasta; quem revisa, ajusta e salva é ela.
 */

const botao =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";
const botaoPrimario =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60";

export default function ParecerFinal({ candidatoId, salvo }: { candidatoId: string; salvo: string }) {
  const [texto, setTexto] = useState(salvo);
  const [erro, setErro] = useState<string>();
  const [salvando, iniciar] = useTransition();
  const [sugerindo, iniciarSugestao] = useTransition();
  const alterado = texto !== salvo;

  function sugerir() {
    if (texto.trim() && !confirm("Trocar o texto atual pelo rascunho da IA?")) return;
    setErro(undefined);
    iniciarSugestao(async () => {
      const r = await sugerirParecer(candidatoId);
      if (r.error || !r.parecer) setErro(r.error ?? "Não foi possível sugerir o parecer.");
      else {
        setTexto(r.parecer);
        avisar("Rascunho pronto. Leia, ajuste e salve.");
      }
    });
  }

  function salvar() {
    setErro(undefined);
    iniciar(async () => {
      const r = await salvarParecerFinal(candidatoId, texto);
      if (r.error) setErro(r.error);
      else avisar("Parecer salvo.");
    });
  }

  return (
    <Painel titulo="Parecer final" descricao="A conclusão da consultoria sobre o candidato. Escreva à mão ou peça um rascunho à IA, que lê a pasta inteira." className="break-inside-avoid">
      <Textarea rows={5} value={texto} onChange={(e) => setTexto(e.target.value)} className="text-mini print:hidden" />
      <p className="hidden whitespace-pre-line text-mini text-slate-700 print:block">{texto || "Sem parecer."}</p>
      <FormError message={erro} />
      <div className="no-print mt-2 flex flex-wrap items-center justify-end gap-2">
        <button type="button" className={`${botao} mr-auto`} disabled={sugerindo || salvando} onClick={sugerir}>
          <Sparkles className="h-4 w-4" /> {sugerindo ? "A IA está lendo a pasta…" : "Sugerir com IA"}
        </button>
        {alterado ? <span className="text-micro text-amber-700">Há mudanças não salvas.</span> : null}
        <button type="button" className={botaoPrimario} disabled={salvando || !alterado} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar parecer"}
        </button>
      </div>
    </Painel>
  );
}
