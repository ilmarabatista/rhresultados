"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

/**
 * Baixar a pasta inteira do candidato em PDF.
 *
 * O PDF sai do próprio navegador (imprimir > salvar como PDF): abre a pasta
 * inteira, espera as páginas do currículo e chama a impressão. O título da
 * página vira o nome do arquivo.
 */

export function BaixarPastaPdf({ candidato, vaga }: { candidato: string; vaga: string }) {
  return (
    <Link
      href={`?aba=tudo&pdf=1`}
      title={`Pasta de ${candidato} · ${vaga}`}
      className="flex shrink-0 items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
    >
      <Download size={15} />
      Baixar PDF da pasta
    </Link>
  );
}

/** Na pasta inteira aberta pelo botão: dá nome ao arquivo e abre a impressão. */
export function ImprimirAoAbrir({ nomeDoArquivo }: { nomeDoArquivo: string }) {
  const router = useRouter();
  useEffect(() => {
    const titulo = document.title;
    document.title = nomeDoArquivo;
    // Espera as páginas do currículo (PaginasDoCurriculo) e a avaliação
    // automática, se estiver sendo refeita, e dá um respiro para as fontes e os
    // gráficos dos testes; desiste de esperar em 90 segundos.
    const inicio = Date.now();
    let t: ReturnType<typeof setTimeout>;
    const tentar = () => {
      const { curriculos, avaliacao } = document.body.dataset;
      if ((curriculos === "carregando" || avaliacao === "carregando") && Date.now() - inicio < 90_000) {
        t = setTimeout(tentar, 300);
        return;
      }
      window.print();
      document.title = titulo;
      router.replace("?aba=tudo", { scroll: false });
    };
    t = setTimeout(tentar, 600);
    return () => {
      clearTimeout(t);
      document.title = titulo;
    };
  }, [nomeDoArquivo, router]);
  return null;
}
