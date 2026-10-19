import { exigirColaborador } from "@/lib/sessao";
import { FormTrocarSenha } from "@/components/formularios";
import { Topo } from "@/components/ui";

export const metadata = { title: "Trocar senha — Ponto" };

export default async function TrocarSenhaPage() {
  const s = await exigirColaborador({ podeComSenhaPadrao: true });
  return (
    <>
      <Topo titulo="Ponto" nome={s.nome} />
      <main className="mx-auto max-w-sm px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">{s.trocarSenha ? "Crie a sua senha" : "Trocar senha"}</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">
          {s.trocarSenha
            ? "Este é o seu primeiro acesso. Troque a senha padrão por uma só sua antes de bater o ponto."
            : "Digite a senha atual e a nova."}
        </p>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <FormTrocarSenha />
        </div>
      </main>
    </>
  );
}
