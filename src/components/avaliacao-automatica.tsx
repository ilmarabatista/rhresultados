"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { avaliarCandidato } from "@/app/(app)/selecao/actions";
import { ADERENCIA, type Avaliacao } from "@/lib/fluxo-da-vaga";
import { FormError } from "./form";
import { Etiqueta, Painel } from "./ui";

/**
 * A avaliação automática do candidato: a IA lê a pasta inteira e dá nota por
 * área. Sai sozinha ao abrir o Resultado final e é refeita quando a pasta
 * muda (ficha, teste, entrevista ou anotação nova). Não decide nada: quem
 * aprova ou reprova é a consultora.
 */

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-micro text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";

function Barra({ nota }: { nota: number }) {
  const tom = nota >= 7 ? "bg-emerald-500" : nota >= 5 ? "bg-amber-500" : "bg-red-500";
  return (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
      <span className={`block h-full ${tom}`} style={{ width: `${nota * 10}%` }} />
    </span>
  );
}

export default function AvaliacaoAutomatica({
  candidatoId,
  salva,
  atual,
  vazia,
}: {
  candidatoId: string;
  salva: Avaliacao | null;
  /** A guardada ainda é da pasta como está agora. */
  atual: boolean;
  /** Sem ficha, teste nem entrevista: não há o que avaliar. */
  vazia: boolean;
}) {
  const [avaliacao, setAvaliacao] = useState(salva);
  const [erro, setErro] = useState<string>();
  const [avaliando, iniciar] = useTransition();
  const pedida = useRef(false);

  const avaliar = (refazer: boolean) => {
    setErro(undefined);
    iniciar(async () => {
      const r = await avaliarCandidato(candidatoId, refazer);
      if (r.error || !r.avaliacao) setErro(r.error ?? "Não foi possível avaliar.");
      else setAvaliacao(r.avaliacao);
    });
  };

  // Marca a página enquanto avalia: o "Baixar PDF da pasta" espera.
  useEffect(() => {
    if (!avaliando) return;
    document.body.dataset.avaliacao = "carregando";
    return () => {
      delete document.body.dataset.avaliacao;
    };
  }, [avaliando]);

  // Automática: sem avaliação, ou com uma de antes da última mudança na pasta.
  useEffect(() => {
    if (vazia || (salva && atual) || pedida.current) return;
    pedida.current = true;
    avaliar(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez ao abrir
  }, []);

  const a = avaliacao;
  return (
    <Painel
      titulo="Avaliação automática"
      descricao="Feita pela IA a partir da pasta inteira (ficha, testes, entrevista e descrição do cargo). Serve de apoio: a decisão é da consultoria."
      acao={a ? <Etiqueta tom={ADERENCIA[a.aderencia].tom}>{`${ADERENCIA[a.aderencia].rotulo} · ${a.nota.toLocaleString("pt-BR")}/10`}</Etiqueta> : null}
      className="break-inside-avoid"
    >
      {vazia ? (
        <p className="text-mini text-slate-500">A avaliação sai quando o candidato tiver ficha, teste ou entrevista na pasta.</p>
      ) : !a ? (
        <p className="text-mini text-slate-500">{avaliando ? "A IA está lendo a pasta… (pode levar até 1 minuto)" : "Ainda sem avaliação."}</p>
      ) : (
        <div className="space-y-3">
          {a.resumo ? <p className="whitespace-pre-line text-mini text-slate-700">{a.resumo}</p> : null}
          <ul className="grid gap-2 sm:grid-cols-2">
            {a.criterios.map((c) => (
              <li key={c.nome} className="space-y-1">
                <p className="flex items-baseline justify-between gap-2 text-mini">
                  <span className="font-medium text-slate-800">{c.nome}</span>
                  <span className="text-slate-500">{c.nota >= 0 ? `${c.nota.toLocaleString("pt-BR")}/10` : "não feita"}</span>
                </p>
                {c.nota >= 0 ? <Barra nota={c.nota} /> : null}
                {c.comentario ? <p className="text-micro text-slate-600">{c.comentario}</p> : null}
              </li>
            ))}
          </ul>
          <div className="grid gap-3 sm:grid-cols-2">
            {a.pontosFortes.length ? (
              <div>
                <p className="text-micro font-medium uppercase tracking-wider text-emerald-700">Pontos fortes</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-mini text-slate-700">
                  {a.pontosFortes.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {a.pontosDeAtencao.length ? (
              <div>
                <p className="text-micro font-medium uppercase tracking-wider text-amber-700">Pontos de atenção</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-mini text-slate-700">
                  {a.pontosDeAtencao.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <p className="text-micro text-slate-500">
            Gerada em {new Date(a.geradaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
            {avaliando ? " · atualizando com a pasta de agora…" : ""}
          </p>
        </div>
      )}
      <div className="no-print">
        <FormError message={erro} />
      </div>
      {!vazia ? (
        <div className="no-print mt-2 flex justify-end">
          <button type="button" className={botao} disabled={avaliando} onClick={() => avaliar(true)}>
            <RefreshCw className="h-3 w-3" /> {avaliando ? "Avaliando…" : "Avaliar de novo"}
          </button>
        </div>
      ) : null}
    </Painel>
  );
}
