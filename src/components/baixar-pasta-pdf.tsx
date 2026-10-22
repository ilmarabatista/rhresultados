"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Download } from "lucide-react";

/**
 * Baixar a pasta inteira do candidato em PDF.
 *
 * O PDF sai do próprio navegador (imprimir > salvar como PDF): abre a pasta
 * inteira e já chama a impressão. O título da página vira o nome do arquivo.
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
    // Um respiro para as fontes e os gráficos dos testes terminarem de desenhar.
    const t = setTimeout(() => {
      window.print();
      document.title = titulo;
      router.replace("?aba=tudo", { scroll: false });
    }, 600);
    return () => {
      clearTimeout(t);
      document.title = titulo;
    };
  }, [nomeDoArquivo, router]);
  return null;
}
