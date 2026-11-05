import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { paraCampoDeData } from "@/lib/dates";
import { DOCUMENTOS_ADMISSIONAIS, dadosQueFaltam, dataBR, documentosQueFaltam, formatarCnpj, formatarCpf } from "@/lib/admissao";
import { empresasDaAdmissao } from "@/lib/admissao-dados";
import AdmissaoPassos from "@/components/admissao-passos";
import AdmissaoDocumentos from "@/components/admissao-documentos";
import AdmissaoForm from "@/components/admissao-form";
import { Painel } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admissão — RH Resultados" };

/** Uma admissão: os passos, os dados iniciais e os documentos que chegaram. */
export default async function AdmissaoPage({ params }: { params: Promise<{ id: string }> }) {
  await requireSession();
  const { id } = await params;

  const a = await prisma.admissao.findUnique({
    where: { id },
    include: {
      company: { select: { id: true, name: true } },
      branch: { select: { name: true } },
      documentos: { orderBy: { criadoEm: "asc" }, select: { id: true, tipo: true, nome: true, mime: true, enviadoPor: true } },
    },
  });
  if (!a) notFound();
  const empresas = await empresasDaAdmissao();
  if (!empresas.some((e) => e.id === a.companyId)) {
    empresas.push({ id: a.company.id, nome: a.company.name, cnpj: a.cnpj, razaoSocial: a.razaoSocial, unidades: [], cargos: [] });
  }

  const tipos = new Set(a.documentos.map((d) => d.tipo));
  const faltando = documentosQueFaltam([...tipos], a.naoSeAplica).map((d) => d.nome);
  const iso = (d: Date | null) => (d ? d.toISOString() : null);

  return (
    <main className="mx-auto max-w-6xl space-y-3.5 px-4 py-5 sm:px-6">
      <header>
        <Link href="/admissoes" className="text-xs text-slate-500 transition hover:text-brand-700">
          ‹ Assinatura de carteira
        </Link>
        <h1 className="mt-1 text-lg font-semibold tracking-tight text-slate-900">{a.nome}</h1>
        <p className="text-xs text-slate-500">
          {a.funcao ?? "Função a responder"} ·{" "}
          <Link href={`/empresas/${a.company.id}/admissoes`} className="hover:text-brand-700">
            {a.company.name}
          </Link>
        </p>
      </header>

      <div className="grid gap-3.5 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
        <div className="space-y-3.5">
          <Painel titulo="Passo a passo">
            <AdmissaoPassos
              id={a.id}
              token={a.token}
              dados={{ empresa: a.company.name, razaoSocial: a.razaoSocial, cnpj: a.cnpj, nome: a.nome, cpf: a.cpf, dataNascimento: a.dataNascimento, funcao: a.funcao }}
              telefone={a.telefone}
              faltamDados={dadosQueFaltam(a)}
              linkDadosEnviadoEm={iso(a.linkDadosEnviadoEm)}
              dadosPreenchidosEm={iso(a.dadosPreenchidosEm)}
              consulta={{ data: paraCampoDeData(a.exameData), hora: a.exameHora ?? "", local: a.exameLocal ?? "" }}
              enviadoAoMedicoEm={iso(a.enviadoAoMedicoEm)}
              linkEnviadoEm={iso(a.linkEnviadoEm)}
              documentosEnviadosEm={iso(a.documentosEnviadosEm)}
              pacoteGeradoEm={iso(a.pacoteGeradoEm)}
              temAso={tipos.has("ASO")}
              recebidos={DOCUMENTOS_ADMISSIONAIS.filter((d) => tipos.has(d.chave)).length}
              obrigatoriosFaltando={faltando}
              totalArquivos={a.documentos.length}
              naEquipe={a.employeeId ? { companyId: a.companyId, employeeId: a.employeeId } : null}
            />
          </Painel>

          <Painel titulo="Dados iniciais">
            <dl className="grid grid-cols-[8rem_minmax(0,1fr)] gap-x-3 gap-y-1 text-xs">
              {a.branch ? (
                <>
                  <dt className="text-slate-500">Unidade</dt>
                  <dd className="text-slate-800">{a.branch.name}</dd>
                </>
              ) : null}
              {a.razaoSocial ? (
                <>
                  <dt className="text-slate-500">Razão social</dt>
                  <dd className="text-slate-800">{a.razaoSocial}</dd>
                </>
              ) : null}
              <dt className="text-slate-500">CNPJ</dt>
              <dd className="text-slate-800">{formatarCnpj(a.cnpj)}</dd>
              <dt className="text-slate-500">CPF</dt>
              <dd className="text-slate-800">{a.cpf ? formatarCpf(a.cpf) : "a responder"}</dd>
              <dt className="text-slate-500">Nascimento</dt>
              <dd className="text-slate-800">{dataBR(a.dataNascimento) || "a responder"}</dd>
              <dt className="text-slate-500">Função</dt>
              <dd className="text-slate-800">{a.funcao ?? "a responder"}</dd>
              {a.dataAdmissao ? (
                <>
                  <dt className="text-slate-500">Começa em</dt>
                  <dd className="text-slate-800">{dataBR(a.dataAdmissao)}</dd>
                </>
              ) : null}
              {a.telefone ? (
                <>
                  <dt className="text-slate-500">WhatsApp</dt>
                  <dd className="text-slate-800">{a.telefone}</dd>
                </>
              ) : null}
            </dl>
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-brand-700">Editar dados</summary>
              <div className="mt-3">
                <AdmissaoForm
                  empresas={empresas}
                  valores={{
                    id: a.id,
                    companyId: a.companyId,
                    branchId: a.branchId ?? "",
                    cnpj: a.cnpj,
                    razaoSocial: a.razaoSocial ?? "",
                    nome: a.nome,
                    cpf: a.cpf ?? "",
                    dataNascimento: paraCampoDeData(a.dataNascimento),
                    funcao: a.funcao ?? "",
                    telefone: a.telefone ?? "",
                    dataAdmissao: paraCampoDeData(a.dataAdmissao),
                    observacoes: a.observacoes ?? "",
                  }}
                />
              </div>
            </details>
          </Painel>
        </div>

        <Painel titulo="Documentos" descricao="O que o funcionário mandou pelo link. Você também pode anexar daqui.">
          <AdmissaoDocumentos
            modo={{ quem: "rh", admissaoId: a.id }}
            naoSeAplica={a.naoSeAplica}
            arquivos={a.documentos.map((d) => ({ id: d.id, tipo: d.tipo, nome: d.nome, mime: d.mime, doFuncionario: d.enviadoPor === "FUNCIONARIO" }))}
          />
        </Painel>
      </div>
    </main>
  );
}
