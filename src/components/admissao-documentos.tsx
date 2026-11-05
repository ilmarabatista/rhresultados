"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, FileText, Trash2, Upload } from "lucide-react";
import { DOCUMENTOS_ADMISSIONAIS, type DocumentoAdmissional } from "@/lib/admissao";
import { prepararArquivo } from "@/lib/admissao-cliente";
import { anexarArquivo, excluirArquivo } from "@/app/(app)/admissoes/actions";
import { enviarDocumento, removerDocumento } from "@/app/admissao/[token]/actions";
import { avisar, confirmar } from "@/components/avisos";

/**
 * A lista de documentos da admissão, com o que já chegou de cada um. A mesma
 * tela serve ao funcionário (pelo link, tirando foto no celular) e ao RH.
 */

export type ArquivoNaTela = { id: string; tipo: string; nome: string; mime: string; doFuncionario: boolean };

type Modo = { quem: "rh"; admissaoId: string } | { quem: "funcionario"; token: string; aberto: boolean };

function urlDoArquivo(id: string, modo: Modo) {
  return `/api/admissao/arquivo/${id}${modo.quem === "funcionario" ? `?t=${encodeURIComponent(modo.token)}` : ""}`;
}

function Documento({ doc, arquivos, modo }: { doc: DocumentoAdmissional; arquivos: ArquivoNaTela[]; modo: Modo }) {
  const router = useRouter();
  const camera = useRef<HTMLInputElement>(null);
  const galeria = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const pode = modo.quem === "rh" || modo.aberto;
  const chegou = arquivos.length > 0;

  async function enviar(lista: FileList | null) {
    if (!lista || lista.length === 0) return;
    const todos = Array.from(lista);
    for (let i = 0; i < todos.length; i++) {
      setEnviando(todos.length > 1 ? `Enviando ${i + 1} de ${todos.length}…` : "Enviando…");
      const arquivo = await prepararArquivo(todos[i]);
      const fd = new FormData();
      fd.set("tipo", doc.chave);
      fd.set("arquivo", arquivo);
      let r: { error?: string };
      try {
        if (modo.quem === "rh") {
          fd.set("admissaoId", modo.admissaoId);
          r = await anexarArquivo(fd);
        } else {
          fd.set("token", modo.token);
          r = await enviarDocumento(fd);
        }
      } catch {
        r = { error: "A conexão caiu. Tente de novo." };
      }
      if (r.error) {
        avisar(r.error);
        break;
      }
    }
    setEnviando(null);
    if (camera.current) camera.current.value = "";
    if (galeria.current) galeria.current.value = "";
    router.refresh();
  }

  async function tirar(a: ArquivoNaTela) {
    const texto =
      modo.quem === "rh" && a.doFuncionario
        ? `Apagar "${a.nome}", que o funcionário mandou? Não dá para desfazer.`
        : `Tirar "${a.nome}"?`;
    if (!(await confirmar(texto, { sim: "Apagar", nao: "Manter" }))) return;
    const r = modo.quem === "rh" ? await excluirArquivo(a.id) : await removerDocumento(modo.token, a.id);
    if (r.error) avisar(r.error);
    router.refresh();
  }

  const botao =
    "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-60";

  return (
    <li className={`rounded-lg border bg-white p-3 ${chegou ? "border-emerald-200" : "border-slate-200"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
            {chegou ? <Check size={15} className="shrink-0 text-emerald-600" /> : null}
            {doc.nome}
            {!doc.obrigatorio ? <span className="text-micro font-normal text-slate-500">(se tiver)</span> : null}
          </p>
          <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{doc.dica}</p>
        </div>

        {pode ? (
          <div className="flex shrink-0 flex-wrap gap-1.5">
            <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => enviar(e.target.files)} />
            <input ref={galeria} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => enviar(e.target.files)} />
            {modo.quem === "funcionario" ? (
              <button type="button" disabled={!!enviando} onClick={() => camera.current?.click()} className={`${botao} border-brand-600 bg-brand-600 text-white hover:bg-brand-700`}>
                <Camera size={14} /> Tirar foto
              </button>
            ) : null}
            <button type="button" disabled={!!enviando} onClick={() => galeria.current?.click()} className={`${botao} border-slate-300 bg-white text-slate-700 hover:bg-slate-50`}>
              <Upload size={14} /> {modo.quem === "funcionario" ? "Escolher arquivo" : "Anexar"}
            </button>
          </div>
        ) : null}
      </div>

      {enviando ? <p className="mt-2 text-xs text-brand-700">{enviando}</p> : null}

      {chegou ? (
        <ul className="mt-2 flex flex-wrap gap-2">
          {arquivos.map((a) => (
            <li key={a.id} className="group relative">
              <a href={urlDoArquivo(a.id, modo)} target="_blank" rel="noreferrer" title={a.nome} className="block">
                {a.mime.startsWith("image/") ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={urlDoArquivo(a.id, modo)} alt={a.nome} className="h-20 w-20 rounded-md border border-slate-200 object-cover" />
                ) : (
                  <span className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1 text-center text-micro text-slate-600">
                    <FileText size={20} className="text-red-600" />
                    <span className="line-clamp-2 break-all">{a.nome}</span>
                  </span>
                )}
              </a>
              {pode && (modo.quem === "rh" || a.doFuncionario) ? (
                <button
                  type="button"
                  onClick={() => tirar(a)}
                  aria-label={`Tirar ${a.nome}`}
                  className="absolute -right-1.5 -top-1.5 rounded-full border border-slate-200 bg-white p-1 text-slate-500 shadow-sm transition hover:text-red-600"
                >
                  <Trash2 size={12} />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export default function AdmissaoDocumentos({ arquivos, modo }: { arquivos: ArquivoNaTela[]; modo: Modo }) {
  return (
    <ul className="space-y-2">
      {DOCUMENTOS_ADMISSIONAIS.map((doc) => (
        <Documento key={doc.chave} doc={doc} arquivos={arquivos.filter((a) => a.tipo === doc.chave)} modo={modo} />
      ))}
    </ul>
  );
}
