"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Quando uma página ou um clique falha (banco fora do ar, conexão caiu), a
 * pessoa vê isto em vez da tela de erro em inglês do Next, com como seguir.
 */
export default function Erro({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="mx-auto max-w-xl px-4 py-16 sm:px-6">
      <div role="alert" className="rounded-lg border border-red-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">Algo deu errado</h1>
        <p className="mt-2 text-sm text-slate-600">
          Não foi possível concluir o que você pediu. Confira a conexão com a internet e tente de novo. Se continuar,
          avise quem cuida do sistema{error.digest ? ` e informe o código ${error.digest}` : ""}.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Tentar de novo
          </button>
          <Link
            href="/inicio"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            Ir para o início
          </Link>
        </div>
      </div>
    </main>
  );
}
