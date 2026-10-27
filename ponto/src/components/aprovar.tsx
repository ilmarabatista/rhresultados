"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, RotateCcw } from "lucide-react";
import { aprovarEspelho } from "@/app/meu-ponto/actions";
import { Erro, estiloBotao, estiloBotaoLeve } from "./ui";

/**
 * A aprovação do espelho do mês: o colaborador confirma que conferiu e tira
 * uma foto na hora, que fica com o RH como comprovante.
 */

type Passo = { nome: "inicio" } | { nome: "camera"; erro?: string } | { nome: "revisar"; foto: string } | { nome: "enviando"; foto: string };

const LARGURA_MAXIMA = 640;

export function AprovarMes({ mes }: { mes: string }) {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>({ nome: "inicio" });
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);

  const desligarCamera = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
  }, []);

  useEffect(() => desligarCamera, [desligarCamera]);

  async function abrirCamera() {
    setErroEnvio(null);
    setPasso({ nome: "camera" });
    try {
      const s = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      fluxo.current = s;
      if (video.current) {
        video.current.srcObject = s;
        await video.current.play().catch(() => undefined);
      }
    } catch {
      setPasso({ nome: "camera", erro: "A câmera não abriu. Libere a câmera deste site nas configurações do navegador e tente de novo." });
    }
  }

  function tirarFoto() {
    const v = video.current;
    if (!v || !v.videoWidth) return;
    const escala = Math.min(1, LARGURA_MAXIMA / v.videoWidth);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(v.videoWidth * escala);
    canvas.height = Math.round(v.videoHeight * escala);
    const ctx = canvas.getContext("2d")!;
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const foto = canvas.toDataURL("image/jpeg", 0.75);
    desligarCamera();
    setPasso({ nome: "revisar", foto });
  }

  async function concluir(foto: string) {
    setErroEnvio(null);
    setPasso({ nome: "enviando", foto });
    try {
      const r = await aprovarEspelho(mes, foto);
      if (r.ok) {
        router.refresh();
        return;
      }
      setErroEnvio(r.erro);
    } catch {
      setErroEnvio("Sem conexão com o servidor. Confira a internet e toque em Aprovar de novo.");
    }
    setPasso({ nome: "revisar", foto });
  }

  function cancelar() {
    desligarCamera();
    setErroEnvio(null);
    setPasso({ nome: "inicio" });
  }

  if (passo.nome === "inicio") {
    return (
      <button type="button" onClick={() => void abrirCamera()} className={`${estiloBotao} w-full py-3.5`}>
        <Check size={18} aria-hidden /> Conferi e aprovo
      </button>
    );
  }

  if (passo.nome === "camera") {
    return (
      <div className="space-y-4 text-center">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Tire uma foto sua</h2>
          <p className="mt-1 text-sm text-slate-600">A foto fica com o RH como comprovante de que foi você quem aprovou.</p>
        </div>
        <div className="relative mx-auto aspect-[3/4] w-full max-w-xs overflow-hidden rounded-xl bg-slate-900">
          <video ref={video} playsInline muted autoPlay className="h-full w-full -scale-x-100 object-cover" />
        </div>
        <Erro texto={passo.erro} />
        {passo.erro ? (
          <button type="button" onClick={() => void abrirCamera()} className={`${estiloBotao} w-full`}>
            Tentar de novo
          </button>
        ) : (
          <button type="button" onClick={tirarFoto} className={`${estiloBotao} w-full py-3.5`}>
            <Camera size={20} aria-hidden /> Tirar foto
          </button>
        )}
        <button type="button" onClick={cancelar} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    );
  }

  const enviando = passo.nome === "enviando";
  return (
    <div className="space-y-4 text-center">
      <h2 className="text-lg font-semibold text-slate-900">A foto ficou boa?</h2>
      {/* eslint-disable-next-line @next/next/no-img-element -- foto local, em data: URL */}
      <img src={passo.foto} alt="A foto que você tirou" className="mx-auto aspect-[3/4] w-full max-w-xs rounded-xl object-cover" />
      <Erro texto={erroEnvio ?? undefined} />
      <div className="grid grid-cols-2 gap-3">
        <button type="button" disabled={enviando} onClick={() => void abrirCamera()} className={estiloBotaoLeve}>
          <RotateCcw size={16} aria-hidden /> Tirar outra
        </button>
        <button type="button" disabled={enviando} onClick={() => void concluir(passo.foto)} className={estiloBotao}>
          <Check size={18} aria-hidden /> {enviando ? "Aprovando…" : "Aprovar"}
        </button>
      </div>
    </div>
  );
}
