"use client";

import { useEffect, useState } from "react";

/**
 * As páginas dos currículos em PDF, desenhadas como imagens dentro da pasta
 * inteira: assim saem junto quando ela imprime ou baixa a pasta em PDF.
 *
 * Enquanto desenha, marca a página com data-curriculos="carregando"; a
 * impressão automática do "Baixar PDF da pasta" espera essa marca sair.
 */

type Pagina = { src: string; largura: number; altura: number };
type Arquivo = { id: string; nome: string };

/** Resolução do desenho: nítido no papel sem pesar demais a página. */
const ESCALA = 1.6;

async function desenhar(id: string): Promise<Pagina[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  const dados = await fetch(`/api/selecao/curriculo/${id}`).then((r) => {
    if (!r.ok) throw new Error(String(r.status));
    return r.arrayBuffer();
  });
  const doc = await pdfjs.getDocument({ data: dados }).promise;
  const paginas: Pagina[] = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const vista = pagina.getViewport({ scale: ESCALA });
    const tela = document.createElement("canvas");
    tela.width = Math.ceil(vista.width);
    tela.height = Math.ceil(vista.height);
    const ctx = tela.getContext("2d");
    if (!ctx) continue;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, tela.width, tela.height);
    await pagina.render({ canvasContext: ctx, viewport: vista }).promise;
    paginas.push({ src: tela.toDataURL("image/jpeg", 0.85), largura: tela.width, altura: tela.height });
  }
  await doc.destroy();
  return paginas;
}

export default function PaginasDoCurriculo({
  arquivos,
  quebrarAntes = true,
  className = "space-y-3 break-after-page",
}: {
  arquivos: Arquivo[];
  /** Falso: a primeira página segue na folha corrente (logo abaixo do título). */
  quebrarAntes?: boolean;
  className?: string;
}) {
  const [paginas, setPaginas] = useState<Record<string, Pagina[] | "erro">>({});
  const chave = arquivos.map((a) => a.id).join(",");

  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    document.body.dataset.curriculos = "carregando";
    (async () => {
      for (const id of chave.split(",")) {
        const r = await desenhar(id).catch(() => "erro" as const);
        if (!vivo) return;
        setPaginas((p) => ({ ...p, [id]: r }));
      }
      if (vivo) delete document.body.dataset.curriculos;
    })();
    return () => {
      vivo = false;
      delete document.body.dataset.curriculos;
    };
  }, [chave]);

  if (arquivos.length === 0) return null;
  // Cada página do currículo numa folha, e a ficha começa na folha seguinte.
  return (
    <div className={className}>
      {arquivos.map((a, n) => {
        const p = paginas[a.id];
        return (
          <div key={a.id} className="space-y-2">
            {p === undefined ? (
              <p className="text-micro text-slate-500">Preparando as páginas de &ldquo;{a.nome}&rdquo;…</p>
            ) : p === "erro" ? (
              <p className="text-micro text-red-700">Não foi possível mostrar &ldquo;{a.nome}&rdquo; aqui. Ele continua anexado para abrir ou baixar.</p>
            ) : (
              p.map((pg, i) => (
                // eslint-disable-next-line @next/next/no-img-element -- imagem gerada no navegador, sem otimização possível
                <img
                  key={i}
                  src={pg.src}
                  width={pg.largura}
                  height={pg.altura}
                  alt={`${a.nome}, página ${i + 1}`}
                  className={`mx-auto block h-auto w-full max-w-3xl border border-slate-200 print:max-w-none print:border-0 ${
                    quebrarAntes || n > 0 || i > 0 ? "break-before-page" : ""
                  } ${quebrarAntes ? "" : "print:max-h-[240mm] print:w-auto"}`}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
