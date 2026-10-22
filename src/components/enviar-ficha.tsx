"use client";

import { useTransition } from "react";
import { FileText, PenLine } from "lucide-react";
import { enviarFicha } from "@/app/(app)/selecao/actions";
import { linkDoWhatsapp, primeiroNome } from "@/lib/selecao";
import { avisar } from "./avisos";

/** O link público da ficha, montado no navegador com o endereço de onde o sistema está aberto. */
export function linkDaFicha(token: string) {
  return `${window.location.origin}/ficha/${token}`;
}

export function recadoDaFicha(nome: string, vaga: string, token: string) {
  return (
    `Olá, ${primeiroNome(nome)}! Para seguir no processo da vaga de ${vaga}, preencha a ficha de solicitação de emprego neste link: ` +
    `${linkDaFicha(token)} . Leva uns 15 minutos e dá para fazer pelo celular.`
  );
}

/**
 * Manda a ficha: marca o envio e abre o WhatsApp com a mensagem pronta. Sem
 * telefone, copia a mensagem. O link é sempre o mesmo para o candidato.
 */
export default function EnviarFicha({
  candidatoId,
  nome,
  telefone,
  vaga,
  enviada,
  className,
}: {
  candidatoId: string;
  nome: string;
  telefone: string | null;
  vaga: string;
  enviada: boolean;
  className: string;
}) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      className={className}
      onClick={() =>
        iniciar(async () => {
          const r = await enviarFicha(candidatoId);
          if (r.error || !r.token) {
            avisar(r.error ?? "Não foi possível gerar o link.");
            return;
          }
          const recado = recadoDaFicha(nome, vaga, r.token);
          if (telefone) window.open(linkDoWhatsapp(telefone, recado), "_blank", "noreferrer");
          else {
            await navigator.clipboard.writeText(recado).catch(() => undefined);
            avisar("Link da ficha copiado. Cole na conversa com o candidato.");
          }
        })
      }
    >
      <FileText className="h-3 w-3" /> {pendente ? "Gerando…" : enviada ? "Reenviar ficha" : "Enviar ficha"}
    </button>
  );
}

/**
 * Preencher a ficha aqui mesmo, com o candidato do lado ou a partir da ficha
 * de papel: abre o mesmo formulário do link numa aba nova.
 */
export function PreencherFicha({ candidatoId, className }: { candidatoId: string; className: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      className={className}
      title="Abre o formulário da ficha numa aba nova, para preencher aqui"
      onClick={() => {
        // A aba nasce no clique, senão o navegador bloqueia como pop-up.
        const aba = window.open("about:blank", "_blank");
        iniciar(async () => {
          const r = await enviarFicha(candidatoId);
          if (r.error || !r.token) {
            aba?.close();
            avisar(r.error ?? "Não foi possível abrir a ficha.");
            return;
          }
          if (aba) aba.location.href = linkDaFicha(r.token);
          else window.location.href = linkDaFicha(r.token);
        });
      }}
    >
      <PenLine className="h-3 w-3" /> {pendente ? "Abrindo…" : "Preencher aqui"}
    </button>
  );
}
