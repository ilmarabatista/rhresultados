import Link from "next/link";

export const metadata = { title: "Página não encontrada — RH Resultados" };

/** Endereço que não existe, ou registro que foi excluído. */
export default function NaoEncontrado() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="max-w-md text-center">
        <p className="text-sm font-medium text-brand-700">404</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Página não encontrada</h1>
        <p className="mt-2 text-sm text-slate-600">O endereço está errado, ou o que estava aqui foi excluído.</p>
        <Link
          href="/inicio"
          className="mt-5 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          Ir para o início
        </Link>
      </div>
    </main>
  );
}
