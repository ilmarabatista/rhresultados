"use client";

import { useEffect, useRef, useState } from "react";
import { SEGUNDOS_POR_TRECHO } from "@/lib/reuniao-gravada";

/**
 * O gravador do navegador, usado na reunião online e na entrevista do
 * candidato.
 *
 * Grava o microfone e, se pedido, o som de uma aba (o Meet) ou do computador
 * inteiro (a chamada do WhatsApp). O som vai em trechos de dois minutos, e
 * cada trecho volta como texto. Se a aba fechar no meio, só se perde o
 * trecho em andamento. O áudio não fica guardado em lugar nenhum.
 */

export function relogio(segundos: number): string {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  const dois = (n: number) => String(n).padStart(2, "0");
  return h ? `${h}:${dois(m)}:${dois(s)}` : `${dois(m)}:${dois(s)}`;
}

export type Pendente = { audio: Blob; inicio: number };

/** De onde vem o som dos outros: a aba do Meet, o computador inteiro ou só o microfone. */
export type ModoDeGravar = "meet" | "computador" | "microfone";

function tipoDoAudio(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"].find((t) =>
    MediaRecorder.isTypeSupported(t),
  );
}

/**
 * Grava o áudio em trechos de alguns minutos e manda cada trecho a
 * `endereco`, que responde `{ texto }`. `aoTranscrever` recebe o texto de
 * cada trecho, na ordem em que foi gravado.
 */
export function useGravador(endereco: string, aoTranscrever: (texto: string) => void) {
  const [gravando, setGravando] = useState<null | ModoDeGravar>(null);
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

  async function mandarUmaVez(p: Pendente): Promise<{ erro: string } | { texto: string }> {
    const form = new FormData();
    form.append("audio", p.audio, "trecho");
    form.append("inicio", String(p.inicio));
    const resposta = await fetch(endereco, { method: "POST", body: form });
    const dados = (await resposta.json().catch(() => null)) as { erro?: string; texto?: string } | null;
    return resposta.ok
      ? { texto: typeof dados?.texto === "string" ? dados.texto : "" }
      : { erro: dados?.erro ?? `Falha ao transcrever (HTTP ${resposta.status}).` };
  }

  function mandar(p: Pendente) {
    // Menos de 2 KB é só o cabeçalho do arquivo: nada foi dito.
    if (p.audio.size < 2_000) return;
    setEnviando((n) => n + 1);
    fila.current = fila.current.then(async () => {
      let ultimo: { erro: string } | { texto: string } = { erro: "" };
      for (let tentativa = 0; tentativa < 3; tentativa++) {
        if (tentativa) await new Promise((r) => setTimeout(r, tentativa * 5_000));
        try {
          ultimo = await mandarUmaVez(p);
        } catch {
          ultimo = { erro: "Sem conexão com o sistema." };
        }
        if ("texto" in ultimo) break;
      }
      setEnviando((n) => n - 1);
      if ("erro" in ultimo) {
        setErro(ultimo.erro);
        setFalhas((f) => [...f, p]);
      } else {
        aoTranscreverRef.current(ultimo.texto);
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

  /**
   * Para de gravar. A promessa termina quando o último trecho já voltou como
   * texto (ou falhou), para quem quer fazer algo com a transcrição completa.
   */
  function parar(): Promise<void> {
    if (troca.current) window.clearInterval(troca.current);
    if (cronometro.current) window.clearInterval(cronometro.current);
    troca.current = cronometro.current = null;
    const ultimo = gravador.current;
    let parou: Promise<void> = Promise.resolve();
    if (ultimo && ultimo.state !== "inactive") {
      // O onstop (que põe o trecho na fila) roda antes deste aviso.
      parou = new Promise((fim) => ultimo.addEventListener("stop", () => setTimeout(fim, 0), { once: true }));
      ultimo.stop();
    }
    gravador.current = null;
    fontes.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    fontes.current = [];
    void contexto.current?.close();
    contexto.current = null;
    misturado.current = null;
    setGravando(null);
    return parou.then(() => fila.current);
  }

  async function iniciar(modo: ModoDeGravar) {
    setErro(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setErro("Este navegador não grava áudio. Use o Chrome ou o Edge no computador.");
      return;
    }

    try {
      let tela: MediaStream | null = null;
      if (modo !== "microfone") {
        // Primeiro o compartilhamento: é a parte que a pessoa pode errar.
        tela = await navigator.mediaDevices.getDisplayMedia({
          // No modo computador, o Chrome já abre na aba "Tela inteira", a
          // única que traz o som dos outros programas.
          video: modo === "computador" ? ({ displaySurface: "monitor" } as MediaTrackConstraints) : true,
          audio: true,
          // Dicas do Chrome: com o som marcado, e sem oferecer esta aba.
          ...({
            selfBrowserSurface: "exclude",
            systemAudio: "include",
            preferCurrentTab: false,
            monitorTypeSurfaces: "include",
          } as object),
        } as DisplayMediaStreamOptions);
        if (tela.getAudioTracks().length === 0) {
          tela.getTracks().forEach((t) => t.stop());
          setErro(
            modo === "meet"
              ? 'A aba foi compartilhada sem o som. Clique de novo, escolha a aba do Meet e deixe marcado "Compartilhar áudio da guia".'
              : 'A tela foi compartilhada sem o som. Clique de novo, escolha "Tela inteira" e deixe marcado "Compartilhar áudio do sistema". Esse som só existe no Chrome ou Edge do Windows.',
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
        tela.getTracks().forEach((t) => t.addEventListener("ended", () => void parar()));
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
  useEffect(() => () => void parar(), []);

  return { gravando, segundos, enviando, falhas: falhas.length, erro, iniciar, parar, reenviar };
}
