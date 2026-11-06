"use client";

import { useState, useTransition } from "react";
import { Copy, ExternalLink, MessageCircle } from "lucide-react";
import { linkDoPdiParaAGerente, linkDoPdiParaOColaborador } from "@/app/(app)/empresas/[id]/pdi/actions";
import { linkDoWhatsApp } from "@/lib/autoavaliacao";
import { linkPublico } from "@/lib/link-publico";
import { avisar } from "./avisos";

const primeiro = (nome: string) => nome.trim().split(/\s+/)[0] ?? nome;

type Pedido = { error?: string; token?: string; telefone?: string | null; nome?: string };

/**
 * Os três botões de um link do PDI que vai para fora: WhatsApp com a mensagem
 * pronta, copiar o link e abrir a página como quem recebe vai ver.
 */
function BotoesDoLink({
  pedir,
  caminho,
  recado,
  rotulo,
  dica,
  ver,
}: {
  pedir: (enviando: boolean) => Promise<Pedido>;
  caminho: (token: string) => string;
  recado: (link: string, r: Pedido) => string;
  rotulo: string;
  dica: string;
  ver: string;
}) {
  const [pendente, iniciar] = useTransition();
  const [copiado, setCopiado] = useState(false);

  function gerar(depois: (link: string, r: Pedido) => void, aba: Window | null, enviando = false) {
    iniciar(async () => {
      const r = await pedir(enviando);
      if (r.error || !r.token) {
        aba?.close();
        avisar(r.error ?? "Não foi possível gerar o link.");
        return;
      }
      depois(linkPublico(caminho(r.token)), r);
    });
  }

  function abrir(aba: Window | null, destino: string) {
    if (aba) aba.location.href = destino;
    else window.location.href = destino;
  }

  const botao =
    "flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

  return (
    <>
      <button
        type="button"
        disabled={pendente}
        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 font-medium text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
        title={dica}
        onClick={() => {
          // A aba nasce no clique, senão o navegador bloqueia como pop-up.
          const aba = window.open("about:blank", "_blank");
          gerar((link, r) => abrir(aba, linkDoWhatsApp(r.telefone ?? null, recado(link, r))), aba, true);
        }}
      >
        <MessageCircle size={15} />
        {pendente ? "Gerando link…" : rotulo}
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
        title="Abre a página exatamente como quem recebe vai ver"
        onClick={() => {
          const aba = window.open("about:blank", "_blank");
          // Daqui abre no endereço de onde o sistema está (localhost ou dev),
          // para conferir antes de mandar.
          gerar((link) => abrir(aba, new URL(link).pathname), aba);
        }}
      >
        <ExternalLink size={14} />
        {ver}
      </button>
    </>
  );
}

/** Manda ao colaborador o PDI com o que foi combinado na conversa 1 a 1. */
export default function EnviarPdi({ planoId }: { planoId: string }) {
  return (
    <BotoesDoLink
      rotulo="Enviar PDI ao colaborador"
      ver="Ver como a pessoa vê"
      dica="Manda ao colaborador o link do PDI com as metas, as ações e os combinados"
      pedir={(enviando) => linkDoPdiParaOColaborador(planoId, enviando)}
      caminho={(t) => `/meu-pdi/${t}`}
      recado={(link, r) =>
        `Olá, ${primeiro(r.nome ?? "")}! Aqui está o seu PDI, com o que combinamos na nossa conversa: ` +
        `as metas, o que você vai fazer em cada uma e as datas dos próximos encontros. ${link}`
      }
    />
  );
}

/**
 * Manda à gerente o que foi combinado no PDI de cada pessoa (da cidade
 * escolhida, ou de todas). O WhatsApp abre sem número: escolhe-se a gerente.
 */
export function EnviarPdiAGerente({ companyId, cidade, onde }: { companyId: string; cidade: string | null; onde: string | null }) {
  return (
    <BotoesDoLink
      rotulo="Enviar à gerente"
      ver="Ver como a gerente vê"
      dica="Manda à gerente o link com o que foi combinado no PDI de cada pessoa"
      pedir={(enviando) => linkDoPdiParaAGerente(companyId, cidade, enviando)}
      caminho={(t) => `/pdi-da-equipe/${t}`}
      recado={(link) =>
        `Olá! Segue o que combinamos no PDI de cada pessoa da equipe${onde ? ` de ${onde}` : ""}: ` +
        `as metas, as ações, quem acompanha e os prazos. O link mostra sempre como está hoje: ${link}`
      }
    />
  );
}
