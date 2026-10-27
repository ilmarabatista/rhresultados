"use client";

import { Copy } from "lucide-react";
import { linkDoWhatsApp } from "@/lib/autoavaliacao";
import { mensagemDoMapeamento } from "@/lib/mapeamento";
import { avisar } from "@/components/avisos";

/** Os botões do link do mapeamento: mandar no WhatsApp da pessoa e copiar. */

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50";

export function linkDoMapeamentoNaTela(token: string) {
  return `${window.location.origin}/mapeamento/${token}`;
}

export default function BotoesDoLink({ token, nome, telefone }: { token: string; nome: string; telefone: string | null }) {
  async function copiar() {
    const link = linkDoMapeamentoNaTela(token);
    try {
      await navigator.clipboard.writeText(link);
      avisar("Link copiado.");
    } catch {
      avisar(link);
    }
  }

  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <button
        type="button"
        className={botaoClaro}
        onClick={() => window.open(linkDoWhatsApp(telefone, mensagemDoMapeamento(nome, linkDoMapeamentoNaTela(token))), "_blank")}
      >
        WhatsApp
      </button>
      <button type="button" className={botaoClaro} onClick={copiar}>
        <Copy size={13} /> Copiar link
      </button>
    </span>
  );
}
