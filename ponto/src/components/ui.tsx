import Link from "next/link";
import { sair } from "@/app/actions";

/** As peças visuais do ponto, poucas e grandes: a tela principal é a do celular. */

export function Topo({ titulo, nome, links }: { titulo: string; nome?: string; links?: { href: string; rotulo: string }[] }) {
  return (
    <header className="bg-marca-700 text-white">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
        <Link href="/" className="text-base font-semibold tracking-tight">
          {titulo}
        </Link>
        <nav className="flex flex-1 flex-wrap gap-3 text-sm text-marca-100">
          {links?.map((l) => (
            <Link key={l.href} href={l.href} className="hover:text-white">
              {l.rotulo}
            </Link>
          ))}
        </nav>
        {nome ? <span className="text-sm text-marca-100">{nome}</span> : null}
        <form action={sair}>
          <button type="submit" className="rounded-md border border-marca-500 px-2.5 py-1 text-sm text-marca-50 hover:bg-marca-600">
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}

export function Cartao({ titulo, children, className = "" }: { titulo?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>
      {titulo ? <h2 className="mb-3 text-base font-semibold text-slate-900">{titulo}</h2> : null}
      {children}
    </section>
  );
}

export function Campo({ rotulo, dica, children }: { rotulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{rotulo}</span>
      {children}
      {dica ? <span className="mt-1 block text-xs text-slate-500">{dica}</span> : null}
    </label>
  );
}

export const estiloCampo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-base outline-none transition focus:border-marca-500 focus:ring-2 focus:ring-marca-100";

export const estiloBotao =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-marca-600 px-4 py-2.5 text-base font-medium text-white shadow-sm transition hover:bg-marca-700 disabled:opacity-60";

export const estiloBotaoLeve =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-marca-400 hover:text-marca-700 disabled:opacity-60";

export function Erro({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
      {texto}
    </p>
  );
}

export function Ok({ texto }: { texto?: string }) {
  if (!texto) return null;
  return (
    <p role="status" className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {texto}
    </p>
  );
}

export function Etiqueta({ tom = "neutro", children }: { tom?: "neutro" | "bom" | "atencao" | "ruim"; children: React.ReactNode }) {
  const cores = {
    neutro: "bg-slate-100 text-slate-700",
    bom: "bg-emerald-50 text-emerald-800",
    atencao: "bg-amber-50 text-amber-800",
    ruim: "bg-red-50 text-red-700",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cores[tom]}`}>{children}</span>;
}
