import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { FormTrocarSenha } from "@/components/formularios";
import { Topo } from "@/components/ui";

export const metadata = { title: "Trocar senha — Ponto" };

export default async function TrocarSenhaPage() {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  const primeiroAcesso = s.tipo === "colaborador" && s.trocarSenha;
  return (
    <>
      <Topo
        titulo={s.tipo === "admin" ? "Ponto · Administração" : "Ponto"}
        nome={s.nome}
        links={primeiroAcesso ? [] : [{ href: s.tipo === "admin" ? "/admin" : "/", rotulo: "Voltar" }]}
      />
      <main className="mx-auto max-w-sm px-4 py-8">
        <h1 className="text-xl font-semibold text-slate-900">{primeiroAcesso ? "Crie a sua senha" : "Trocar senha"}</h1>
        <p className="mb-5 mt-1 text-sm text-slate-600">
          {primeiroAcesso
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
