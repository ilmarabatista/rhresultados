"use client";

import { useRef, useTransition } from "react";
import { Download, FileText, Paperclip, Trash2 } from "lucide-react";
import { anexarCurriculo, excluirCurriculo } from "@/app/(app)/selecao/actions";
import { TAMANHO_DO_CURRICULO, TAMANHO_DO_CURRICULO_TEXTO, tamanhoLegivel } from "@/lib/curriculo";
import { avisar } from "./avisos";

/**
 * Os currículos em PDF do candidato: anexar, abrir, baixar e excluir.
 *
 * `compacto` é a versão do cartão no quadro da vaga; a outra é a da pasta.
 */

export type CurriculoNaTela = { id: string; nome: string; tamanho: number; enviadoEm?: string };

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-micro text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";

export default function CurriculoDoCandidato({
  candidatoId,
  arquivos,
  compacto = false,
}: {
  candidatoId: string;
  arquivos: CurriculoNaTela[];
  compacto?: boolean;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [pendente, iniciar] = useTransition();

  function enviar(arquivo: File) {
    // Conferido aqui também para não subir 20 MB e só então ouvir que não cabe.
    if (arquivo.size > TAMANHO_DO_CURRICULO) {
      avisar(`O arquivo passa de ${TAMANHO_DO_CURRICULO_TEXTO}. Salve o PDF em tamanho menor e envie de novo.`);
      return;
    }
    const dados = new FormData();
    dados.set("candidatoId", candidatoId);
    dados.set("arquivo", arquivo);
    iniciar(async () => {
      const r = await anexarCurriculo(dados);
      if (r.error) avisar(r.error);
    });
  }

  function excluir(a: CurriculoNaTela) {
    if (!confirm(`Excluir "${a.nome}"? Não dá para desfazer.`)) return;
    iniciar(async () => {
      const r = await excluirCurriculo(a.id);
      if (r.error) avisar(r.error);
    });
  }

  const anexar = (
    <>
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,.pdf"
        className="sr-only"
        aria-label="Arquivo do currículo em PDF"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) enviar(f);
          e.target.value = "";
        }}
      />
      <button type="button" className={`${botao} no-print`} disabled={pendente} onClick={() => entrada.current?.click()}>
        <Paperclip className="h-3 w-3" /> {pendente ? "Enviando…" : arquivos.length ? "Anexar outro" : "Anexar currículo"}
      </button>
    </>
  );

  if (compacto) {
    return (
      <div className="space-y-1">
        {arquivos.map((a) => (
          <a
            key={a.id}
            href={`/api/selecao/curriculo/${a.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 truncate text-micro text-brand-700 hover:underline"
            title={a.nome}
          >
            <FileText className="h-3 w-3 shrink-0" /> <span className="truncate">{a.nome}</span>
          </a>
        ))}
        <div className="flex">{anexar}</div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {arquivos.length === 0 ? (
        <p className="text-mini text-slate-500">Nenhum currículo anexado. Só PDF, até {TAMANHO_DO_CURRICULO_TEXTO}.</p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {arquivos.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-2 py-1.5">
              <FileText className="h-4 w-4 shrink-0 text-slate-400" />
              <a href={`/api/selecao/curriculo/${a.id}`} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-mini text-brand-700 hover:underline">
                {a.nome}
              </a>
              <span className="text-micro text-slate-500">
                {tamanhoLegivel(a.tamanho)}
                {a.enviadoEm ? ` · ${a.enviadoEm}` : ""}
              </span>
              <a href={`/api/selecao/curriculo/${a.id}?baixar=1`} className={`${botao} no-print`} title="Baixar">
                <Download className="h-3 w-3" />
              </a>
              <button type="button" className={`${botao} no-print`} disabled={pendente} title="Excluir" onClick={() => excluir(a)}>
                <Trash2 className="h-3 w-3" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {anexar}
    </div>
  );
}
