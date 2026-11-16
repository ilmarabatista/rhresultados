"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Mic, Monitor, MonitorSpeaker, Sparkles, Square } from "lucide-react";
import { organizarEntrevista, salvarEntrevista } from "@/app/(app)/selecao/actions";
import { SEM_RESPOSTA, TETO_DA_TRANSCRICAO, entrevistaVazia, numerarRespondidas, semResposta, type Entrevista } from "@/lib/entrevista";
import { avisar } from "./avisos";
import { FormError, Textarea } from "./form";
import { Etiqueta, Painel } from "./ui";
import { relogio, useGravador } from "./use-gravador";
import { SEGUNDOS_POR_TRECHO } from "@/lib/reuniao-gravada";

/**
 * A entrevista do candidato: a transcrição entra, a IA põe cada resposta
 * embaixo da pergunta da vaga, e ela revisa antes de salvar. A avaliação é
 * sempre dela; a IA não escreve ali.
 *
 * A transcrição pode ser colada, enviada em arquivo ou gravada aqui mesmo: o
 * gravador da reunião online ouve a entrevista (presencial pelo microfone, ou
 * o som do Meet ou do WhatsApp), e o texto vai entrando no campo a cada dois
 * minutos. Ao parar, a IA organiza sozinha. Enquanto a entrevista não é salva,
 * o texto gravado fica guardado neste navegador, para não se perder se a aba
 * fechar.
 */

const chaveDoRascunho = (candidatoId: string) => `entrevista-gravada:${candidatoId}`;

function lerRascunho(candidatoId: string): string {
  try {
    return window.localStorage.getItem(chaveDoRascunho(candidatoId)) ?? "";
  } catch {
    return "";
  }
}

function guardarRascunho(candidatoId: string, texto: string | null) {
  try {
    if (texto) window.localStorage.setItem(chaveDoRascunho(candidatoId), texto);
    else window.localStorage.removeItem(chaveDoRascunho(candidatoId));
  } catch {
    // Sem o armazenamento do navegador, segue sem a cópia de segurança.
  }
}

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
  const [podeTela, setPodeTela] = useState(true);
  const [terminando, setTerminando] = useState(false);
  const gravouAgora = useRef(false);
  // O texto mais novo, para ler logo depois que o último trecho chega.
  const textoAtual = useRef(transcricao);
  textoAtual.current = transcricao;

  const g = useGravador(`/api/selecao/candidatos/${candidatoId}/trecho`, (texto) => {
    if (!texto) return;
    // Fora do setTranscricao: quem parou a gravação lê o texto logo em seguida.
    const t = textoAtual.current;
    const nova = t.trim() ? `${t.trimEnd()}\n${texto}` : texto;
    textoAtual.current = nova;
    gravouAgora.current = true;
    guardarRascunho(candidatoId, nova);
    setTranscricao(nova);
  });

  // No celular não dá para compartilhar a aba: lá só o microfone.
  useEffect(() => setPodeTela(Boolean(navigator.mediaDevices?.getDisplayMedia)), []);

  // Uma gravação que ficou para trás (a aba fechou antes de salvar) volta.
  useEffect(() => {
    const rascunho = lerRascunho(candidatoId);
    if (rascunho && rascunho !== (salva?.transcricao ?? "")) {
      setTranscricao(rascunho);
      setVerTranscricao(true);
      avisar("A gravação da entrevista que não foi salva voltou para a transcrição.");
    }
    // Só ao abrir a página.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function comecarGravacao(modo: "meet" | "computador" | "microfone") {
    setVerTranscricao(true);
    void g.iniciar(modo);
  }

  // Parar espera o último trecho virar texto, e então a IA organiza.
  async function pararEOrganizar() {
    setTerminando(true);
    await g.parar();
    setTerminando(false);
    const texto = textoAtual.current;
    if (texto.trim().length < 200) {
      setErro("A gravação ficou curta demais para organizar. Grave mais ou complete o texto à mão e aperte Organizar.");
      return;
    }
    organizar(texto);
  }

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

  function organizar(texto: string = transcricao) {
    if (entrevista.organizadaEm && alterada && !confirm("Organizar de novo substitui as respostas que estão na tela. Continuar?")) return;
    setErro(undefined);
    iniciarOrganizar(async () => {
      const r = await organizarEntrevista(candidatoId, texto);
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
        guardarRascunho(candidatoId, null);
        gravouAgora.current = false;
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
        descricao="Grave a entrevista aqui, cole o texto ou envie o arquivo .txt. A IA coloca cada resposta embaixo da pergunta, com as palavras do candidato."
        acao={
          entrevista.transcricao && !verTranscricao ? (
            <button type="button" className="no-print text-micro text-brand-700 hover:underline" onClick={() => setVerTranscricao(true)}>
              ver transcrição
            </button>
          ) : null
        }
      >
        <div className="no-print mb-3 space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          {g.gravando ? (
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-red-700">
                <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
                Gravando{" "}
                {g.gravando === "meet" ? "você e o som do Meet" : g.gravando === "computador" ? "você e o som do computador" : "pelo microfone"} ·{" "}
                {relogio(g.segundos)}
              </span>
              <button
                type="button"
                onClick={() => void pararEOrganizar()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700"
              >
                <Square size={12} fill="currentColor" /> Parar e organizar
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={botaoPrimario} disabled={organizando || terminando} onClick={() => comecarGravacao("microfone")}>
                <Mic className="h-4 w-4" /> Gravar entrevista
              </button>
              {podeTela ? (
                <>
                  <button type="button" className={botao} disabled={organizando || terminando} onClick={() => comecarGravacao("meet")}>
                    <MonitorSpeaker className="h-4 w-4" /> Online pelo Meet
                  </button>
                  <button type="button" className={botao} disabled={organizando || terminando} onClick={() => comecarGravacao("computador")}>
                    <Monitor className="h-4 w-4" /> Online pelo WhatsApp do computador
                  </button>
                </>
              ) : null}
            </div>
          )}

          {g.gravando ? (
            <p className="text-micro text-slate-600">
              Deixe esta aba aberta até o fim. O texto entra no campo abaixo a cada {SEGUNDOS_POR_TRECHO / 60} minutos. Ao parar, a IA organiza as respostas.
            </p>
          ) : terminando || g.enviando > 0 ? (
            <p className="text-micro text-slate-600">Passando para texto o final da gravação…</p>
          ) : organizando ? (
            <p className="text-micro text-slate-600">A IA está organizando as respostas (pode levar 1 minuto)…</p>
          ) : (
            <ul className="list-disc space-y-0.5 pl-4 text-micro text-slate-600">
              <li>
                <strong className="font-medium">Presencial:</strong> deixe o computador (ou o celular) perto de vocês e clique em
                &quot;Gravar entrevista&quot;.
              </li>
              {podeTela ? (
                <li>
                  <strong className="font-medium">Online:</strong> com a chamada aberta, clique no botão do Meet (escolha a aba do Meet
                  e deixe marcado &quot;Compartilhar áudio da guia&quot;) ou do WhatsApp (escolha &quot;Tela inteira&quot; e deixe
                  marcado &quot;Compartilhar áudio do sistema&quot;; só no Chrome ou Edge do Windows).
                </li>
              ) : null}
              <li>Avise o candidato de que a entrevista será gravada. O áudio não fica guardado, só o texto.</li>
            </ul>
          )}

          {g.erro ? (
            <p role="alert" className="text-mini text-red-700">
              {g.erro}
              {g.falhas > 0 ? (
                <>
                  {" "}
                  <button type="button" onClick={g.reenviar} className="font-medium underline">
                    Tentar de novo ({g.falhas === 1 ? "1 trecho" : `${g.falhas} trechos`})
                  </button>
                </>
              ) : null}
            </p>
          ) : null}
        </div>

        {verTranscricao ? (
          <div className="no-print space-y-2">
            <Textarea
              rows={10}
              value={transcricao}
              onChange={(e) => {
                setTranscricao(e.target.value);
                if (gravouAgora.current) guardarRascunho(candidatoId, e.target.value);
              }}
              placeholder={"Entrevistadora: Me conte sobre a sua última experiência...\nCandidato: ..."}
            />
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={botaoPrimario} disabled={organizando || Boolean(g.gravando) || transcricao.trim().length < 200} onClick={() => organizar()}>
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
