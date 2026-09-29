/**
 * O que aparece no instante do clique, enquanto a página nova é montada.
 *
 * Sem isto, o Next segurava a tela antiga até o servidor terminar a nova — o
 * clique parecia não ter pegado. Com isto, a troca é imediata e o conteúdo
 * entra quando fica pronto. Também é o que deixa o Next pré-carregar as
 * rotas dinâmicas ao passar o mouse nos links.
 */
export default function Carregando() {
  return (
    <main
      aria-busy="true"
      aria-label="Carregando"
      className="mx-auto max-w-[1600px] animate-pulse px-4 py-8 sm:px-6"
    >
      <div className="h-6 w-48 rounded bg-slate-200" />
      <div className="mt-2 h-3 w-80 max-w-full rounded bg-slate-200/70" />

      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-16 rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-24 rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>
    </main>
  );
}
