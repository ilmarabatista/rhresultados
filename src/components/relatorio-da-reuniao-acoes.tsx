"use client";

import { useState } from "react";
import { Copy, Printer } from "lucide-react";
import { linkDoWhatsApp } from "@/lib/autoavaliacao";

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50";

/**
 * Os jeitos de mandar o relatório: pelo WhatsApp (para o contato da empresa
 * ou para quem escolher), copiado, ou impresso / salvo em PDF.
 */
export default function RelatorioDaReuniaoAcoes({
  texto,
  contato,
}: {
  texto: string;
  /** O contato da gestão no cadastro da empresa, quando tem telefone. */
  contato: { nome: string | null; telefone: string } | null;
}) {
  const [copiado, setCopiado] = useState(false);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setCopiado(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {contato ? (
        <a
          href={linkDoWhatsApp(contato.telefone, texto)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700"
        >
          Mandar no WhatsApp{contato.nome ? ` para ${contato.nome.split(/\s+/)[0]}` : " para a gestão"}
        </a>
      ) : null}
      <a href={linkDoWhatsApp(null, texto)} target="_blank" rel="noreferrer" className={botaoClaro}>
        {contato ? "WhatsApp para outro contato" : "Mandar no WhatsApp"}
      </a>
      <button type="button" onClick={copiar} className={botaoClaro}>
        <Copy size={13} /> {copiado ? "Copiado!" : "Copiar texto"}
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
      >
        <Printer size={13} /> Imprimir / PDF
      </button>
    </div>
  );
}
