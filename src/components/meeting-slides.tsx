"use client";

import { useRef, useTransition } from "react";
import { FileText, Upload, X } from "lucide-react";
import {
  enviarApresentacao,
  removerApresentacao,
} from "@/app/(app)/empresas/[id]/reunioes/actions";

/**
 * A apresentação usada na reunião, anexada como veio: o slide que foi
 * apresentado fica guardado junto da ata. Mais de um arquivo, quando a
 * apresentação veio em partes.
 */

export type Apresentacao = { id: string; nome: string; tamanho: number };

const ACEITOS = ".pptx,.ppt,.pdf,.odp,.key,.png,.jpg,.jpeg";

export default function MeetingSlides({
  reuniaoId,
  arquivos,
}: {
  reuniaoId: string;
  arquivos: Apresentacao[];
}) {
  const escolha = useRef<HTMLInputElement>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      {arquivos.map((a) => (
        <span
          key={a.id}
          className="inline-flex items-center overflow-hidden rounded-md border border-slate-200 bg-white text-[11px] text-slate-700"
        >
          <a
            href={`/api/reunioes/arquivo/${a.id}`}
            target="_blank"
            rel="noopener noreferrer"
            title={`Baixar ${a.nome}`}
            className="inline-flex items-center gap-1.5 px-2 py-1 transition hover:text-brand-700"
          >
            <FileText size={12} />
            <span className="max-w-[16rem] truncate">{a.nome}</span>
            <span className="text-slate-400">{Math.max(1, Math.round(a.tamanho / 1024))} KB</span>
          </a>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Tirar "${a.nome}" desta reunião?`)) return;
              startTransition(async () => {
                const r = await removerApresentacao(a.id);
                if (r.error) alert(r.error);
              });
            }}
            className="border-l border-slate-200 px-1.5 py-1 text-slate-400 transition hover:text-red-600"
            aria-label={`Tirar ${a.nome}`}
          >
            <X size={11} />
          </button>
        </span>
      ))}

      <input
        ref={escolha}
        type="file"
        accept={ACEITOS}
        className="hidden"
        onChange={(e) => {
          const arquivo = e.target.files?.[0];
          e.target.value = "";
          if (!arquivo) return;

          const dados = new FormData();
          dados.set("reuniaoId", reuniaoId);
          dados.set("arquivo", arquivo);

          startTransition(async () => {
            const r = await enviarApresentacao(dados);
            if (r.error) alert(r.error);
          });
        }}
      />
      <button
        type="button"
        disabled={pending}
        onClick={() => escolha.current?.click()}
        className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-slate-300 px-2.5 py-1 text-[11px] text-slate-500 transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-60"
      >
        <Upload size={12} />
        {pending ? "enviando…" : arquivos.length > 0 ? "anexar outra" : "anexar a apresentação usada"}
      </button>
    </div>
  );
}
