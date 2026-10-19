import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { exigirAdmin } from "@/lib/sessao";
import { SENHA_PADRAO } from "@/lib/integracao";
import { DIAS_DA_SEMANA, cargaSemanal, horarioEscrito, horas } from "@/lib/calculo";
import { horarioDaEmpresa } from "@/lib/dados";
import { Acao, FormNovoColaborador } from "@/components/admin";
import { Cartao, Etiqueta, Topo } from "@/components/ui";
import {
  alternarColaborador,
  alternarEmpresa,
  excluirColaborador,
  redefinirSenha,
  sincronizarNome,
} from "../../actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Empresa — Ponto" };

export default async function EmpresaPage({ params }: { params: Promise<{ id: string }> }) {
  const s = await exigirAdmin();
  const { id } = await params;
  const empresa = await prisma.empresa.findUnique({
    where: { id },
    include: {
      colaboradores: {
        orderBy: [{ ativo: "desc" }, { email: "asc" }],
        include: { _count: { select: { marcacoes: true } } },
      },
    },
  });
  if (!empresa) notFound();
  const horario = horarioDaEmpresa(empresa);

  return (
    <>
      <Topo titulo="Ponto · Administração" nome={s.nome} links={[{ href: "/admin", rotulo: "Empresas" }]} />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6">
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/admin" className="text-sm text-slate-500 hover:text-marca-700">
            ‹ Empresas
          </Link>
          <h1 className="flex-1 text-xl font-semibold text-slate-900">{empresa.nome}</h1>
          {empresa.ativo ? <Etiqueta tom="bom">ponto ligado</Etiqueta> : <Etiqueta tom="ruim">ponto desligado</Etiqueta>}
          <Acao acao={sincronizarNome.bind(null, id)}>Atualizar nome do RH</Acao>
          <Acao
            acao={alternarEmpresa.bind(null, id)}
            confirmar={empresa.ativo ? "Desligar o ponto? Os colaboradores desta empresa deixam de conseguir bater ponto." : undefined}
          >
            {empresa.ativo ? "Desligar" : "Ligar"}
          </Acao>
        </div>

        <Cartao titulo="Cadastrar colaborador">
          <p className="mb-3 text-sm text-slate-600">
            O colaborador entra com o email e a senha <b>{SENHA_PADRAO}</b>, e troca a senha no primeiro acesso.
          </p>
          <FormNovoColaborador empresaId={id} />
        </Cartao>

        <Cartao titulo={`Colaboradores (${empresa.colaboradores.length})`}>
          {empresa.colaboradores.length === 0 ? (
            <p className="text-sm text-slate-500">Ninguém cadastrado ainda.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {empresa.colaboradores.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-slate-800">{c.nome ?? c.email}</p>
                    {c.nome ? <p className="truncate text-xs text-slate-500">{c.email}</p> : null}
                  </div>
                  {!c.ativo ? (
                    <Etiqueta tom="ruim">desativado</Etiqueta>
                  ) : c.trocarSenha ? (
                    <Etiqueta tom="atencao">aguardando 1º acesso</Etiqueta>
                  ) : (
                    <Etiqueta tom="bom">ativo</Etiqueta>
                  )}
                  <Acao acao={redefinirSenha.bind(null, c.id)} confirmar={`Voltar a senha de ${c.email} para ${SENHA_PADRAO}?`}>
                    Redefinir senha
                  </Acao>
                  <Acao acao={alternarColaborador.bind(null, c.id)}>{c.ativo ? "Desativar" : "Reativar"}</Acao>
                  {c._count.marcacoes === 0 ? (
                    <Acao acao={excluirColaborador.bind(null, c.id)} confirmar={`Excluir ${c.email}? Ele ainda não bateu ponto.`}>
                      Excluir
                    </Acao>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        <Cartao titulo="Horário padrão">
          <dl className="grid grid-cols-[3rem_1fr] gap-y-1 text-sm">
            {DIAS_DA_SEMANA.map((d, i) => (
              <div key={d} className="contents">
                <dt className="text-slate-500">{d}</dt>
                <dd className="tabular-nums text-slate-800">{horarioEscrito(horario[i]) || "—"}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 text-xs text-slate-500">
            {horas(cargaSemanal(horario))} semanais · {empresa.regime === "BANCO_DE_HORAS" ? "banco de horas" : "horas extras"}. Para mudar, use a aba
            Ponto da empresa no RH Resultados.
          </p>
        </Cartao>
      </main>
    </>
  );
}
