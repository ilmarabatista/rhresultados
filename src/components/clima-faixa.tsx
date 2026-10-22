/**
 * A faixa verde e vermelha da pesquisa de clima: quantas notas ficaram na régua
 * ou acima, e abaixo. Usada nos resultados, no plano e no relatório.
 */
export function Faixa({ dentro, abaixo }: { dentro: number; abaixo: number }) {
  const total = dentro + abaixo;
  if (total === 0) return <span className="text-slate-400">—</span>;
  const pct = Math.round((dentro / total) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-2 w-24 overflow-hidden rounded-full bg-red-200" title={`${dentro} dentro, ${abaixo} abaixo`}>
        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-9 text-right tabular-nums text-slate-600">{pct}%</span>
    </div>
  );
}

