import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import LoginForm from "./login-form";

export const metadata = { title: "Entrar — RH Resultados" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/empresas");

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-slate-50 to-brand-50 px-4 py-7">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white shadow-lg shadow-brand-600/25">
            RH
          </div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Controle Operacional
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Acesso restrito a usuários cadastrados.
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <LoginForm />
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Novos acessos são criados apenas pelo administrador.
        </p>
      </div>
    </main>
  );
}
