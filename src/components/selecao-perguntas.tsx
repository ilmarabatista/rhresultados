"use client";

import { useEffect, useState, useTransition } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { copiarPerguntasDaEntrevista, salvarPerguntasDaEntrevista } from "@/app/(app)/selecao/actions";
import { avisar } from "./avisos";
import { Textarea } from "./form";
import { Painel } from "./ui";

/**
 * O roteiro da entrevista da vaga: uma pergunta por linha. É contra ele que a
 * transcrição de cada candidato é organizada.
 */

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-micro text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";

export default function PerguntasDaEntrevista({
  vagaId,
  perguntas,
  outrasVagas,
}: {
  vagaId: string;
  perguntas: string[];
  outrasVagas: { id: string; nome: string; perguntas: number }[];
}) {
  const [aberto, setAberto] = useState(perguntas.length === 0);
  const [texto, setTexto] = useState(perguntas.join("\n"));
  const [origem, setOrigem] = useState("");
  const [pendente, iniciar] = useTransition();
  const alterado = texto.trim() !== perguntas.join("\n").trim();

  // Depois de salvar ou copiar, o servidor devolve o roteiro limpo.
  useEffect(() => setTexto(perguntas.join("\n")), [perguntas]);

  function salvar() {
    iniciar(async () => {
      const r = await salvarPerguntasDaEntrevista(vagaId, texto.split(/\r?\n/));
      if (r.error) avisar(r.error);
      else avisar("Perguntas salvas.");
    });
  }

  function copiar() {
    if (!origem) return;
    if (perguntas.length > 0 && !confirm("Copiar substitui as perguntas desta vaga. Continuar?")) return;
    iniciar(async () => {
      const r = await copiarPerguntasDaEntrevista(vagaId, origem);
      if (r.error) avisar(r.error);
      else {
        const nova = outrasVagas.find((v) => v.id === origem);
        avisar(`Copiadas ${nova?.perguntas ?? ""} perguntas.`);
        setOrigem("");
        setAberto(false);
      }
    });
  }

  return (
    <Painel
      titulo={`Perguntas da entrevista${perguntas.length ? ` (${perguntas.length})` : ""}`}
      descricao="O roteiro desta vaga. Na pasta de cada candidato, a transcrição da entrevista é organizada por estas perguntas."
      acao={
        <button type="button" className={botao} onClick={() => setAberto((v) => !v)}>
          {aberto ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          {aberto ? "Fechar" : perguntas.length ? "Ver e editar" : "Cadastrar"}
        </button>
      }
    >
      {aberto ? (
        <div className="space-y-2">
          <Textarea
            rows={Math.min(16, Math.max(6, texto.split("\n").length + 1))}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder={"Uma pergunta por linha. Por exemplo:\nMe conte sobre a sua última experiência.\nPor que saiu da última empresa?\nComo você lida com um cliente insatisfeito?"}
            className="text-mini"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            {outrasVagas.length > 0 ? (
              <span className="flex items-center gap-1">
                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  aria-label="Copiar perguntas de outra vaga"
                  className="max-w-64 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-micro text-slate-600 outline-none focus:border-brand-400"
                >
                  <option value="">Copiar de outra vaga…</option>
                  {outrasVagas.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.nome} ({v.perguntas})
                    </option>
                  ))}
                </select>
                <button type="button" className={botao} disabled={!origem || pendente} onClick={copiar}>
                  Copiar
                </button>
              </span>
            ) : (
              <span />
            )}
            <button type="button" className={botao} disabled={!alterado || pendente} onClick={salvar}>
              {pendente ? "Salvando…" : "Salvar perguntas"}
            </button>
          </div>
        </div>
      ) : perguntas.length ? (
        <ol className="list-inside list-decimal space-y-0.5 text-mini text-slate-700">
          {perguntas.slice(0, 5).map((p, i) => (
            <li key={i}>{p}</li>
          ))}
          {perguntas.length > 5 ? <li className="list-none text-slate-500">e mais {perguntas.length - 5}.</li> : null}
        </ol>
      ) : (
        <p className="text-mini text-slate-500">Nenhuma pergunta cadastrada ainda.</p>
      )}
    </Painel>
  );
}
