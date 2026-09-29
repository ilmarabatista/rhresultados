"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";

/**
 * Campo de texto com ditado por voz.
 *
 * Usa a Web Speech API do próprio navegador — sem chave de API e sem custo.
 * Ela existe no Chrome e no Edge; no Firefox e no Safari o botão não aparece,
 * e o campo funciona como um textarea comum.
 *
 * O reconhecimento roda em modo contínuo: o trecho já reconhecido é fixado no
 * texto e o trecho em andamento aparece em tempo real, sendo substituído
 * conforme o navegador refina o que ouviu.
 */

type ResultadoFala = {
  isFinal: boolean;
  0: { transcript: string };
};

type EventoFala = {
  resultIndex: number;
  results: { length: number; [i: number]: ResultadoFala };
};

type Reconhecimento = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: EventoFala) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type ConstrutorReconhecimento = new () => Reconhecimento;

function obterConstrutor(): ConstrutorReconhecimento | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: ConstrutorReconhecimento;
    webkitSpeechRecognition?: ConstrutorReconhecimento;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const ERROS: Record<string, string> = {
  "not-allowed":
    "Permissão de microfone negada. Libere o acesso nas configurações do navegador.",
  "service-not-allowed":
    "O navegador bloqueou o serviço de reconhecimento de voz.",
  "no-speech": "Não ouvi nada. Tente falar mais perto do microfone.",
  network: "Sem conexão com o serviço de reconhecimento de voz.",
  "audio-capture": "Nenhum microfone encontrado.",
};

export default function DictationTextarea({
  name,
  rows = 6,
  placeholder,
  defaultValue = "",
  required,
  id,
  onValueChange,
}: {
  name: string;
  rows?: number;
  placeholder?: string;
  defaultValue?: string;
  required?: boolean;
  id?: string;
  /** Avisa o pai a cada mudança, para quem precisa do texto fora do form. */
  onValueChange?: (valor: string) => void;
}) {
  const [valor, setValor] = useState(defaultValue);
  const [gravando, setGravando] = useState(false);
  const [suportado, setSuportado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  /** Texto já consolidado; o trecho provisório é somado só na exibição. */
  const baseRef = useRef(defaultValue);

  const reconhecimentoRef = useRef<Reconhecimento | null>(null);

  function aplicar(texto: string) {
    setValor(texto);
    onValueChange?.(texto);
  }

  useEffect(() => {
    setSuportado(obterConstrutor() !== null);
    return () => reconhecimentoRef.current?.abort();
  }, []);

  function parar() {
    reconhecimentoRef.current?.stop();
    setGravando(false);
  }

  function iniciar() {
    const Construtor = obterConstrutor();
    if (!Construtor) return;

    setErro(null);
    const r = new Construtor();
    r.lang = "pt-BR";
    r.continuous = true;
    r.interimResults = true;

    r.onresult = (e) => {
      let provisorio = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const trecho = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          const separador =
            baseRef.current && !/\s$/.test(baseRef.current) ? " " : "";
          baseRef.current += separador + trecho.trim();
        } else {
          provisorio += trecho;
        }
      }
      aplicar(baseRef.current + (provisorio ? ` ${provisorio.trim()}` : ""));
    };

    r.onerror = (e) => {
      // "aborted" acontece quando nós mesmos paramos; não é falha.
      if (e.error !== "aborted") {
        setErro(ERROS[e.error] ?? "Não foi possível usar o microfone.");
      }
      setGravando(false);
    };

    r.onend = () => {
      // Sem trecho provisório pendente ao encerrar.
      aplicar(baseRef.current);
      setGravando(false);
    };

    reconhecimentoRef.current = r;
    r.start();
    setGravando(true);
  }

  return (
    <div>
      <div className="relative">
        <textarea
          id={id}
          name={name}
          rows={rows}
          required={required}
          placeholder={placeholder}
          value={valor}
          onChange={(e) => {
            aplicar(e.target.value);
            baseRef.current = e.target.value;
          }}
          className={`w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100 ${
            suportado ? "pb-11" : ""
          } ${gravando ? "border-red-300 ring-2 ring-red-100" : ""}`}
        />

        {suportado ? (
          <button
            type="button"
            onClick={gravando ? parar : iniciar}
            aria-pressed={gravando}
            className={`absolute bottom-2.5 left-2.5 flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition ${
              gravando
                ? "bg-red-600 text-white hover:bg-red-700"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
            }`}
          >
            {gravando ? (
              <>
                <Square size={12} fill="currentColor" />
                Parar
                <span className="ml-0.5 h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
              </>
            ) : (
              <>
                <Mic size={13} />
                Ditar
              </>
            )}
          </button>
        ) : null}
      </div>

      {erro ? (
        <p role="alert" className="mt-1.5 text-xs text-red-600">
          {erro}
        </p>
      ) : gravando ? (
        <p className="mt-1.5 text-xs text-red-600">
          Ouvindo… fale normalmente e clique em Parar quando terminar.
        </p>
      ) : !suportado ? (
        <p className="mt-1.5 text-xs text-slate-400">
          O ditado por voz está disponível no Chrome e no Edge.
        </p>
      ) : null}
    </div>
  );
}
