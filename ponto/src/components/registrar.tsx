"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, MapPin, RotateCcw } from "lucide-react";
import { baterPonto } from "@/app/registro-actions";
import { Erro, estiloBotao, estiloBotaoLeve } from "./ui";

/**
 * O passo a passo da batida: pede a localização, abre a câmera da frente,
 * mostra a foto e pergunta se quer tirar outra ou concluir.
 */

type Local = { latitude: number; longitude: number; precisao: number | null };
type Passo =
  | { nome: "inicio" }
  | { nome: "local"; erro?: string; buscando?: boolean }
  | { nome: "camera"; erro?: string }
  | { nome: "revisar"; foto: string }
  | { nome: "enviando"; foto: string }
  | { nome: "feito"; tipo: string; hora: string; nsr: number };

const LARGURA_MAXIMA = 640;

export function Registrar({ proxima }: { proxima: "Entrada" | "Saída" }) {
  const router = useRouter();
  const [passo, setPasso] = useState<Passo>({ nome: "inicio" });
  const [erroEnvio, setErroEnvio] = useState<string | null>(null);
  const local = useRef<Local | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const fluxo = useRef<MediaStream | null>(null);

  const desligarCamera = useCallback(() => {
    fluxo.current?.getTracks().forEach((t) => t.stop());
    fluxo.current = null;
  }, []);

  useEffect(() => desligarCamera, [desligarCamera]);

  function pedirLocal() {
    if (!("geolocation" in navigator)) {
      setPasso({ nome: "local", erro: "Este aparelho não informa a localização. Use outro celular ou fale com o RH." });
      return;
    }
    setPasso({ nome: "local", buscando: true });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        local.current = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          precisao: Number.isFinite(pos.coords.accuracy) ? pos.coords.accuracy : null,
        };
        void abrirCamera();
      },
      (erro) => {
        setPasso({
          nome: "local",
          erro:
            erro.code === erro.PERMISSION_DENIED
              ? "A localização foi recusada. Para bater o ponto, libere a localização deste site nas configurações do navegador e tente de novo."
              : "Não foi possível achar a sua localização. Confira se o GPS está ligado e tente de novo.",
        });
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 30_000 },
    );
  }

  async function abrirCamera() {
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
      setPasso({
        nome: "camera",
        erro: "A câmera não abriu. Libere a câmera deste site nas configurações do navegador e tente de novo.",
      });
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
    // Espelhada, como a pessoa se viu na tela.
    ctx.translate(canvas.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
    const foto = canvas.toDataURL("image/jpeg", 0.75);
    desligarCamera();
    setPasso({ nome: "revisar", foto });
  }

  async function concluir(foto: string) {
    if (!local.current) {
      setPasso({ nome: "local" });
      return;
    }
    setErroEnvio(null);
    setPasso({ nome: "enviando", foto });
    try {
      const r = await baterPonto({ ...local.current, foto });
      if (r.ok) {
        setPasso({ nome: "feito", tipo: r.tipo, hora: r.hora, nsr: r.nsr });
        router.refresh();
      } else {
        setErroEnvio(r.erro);
        setPasso({ nome: "revisar", foto });
      }
    } catch {
      setErroEnvio("Sem conexão com o servidor. Confira a internet e toque em Concluir de novo.");
      setPasso({ nome: "revisar", foto });
    }
  }

  function recomecar() {
    desligarCamera();
    setErroEnvio(null);
    setPasso({ nome: "inicio" });
  }

  if (passo.nome === "inicio") {
    return (
      <button type="button" onClick={() => setPasso({ nome: "local" })} className={`${estiloBotao} w-full py-4 text-lg`}>
        Registrar {proxima.toLowerCase()}
      </button>
    );
  }

  if (passo.nome === "local") {
    return (
      <div className="space-y-4 text-center">
        <MapPin className="mx-auto text-marca-600" size={36} aria-hidden />
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Permitir a localização</h2>
          <p className="mt-1 text-sm text-slate-600">
            Para registrar o ponto, precisamos saber onde você está neste momento. O local fica junto da batida e só o RH vê.
          </p>
        </div>
        <Erro texto={passo.erro} />
        <button type="button" onClick={pedirLocal} disabled={passo.buscando} className={`${estiloBotao} w-full`}>
          {passo.buscando ? "Buscando a localização…" : "Permitir e continuar"}
        </button>
        <button type="button" onClick={recomecar} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    );
  }

  if (passo.nome === "camera") {
    return (
      <div className="space-y-4 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Tire uma foto sua</h2>
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
        <button type="button" onClick={recomecar} className="text-sm text-slate-500 underline">
          Cancelar
        </button>
      </div>
    );
  }

  if (passo.nome === "revisar" || passo.nome === "enviando") {
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
            <Check size={18} aria-hidden /> {enviando ? "Registrando…" : "Concluir"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
        <Check size={30} aria-hidden />
      </div>
      <h2 className="text-lg font-semibold text-slate-900">
        {passo.tipo} registrada às {passo.hora}
      </h2>
      <p className="text-sm text-slate-500">Comprovante nº {passo.nsr}</p>
      <button type="button" onClick={recomecar} className={`${estiloBotaoLeve} w-full`}>
        Voltar
      </button>
    </div>
  );
}
