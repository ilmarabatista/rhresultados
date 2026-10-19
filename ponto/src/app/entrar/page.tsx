import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { FormEntrar } from "@/components/formularios";

export const metadata = { title: "Entrar — Ponto" };

export default async function EntrarPage() {
  const s = await sessaoAtual();
  if (s) redirect(s.tipo === "admin" ? "/admin" : "/");

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <p className="text-sm font-medium uppercase tracking-widest text-marca-600">RH Resultados</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900">Ponto</h1>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <FormEntrar />
        </div>
        <p className="mt-4 text-center text-xs text-slate-500">Esqueceu a senha? Peça ao RH para redefinir.</p>
      </div>
    </main>
  );
}
