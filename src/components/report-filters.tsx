"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Filtros do relatório. Escrevem na URL para que o relatório montado seja
 * um endereço compartilhável e reimprimível.
 */
export default function ReportFilters({
  empresas,
  empresaAtual,
  de,
  ate,
}: {
  empresas: { id: string; name: string }[];
  empresaAtual: string;
  de: string;
  ate: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function alterar(chave: string, valor: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (valor) params.set(chave, valor);
    else params.delete(chave);
    router.push(`${pathname}?${params.toString()}`);
  }

  const campo =
    "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">Empresa</span>
        <select
          value={empresaAtual}
          onChange={(e) => alterar("empresa", e.target.value)}
          className={campo}
        >
          <option value="">Selecione…</option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">De</span>
        <input
          type="date"
          value={de}
          onChange={(e) => alterar("de", e.target.value)}
          className={campo}
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs text-slate-500">Até</span>
        <input
          type="date"
          value={ate}
          onChange={(e) => alterar("ate", e.target.value)}
          className={campo}
        />
      </label>
    </div>
  );
}
