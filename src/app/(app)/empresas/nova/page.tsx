import Link from "next/link";
import { requireSession } from "@/lib/session";
import CompanyForm from "@/components/company-form";
import { createCompany } from "../actions";

export const metadata = { title: "Nova empresa — RH Resultados" };

export default async function NovaEmpresaPage() {
  await requireSession();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <Link
        href="/empresas"
        className="text-sm text-slate-500 transition hover:text-slate-900"
      >
        ← Voltar para empresas
      </Link>

      <div className="mb-8 mt-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Cadastrar nova empresa
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Informe os dados do cliente. Só o nome é obrigatório — o restante pode
          ser completado depois na aba Dados.
        </p>
      </div>

      <CompanyForm action={createCompany} submitLabel="Cadastrar empresa" />
    </main>
  );
}
