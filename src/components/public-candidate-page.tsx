/**
 * A moldura das páginas que o candidato abre pelo link: o nome da empresa, o
 * título e o aviso quando o link não serve mais.
 */

export function AvisoAoCandidato({ titulo, texto }: { titulo: string; texto: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fa] px-4 py-7">
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-slate-900">{titulo}</h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-500">{texto}</p>
      </div>
    </main>
  );
}

export function PaginaDoCandidato({
  empresa,
  titulo,
  subtitulo,
  instrucoes,
  children,
}: {
  empresa: string | null;
  titulo: string;
  subtitulo?: string | null;
  instrucoes?: string[];
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f4f7fa]">
      <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <header className="mb-4">
          {empresa ? (
            <p className="text-xs uppercase tracking-[0.12em] text-brand-600">{empresa}</p>
          ) : null}
          <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-900">{titulo}</h1>
          {subtitulo ? <p className="mt-1 text-sm text-slate-500">{subtitulo}</p> : null}
        </header>

        {instrucoes && instrucoes.length > 0 ? (
          <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
            <h2 className="mb-2 text-sm font-semibold text-slate-900">Antes de começar</h2>
            <ol className="space-y-1.5">
              {instrucoes.map((i, n) => (
                <li key={n} className="flex gap-2 text-xs leading-relaxed text-slate-600">
                  <span className="w-4 shrink-0 text-right text-slate-300">{n + 1}</span>
                  {i}
                </li>
              ))}
            </ol>
          </section>
        ) : null}

        {children}
      </div>
    </main>
  );
}
