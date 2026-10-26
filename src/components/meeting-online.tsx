"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Mic, MonitorSpeaker, Sparkles, Square, Trash2, Video } from "lucide-react";
import {
  apagarTranscricao,
  mudarCampoDaReuniao,
  organizarComIA,
} from "@/app/(app)/empresas/[id]/reunioes/actions";
import { linkDoWhatsApp } from "@/lib/autoavaliacao";
import { conviteDaReuniao, NOVO_MEET, SEGUNDOS_POR_TRECHO } from "@/lib/reuniao-gravada";
import { avisar, confirmar } from "@/components/avisos";
import type { ReuniaoCompleta } from "./meeting-record";

/**
 * A reunião online: o link do Meet, o convite pelo WhatsApp e a gravação.
 *
 * A gravação é feita aqui mesmo, no navegador de quem conduz: o microfone
 * dela e, na reunião pelo Meet, o som da aba do Meet (que traz a voz dos
 * outros). O som é mandado em trechos de dois minutos, e cada trecho volta
 * como texto. Assim a transcrição vai crescendo durante a reunião, e se a aba
 * fechar no meio só se perde o trecho em andamento.
 *
 * Depois, a IA lê a transcrição e escreve o resumo e a ata.
 */

export type TrechoDaTranscricao = { id: string; hora: string; texto: string };

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";
const botaoForte =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-60";
const rotuloMiudo = "text-micro font-semibold uppercase tracking-wider text-slate-500";

function Cabecalho({ titulo, dica }: { titulo: string; dica: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-300 pb-1">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <span className="text-micro uppercase tracking-wider text-slate-500">{dica}</span>
    </div>
  );
}

function relogio(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

// ------------------------------------------------------------- o gravador

type Pendente = { audio: Blob; inicio: number };

function tipoDoAudio(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

function useGravador(reuniaoId: string, aoTranscrever: () => void) {
  const [gravando, setGravando] = useState<null | "meet" | "microfone">(null);
  const [segundos, setSegundos] = useState(0);
  const [enviando, setEnviando] = useState(0);
  const [falhas, setFalhas] = useState<Pendente[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const fontes = useRef<MediaStream[]>([]);
  const contexto = useRef<AudioContext | null>(null);
  const misturado = useRef<MediaStream | null>(null);
  const gravador = useRef<MediaRecorder | null>(null);
  const troca = useRef<number | null>(null);
  const cronometro = useRef<number | null>(null);
  // Um trecho por vez, na ordem: o servidor guarda pela hora, mas assim não
  // se estoura o limite do serviço de transcrição.
  const fila = useRef<Promise<void>>(Promise.resolve());
  const aoTranscreverRef = useRef(aoTranscrever);
  aoTranscreverRef.current = aoTranscrever;

  async function mandarUmaVez(p: Pendente): Promise<string | null> {
    const form = new FormData();
    form.append("audio", p.audio, "trecho");
    form.append("inicio", String(p.inicio));
    const resposta = await fetch(`/api/reunioes/${reuniaoId}/trecho`, { method: "POST", body: form });
    const dados = (await resposta.json().catch(() => null)) as { erro?: string } | null;
    return resposta.ok ? null : (dados?.erro ?? `Falha ao transcrever (HTTP ${resposta.status}).`);
  }

  function mandar(p: Pendente) {
    // Menos de 2 KB é só o cabeçalho do arquivo: nada foi dito.
    if (p.audio.size < 2_000) return;
    setEnviando((n) => n + 1);
    fila.current = fila.current.then(async () => {
      let ultimo: string | null = null;
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        if (tentativa) await new Promise((r) => setTimeout(r, tentativa * 5_000));
        try {
          ultimo = await mandarUmaVez(p);
        } catch {
          ultimo = "Sem conexão com o sistema.";
        }
        if (!ultimo) break;
      }
      setEnviando((n) => n - 1);
      if (ultimo) {
        setErro(ultimo);
        setFalhas((f) => [...f, p]);
      } else {
        aoTranscreverRef.current();
      }
    });
  }

  function novoTrecho() {
    const stream = misturado.current;
    if (!stream) return;
    const tipo = tipoDoAudio();
    const r = new MediaRecorder(stream, { ...(tipo ? { mimeType: tipo } : {}), audioBitsPerSecond: 32_000 });
    const partes: Blob[] = [];
    const inicio = Date.now();
    r.ondataavailable = (e) => {
      if (e.data.size) partes.push(e.data);
    };
    r.onstop = () => mandar({ audio: new Blob(partes, { type: r.mimeType || tipo || "audio/webm" }), inicio });
    r.start();
    // O novo começa antes do velho parar: não fica buraco entre os trechos.
    const anterior = gravador.current;
    gravador.current = r;
    if (anterior && anterior.state !== "inactive") anterior.stop();
  }

  function parar() {
    if (troca.current) window.clearInterval(troca.current);
    if (cronometro.current) window.clearInterval(cronometro.current);
    troca.current = cronometro.current = null;
    if (gravador.current && gravador.current.state !== "inactive") gravador.current.stop();
    gravador.current = null;
    fontes.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    fontes.current = [];
    void contexto.current?.close();
    contexto.current = null;
    misturado.current = null;
    setGravando(null);
  }

  async function iniciar(modo: "meet" | "microfone") {
    setErro(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não grava áudio. Use o Chrome ou o Edge no computador.");
      return;
    }

    try {
      let tela: MediaStream | null = null;
      if (modo === "meet") {
        // Primeiro a aba do Meet: é a parte que a pessoa pode errar.
        tela = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
          // Dicas do Chrome: oferecer abas, com o som marcado, e não esta.
          ...({ selfBrowserSurface: "exclude", systemAudio: "include", preferCurrentTab: false } as object),
        } as DisplayMediaStreamOptions);
        if (tela.getAudioTracks().length === 0) {
          tela.getTracks().forEach((t) => t.stop());
          setErro(
            'A aba foi compartilhada sem o som. Clique de novo, escolha a aba do Meet e deixe marcado "Compartilhar áudio da guia".',
          );
          return;
        }
      }

      const microfone = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });

      const ctx = new AudioContext();
      const destino = ctx.createMediaStreamDestination();
      ctx.createMediaStreamSource(microfone).connect(destino);
      if (tela) {
        ctx.createMediaStreamSource(new MediaStream(tela.getAudioTracks())).connect(destino);
        // Parar de compartilhar pelo Chrome encerra a gravação também.
        tela.getTracks().forEach((t) => t.addEventListener("ended", parar));
      }

      fontes.current = tela ? [tela, microfone] : [microfone];
      contexto.current = ctx;
      misturado.current = destino.stream;

      novoTrecho();
      troca.current = window.setInterval(novoTrecho, SEGUNDOS_POR_TRECHO * 1000);
      setSegundos(0);
      const comeco = Date.now();
      cronometro.current = window.setInterval(() => setSegundos(Math.floor((Date.now() - comeco) / 1000)), 1000);
      setGravando(modo);
    } catch (e) {
      parar();
      const nome = e instanceof Error ? e.name : "";
      setErro(
        nome === "NotAllowedError"
          ? "A gravação não foi permitida. Libere o microfone (e o compartilhamento da aba) no navegador."
          : nome === "NotFoundError"
            ? "Nenhum microfone encontrado."
            : "Não foi possível começar a gravar.",
      );
    }
  }

  function reenviar() {
    const lista = falhas;
    setFalhas([]);
    setErro(null);
    lista.forEach(mandar);
  }

  // Sair da página no meio perde o trecho em andamento: pergunta antes.
  const ocupado = Boolean(gravando) || enviando > 0;
  useEffect(() => {
    if (!ocupado) return;
    const segurar = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", segurar);
    return () => window.removeEventListener("beforeunload", segurar);
  }, [ocupado]);

  // Ao sair do componente, solta o microfone.
  useEffect(() => () => parar(), []);

  return { gravando, segundos, enviando, falhas: falhas.length, erro, iniciar, parar, reenviar };
}

// ------------------------------------------------------------- a seção

export default function MeetingOnline({ reuniao }: { reuniao: ReuniaoCompleta }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState(reuniao.link ?? "");
  const [resumo, setResumo] = useState(reuniao.resumo);
  const [podeTela, setPodeTela] = useState(true);

  useEffect(() => setLink(reuniao.link ?? ""), [reuniao.link]);
  useEffect(() => setResumo(reuniao.resumo), [reuniao.resumo]);
  // No celular não dá para compartilhar a aba: lá só o microfone.
  useEffect(() => setPodeTela(Boolean(navigator.mediaDevices?.getDisplayMedia)), []);

  const g = useGravador(reuniao.id, () => router.refresh());

  const salvarLink = () => {
    if (link.trim() === (reuniao.link ?? "")) return;
    startTransition(async () => {
      const r = await mudarCampoDaReuniao(reuniao.id, "link", link);
      if (r.error) {
        avisar(r.error);
        setLink(reuniao.link ?? "");
      }
    });
  };

  const salvarResumo = () => {
    if (resumo === reuniao.resumo) return;
    startTransition(async () => {
      const r = await mudarCampoDaReuniao(reuniao.id, "resumo", resumo);
      if (r.error) avisar(r.error);
    });
  };

  const organizar = () =>
    startTransition(async () => {
      if (
        reuniao.itens.length > 0 &&
        !(await confirmar("A IA vai somar o que tirar da gravação aos itens que já estão na ata. Continuar?"))
      ) {
        return;
      }
      const r = await organizarComIA(reuniao.id);
      if (r.error) avisar(r.error);
      else {
        avisar(`Pronto: o resumo foi escrito e ${r.itens ?? 0} itens entraram na ata. Confira e corrija o que precisar.`);
        router.refresh();
      }
    });

  const apagar = () =>
    startTransition(async () => {
      if (!(await confirmar("Apagar toda a transcrição desta reunião? O resumo e a ata continuam."))) return;
      const r = await apagarTranscricao(reuniao.id);
      if (r.error) avisar(r.error);
      else router.refresh();
    });

  const convite = (nome: string | null) =>
    conviteDaReuniao({
      nome,
      titulo: reuniao.titulo,
      dia: reuniao.dia,
      hora: reuniao.hora,
      link: reuniao.link ?? "",
      gravada: true,
    });

  const palavras = reuniao.transcricao.reduce((n, t) => n + t.texto.split(/\s+/).length, 0);

  return (
    <section className="space-y-3">
      <Cabecalho titulo="Reunião online" dica="Meet · convite pelo WhatsApp · gravação e transcrição" />

      {/* O link */}
      <div className="flex flex-wrap items-center gap-2">
        <span className={rotuloMiudo}>Link</span>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onBlur={salvarLink}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          placeholder="Cole aqui o link do Meet"
          className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-mini outline-none transition focus:border-brand-500"
        />
        {reuniao.link ? (
          <a href={reuniao.link} target="_blank" rel="noreferrer" className={botaoForte}>
            <Video size={13} /> Entrar na reunião
          </a>
        ) : (
          <a href={NOVO_MEET} target="_blank" rel="noreferrer" className={botaoClaro}>
            <Video size={13} /> Criar no Meet
          </a>
        )}
      </div>
      {!reuniao.link ? (
        <p className="text-mini text-slate-500">
          Clique em &quot;Criar no Meet&quot;: o Google abre uma reunião nova. Copie o endereço dela (meet.google.com/…)
          e cole no campo acima. Depois é só convidar pelo WhatsApp.
        </p>
      ) : null}

      {/* O convite */}
      {reuniao.link ? (
        <div className="space-y-1.5">
          <span className={rotuloMiudo}>Convidar pelo WhatsApp</span>
          <div className="flex flex-wrap gap-1.5">
            {reuniao.participantes.map((p) => (
              <a
                key={p.id}
                href={linkDoWhatsApp(p.telefone, convite(p.nome))}
                target="_blank"
                rel="noreferrer"
                title={p.telefone ? `Abre a conversa com ${p.nome}` : "Sem telefone na Equipe: o WhatsApp abre para escolher o contato"}
                className={botaoClaro}
              >
                {p.nome.split(/\s+/)[0]}
                {p.telefone ? null : <span className="text-slate-400">· sem telefone</span>}
              </a>
            ))}
            <a href={linkDoWhatsApp(null, convite(null))} target="_blank" rel="noreferrer" className={botaoClaro}>
              Outro contato
            </a>
          </div>
          <p className="text-micro text-slate-500">
            O convite leva o dia, a hora, o link e o aviso de que a reunião será gravada.
          </p>
        </div>
      ) : null}

      {/* A gravação */}
      <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
        {g.gravando ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex items-center gap-1.5 text-corpo font-medium text-red-700">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-600" />
              Gravando {g.gravando === "meet" ? "você e o som do Meet" : "o microfone"} · {relogio(g.segundos)}
            </span>
            <button type="button" onClick={g.parar} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700">
              <Square size={12} fill="currentColor" /> Parar gravação
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            {podeTela ? (
              <button type="button" onClick={() => g.iniciar("meet")} className={botaoForte}>
                <MonitorSpeaker size={13} /> Gravar com o som do Meet
              </button>
            ) : null}
            <button type="button" onClick={() => g.iniciar("microfone")} className={botaoClaro}>
              <Mic size={13} /> Gravar só o microfone (presencial)
            </button>
          </div>
        )}

        {g.gravando === "meet" ? (
          <p className="text-micro text-slate-600">
            Deixe esta aba aberta até o fim. A transcrição aparece aos poucos, a cada {SEGUNDOS_POR_TRECHO / 60} minutos.
          </p>
        ) : !g.gravando ? (
          <p className="text-micro text-slate-600">
            Com o Meet aberto em outra aba, clique em &quot;Gravar com o som do Meet&quot;, escolha a aba do Meet e deixe
            marcado &quot;Compartilhar áudio da guia&quot;. Funciona no Chrome e no Edge. O áudio não fica guardado, só o texto.
          </p>
        ) : null}

        {g.enviando > 0 ? (
          <p className="text-micro text-slate-600">Transcrevendo {g.enviando === 1 ? "1 trecho" : `${g.enviando} trechos`}…</p>
        ) : null}
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

      {/* A transcrição */}
      {reuniao.transcricao.length > 0 ? (
        <details className="rounded-lg border border-slate-200 bg-white">
          <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-3 py-2 text-corpo text-slate-700">
            <span>
              <strong className="font-semibold">Transcrição</strong> · {reuniao.transcricao.length}{" "}
              {reuniao.transcricao.length === 1 ? "trecho" : "trechos"} · {palavras} palavras
            </span>
            <span className="text-micro text-slate-500">clique para ler</span>
          </summary>
          <div className="max-h-96 space-y-2 overflow-y-auto border-t border-slate-100 px-3 py-2 text-corpo leading-relaxed text-slate-700">
            {reuniao.transcricao.map((t) => (
              <p key={t.id}>
                <span className="mr-1.5 text-micro font-semibold text-slate-400">{t.hora}</span>
                {t.texto}
              </p>
            ))}
          </div>
          <div className="flex justify-end border-t border-slate-100 px-3 py-1.5">
            <button type="button" onClick={apagar} disabled={pending} className="inline-flex items-center gap-1 text-micro text-slate-500 hover:text-red-700">
              <Trash2 size={11} /> Apagar transcrição
            </button>
          </div>
        </details>
      ) : null}

      {reuniao.transcricao.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={organizar} disabled={pending || Boolean(g.gravando)} className={botaoForte}>
            <Sparkles size={13} /> {pending ? "Organizando…" : "Organizar com IA"}
          </button>
          <span className="text-micro text-slate-500">
            {g.gravando ? "Pare a gravação antes de organizar." : "A IA escreve o resumo e preenche a ata: conversado, decidido e combinado."}
          </span>
        </div>
      ) : null}

      {/* O resumo */}
      {resumo || reuniao.transcricao.length > 0 ? (
        <div className="space-y-1">
          <span className={rotuloMiudo}>Resumo</span>
          <textarea
            value={resumo}
            onChange={(e) => setResumo(e.target.value)}
            onBlur={salvarResumo}
            rows={Math.min(12, Math.max(3, Math.ceil(resumo.length / 110) + 1))}
            placeholder="O resumo aparece aqui depois de organizar com IA. Dá para corrigir à mão."
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-corpo leading-relaxed text-slate-700 outline-none transition focus:border-brand-400"
          />
        </div>
      ) : null}
    </section>
  );
}
