"use client";

import { useState, useTransition } from "react";
import { Sparkles } from "lucide-react";
import { organizarEntrevista, salvarEntrevista } from "@/app/(app)/selecao/actions";
import { SEM_RESPOSTA, TETO_DA_TRANSCRICAO, entrevistaVazia, numerarRespondidas, semResposta, type Entrevista } from "@/lib/entrevista";
import { avisar } from "./avisos";
import { FormError, Textarea } from "./form";
import { Etiqueta, Painel } from "./ui";

/**
 * A entrevista do candidato: a transcrição entra, a IA põe cada resposta
 * embaixo da pergunta da vaga, e ela revisa antes de salvar. A avaliação é
 * sempre dela; a IA não escreve ali.
 */

const botao =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";
const botaoPrimario =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60";

export default function EntrevistaDoCandidato({
  candidatoId,
  perguntas,
  salva,
}: {
  candidatoId: string;
  /** As perguntas da vaga hoje. */
  perguntas: string[];
  /** A entrevista já gravada, se houver. */
  salva: Entrevista | null;
}) {
  const [entrevista, setEntrevista] = useState<Entrevista>(() => salva ?? entrevistaVazia(perguntas));
  const [transcricao, setTranscricao] = useState(salva?.transcricao ?? "");
  const [verTranscricao, setVerTranscricao] = useState(!salva);
  const [alterada, setAlterada] = useState(false);
  const [erro, setErro] = useState<string>();
  const [organizando, iniciarOrganizar] = useTransition();
  const [salvando, iniciarSalvar] = useTransition();

  // A entrevista guarda as perguntas do dia em que foi feita; uma pergunta
  // nova na vaga aparece aqui só se a entrevista ainda não foi salva.
  const semPerguntas = entrevista.respostas.length === 0;

  function mudar(fn: (e: Entrevista) => Entrevista) {
    setEntrevista((e) => fn(structuredClone(e)));
    setAlterada(true);
  }

  async function lerArquivo(arquivo: File) {
    if (!/\.(txt|vtt|srt)$/i.test(arquivo.name) && !arquivo.type.startsWith("text/")) {
      setErro("Envie a transcrição em texto (.txt, .vtt ou .srt). Se estiver em Word, abra e copie o texto para cá.");
      return;
    }
    setErro(undefined);
    setTranscricao(await arquivo.text());
  }

  function organizar() {
    if (entrevista.organizadaEm && alterada && !confirm("Organizar de novo substitui as respostas que estão na tela. Continuar?")) return;
    setErro(undefined);
    iniciarOrganizar(async () => {
      const r = await organizarEntrevista(candidatoId, transcricao);
      if (r.error || !r.entrevista) {
        setErro(r.error ?? "Não foi possível organizar a entrevista.");
        return;
      }
      setEntrevista({ ...r.entrevista, avaliacao: entrevista.avaliacao || r.entrevista.avaliacao });
      setAlterada(true);
      setVerTranscricao(false);
      avisar("Pronto. Confira as respostas e salve.");
    });
  }

  function salvar() {
    setErro(undefined);
    iniciarSalvar(async () => {
      const r = await salvarEntrevista(candidatoId, { ...entrevista, transcricao: transcricao.trim() || entrevista.transcricao });
      if (r.error) setErro(r.error);
      else {
        setAlterada(false);
        avisar("Entrevista salva.");
      }
    });
  }

  if (semPerguntas) {
    return (
      <Painel titulo="Entrevista">
        <p className="text-sm text-slate-600">
          Esta vaga ainda não tem perguntas de entrevista. Cadastre o roteiro na página da vaga, em &ldquo;Perguntas da entrevista&rdquo;, e volte aqui.
        </p>
      </Painel>
    );
  }

  const numeroImpresso = numerarRespondidas(entrevista.respostas.map((r) => r.resposta));

  return (
    <div className="space-y-3">
      <Painel
        titulo="Transcrição"
        descricao="Cole o texto da entrevista (ou envie o arquivo .txt) e aperte Organizar. A IA coloca cada resposta embaixo da pergunta, com as palavras do candidato."
        acao={
          entrevista.transcricao && !verTranscricao ? (
            <button type="button" className="no-print text-micro text-brand-700 hover:underline" onClick={() => setVerTranscricao(true)}>
              ver transcrição
            </button>
          ) : null
        }
      >
        {verTranscricao ? (
          <div className="no-print space-y-2">
            <Textarea
              rows={10}
              value={transcricao}
              onChange={(e) => setTranscricao(e.target.value)}
              placeholder={"Entrevistadora: Me conte sobre a sua última experiência...\nCandidato: ..."}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={botaoPrimario} disabled={organizando || transcricao.trim().length < 200} onClick={organizar}>
                <Sparkles className="h-4 w-4" /> {organizando ? "Organizando… (pode levar 1 minuto)" : "Organizar"}
              </button>
              <label className={`${botao} cursor-pointer`}>
                Enviar arquivo
                <input
                  type="file"
                  accept=".txt,.vtt,.srt,text/plain"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void lerArquivo(f);
                    e.target.value = "";
                  }}
                />
              </label>
              <span className="text-micro text-slate-500">
                {transcricao.trim().length.toLocaleString("pt-BR")} de {TETO_DA_TRANSCRICAO.toLocaleString("pt-BR")} caracteres
              </span>
            </div>
          </div>
        ) : (
          <p className="text-mini text-slate-500">
            {entrevista.organizadaEm
              ? `Organizada pela IA em ${new Date(entrevista.organizadaEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} e revisada por você.`
              : "Respostas escritas à mão."}
          </p>
        )}
      </Painel>

      <Painel titulo="Respostas" descricao="Corrija o que for preciso. O que estiver aqui é o que fica na pasta do candidato.">
        <ol className="space-y-3">
          {entrevista.respostas.map((r, i) => (
            // Na impressão (e no PDF da pasta) a pergunta sem resposta some, e a
            // numeração conta só as respondidas.
            <li key={i} className={`break-inside-avoid ${semResposta(r.resposta) ? "print:hidden" : ""}`}>
              <p className="mb-1 flex items-center gap-2 text-mini font-medium text-slate-800">
                <span className="print:hidden">{i + 1}.</span>
                <span className="hidden print:inline">{numeroImpresso[i]}.</span> {r.pergunta}
                {r.resposta === SEM_RESPOSTA ? <Etiqueta tom="atencao">sem resposta</Etiqueta> : null}
              </p>
              <Textarea
                rows={Math.min(10, Math.max(2, Math.ceil(r.resposta.length / 90)))}
                value={r.resposta}
                onChange={(e) => mudar((x) => ((x.respostas[i].resposta = e.target.value), x))}
                className="text-mini print:hidden"
              />
              <p className="hidden whitespace-pre-line text-mini text-slate-700 print:block">{r.resposta}</p>
            </li>
          ))}
        </ol>
      </Painel>

      <Painel titulo="Outros pontos" descricao="O que o candidato contou fora das perguntas.">
        <Textarea rows={3} value={entrevista.outros} onChange={(e) => mudar((x) => ((x.outros = e.target.value), x))} className="text-mini print:hidden" />
        <p className="hidden whitespace-pre-line text-mini text-slate-700 print:block">{entrevista.outros || "Nada além das perguntas."}</p>
      </Painel>

      <Painel titulo="Avaliação da entrevistadora" descricao="A sua leitura da entrevista. A IA não escreve aqui.">
        <Textarea rows={4} value={entrevista.avaliacao} onChange={(e) => mudar((x) => ((x.avaliacao = e.target.value), x))} className="text-mini print:hidden" />
        <p className="hidden whitespace-pre-line text-mini text-slate-700 print:block">{entrevista.avaliacao}</p>
      </Painel>

      <FormError message={erro} />
      <div className="no-print flex items-center justify-end gap-2">
        {alterada ? <span className="text-micro text-amber-700">Há mudanças não salvas.</span> : null}
        <button type="button" className={botaoPrimario} disabled={salvando} onClick={salvar}>
          {salvando ? "Salvando…" : "Salvar entrevista"}
        </button>
      </div>
    </div>
  );
}
