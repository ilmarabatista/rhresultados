"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { linkDoPdiParaOColaborador } from "@/app/(app)/empresas/[id]/pdi/actions";
import { linkDoWhatsApp } from "@/lib/autoavaliacao";
import { linkPublico } from "@/lib/link-publico";
import { avisar } from "./avisos";

const primeiro = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

/**
 * Manda ao colaborador o PDI com o que foi combinado na conversa 1 a 1: gera
 * o link (só leitura, abre sem login, vale 120 dias) e abre o WhatsApp com a
 * mensagem pronta. Também copia o link ou abre a página como a pessoa vê.
 */
export default function EnviarPdi({ planoId }: { planoId: string }) {
  const [pendente, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);

  function gerar(
    depois: (link: string, r: { telefone?: string | null; nome?: string }) => void,
    aba: Window | null,
    enviando = false,
  ) {
    iniciar(async () => {
      const r = await linkDoPdiParaOColaborador(planoId, enviando);
      if (r.error || !r.token) {
        aba?.close();
        avisar(r.error ?? "Não foi possível gerar o link do PDI.");
        return;
      }
      depois(linkPublico(`/meu-pdi/${r.token}`), r);
    });
  }

  const botao =
    "flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

  return (
    <>
      <button
        type="button"
        disabled={pendente}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
        title="Manda ao colaborador o link do PDI com as metas, as ações e os combinados"
        onClick={() => {
          // A aba nasce no clique, senão o navegador bloqueia como pop-up.
          const aba = window.open("about:blank", "_blank");
          gerar((link, r) => {
            const recado =
              `Olá, ${primeiro(r.nome ?? "")}! Aqui está o seu PDI, com o que combinamos na nossa conversa: ` +
              `as metas, o que você vai fazer em cada uma e as datas dos próximos encontros. ${link}`;
            const destino = linkDoWhatsApp(r.telefone ?? null, recado);
            if (aba) aba.location.href = destino;
            else window.location.href = destino;
          }, aba, true);
        }}
      >
        <MessageCircle size={15} />
        {pendente ? "Gerando link…" : "Enviar PDI ao colaborador"}
      </button>
      <button
        type="button"
        disabled={pendente}
        className={botao}
        onClick={() =>
          gerar(async (link) => {
            try {
              await navigator.clipboard.writeText(link);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2500);
            } catch {
              avisar(`Copie o link: ${link}`);
            }
          }, null)
        }
      >
        <Copy size={14} />
        {copiado ? "Copiado" : "Copiar link"}
      </button>
      <button
        type="button"
        disabled={pendente}
        className={botao}
        title="Abre a página exatamente como o colaborador vai ver"
        onClick={() => {
          const aba = window.open("about:blank", "_blank");
          gerar((link) => {
            // Daqui abre no endereço de onde o sistema está (localhost ou dev),
            // para conferir antes de mandar.
            const caminho = new URL(link).pathname;
            if (aba) aba.location.href = caminho;
            else window.location.href = caminho;
          }, aba);
        }}
      >
        <ExternalLink size={14} />
        Ver como a pessoa vê
      </button>
    </>
  );
}
