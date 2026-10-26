"use client";

import { useTransition } from "react";
import { MessageCircle } from "lucide-react";
import { linkDoDossie } from "@/app/(app)/selecao/actions";
import { linkDoWhatsapp, primeiroNome } from "@/lib/selecao";
import { avisar } from "./avisos";

/**
 * Manda o dossiê ao cliente pelo WhatsApp: gera o link (abre sem login, vale
 * 30 dias) e abre a conversa com a mensagem pronta. Com o telefone do contato
 * da empresa, a conversa já abre com ele; sem, o WhatsApp pede o contato.
 */
export default function EnviarDossie({ candidatoId, className }: { candidatoId: string; className?: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      className={
        className ??
        "flex shrink-0 items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
      }
      onClick={() => {
        // A aba nasce no clique, senão o navegador bloqueia como pop-up.
        const aba = window.open("about:blank", "_blank");
        iniciar(async () => {
          const r = await linkDoDossie(candidatoId);
          if (r.error || !r.token) {
            aba?.close();
            avisar(r.error ?? "Não foi possível gerar o link do dossiê.");
            return;
          }
          const link = `${window.location.origin}/dossie/${r.token}`;
          const recado =
            `Olá${r.contato ? `, ${primeiroNome(r.contato)}` : ""}! Segue o dossiê do candidato ${r.nome} para a vaga de ${r.vaga}: ${link} . ` +
            "Pelo link dá para ler e baixar em PDF. Ele fica disponível por 30 dias.";
          const destino = linkDoWhatsapp(r.telefone ?? null, recado);
          if (aba) aba.location.href = destino;
          else window.location.href = destino;
        });
      }}
    >
      <MessageCircle size={15} />
      {pendente ? "Gerando link…" : "Enviar por WhatsApp"}
    </button>
  );
}
