/**
 * A troca de aba dentro da ficha.
 *
 * A moldura — o nome do cliente, a coluna da esquerda, as abas — continua na
 * tela; só a área do conteúdo mostra que está carregando. É o que faz o clique
 * numa aba responder na hora, em vez de esperar a página inteira.
 */
export default function CarregandoAba() {
  return (
    <div aria-busy="true" aria-label="Carregando" className="animate-pulse space-y-3">
      <div className="h-5 w-56 rounded bg-slate-200" />
      <div className="h-3 w-96 max-w-full rounded bg-slate-200/70" />

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-14 rounded-lg border border-slate-200 bg-white" />
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="h-7 bg-brand-900/80" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2 last:border-b-0">
            <div className="h-4 w-1 rounded-full bg-slate-200" />
            <div className="h-3 flex-1 rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}
