import "server-only";
import { prisma } from "./prisma";
import { contagemDosDocumentos, etapaDaAdmissao } from "./admissao";
import type { EmpresaDaAdmissao } from "@/components/admissao-form";

/** As empresas para escolher na admissão, com o CNPJ e os cargos de cada uma. */
export async function empresasDaAdmissao(): Promise<EmpresaDaAdmissao[]> {
  const lista = await prisma.company.findMany({
    where: { contractStatus: { not: "ENCERRADO" } },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      cnpj: true,
      legalName: true,
      branches: { orderBy: [{ isHeadquarters: "desc" }, { name: "asc" }], select: { id: true, name: true, cnpj: true, legalName: true } },
      cargos: { orderBy: { nome: "asc" }, select: { nome: true } } },
  });
  return lista.map((e) => ({
    id: e.id,
    nome: e.name,
    cnpj: e.cnpj,
    razaoSocial: e.legalName,
    unidades: e.branches.map((b) => ({ id: b.id, nome: b.name, cnpj: b.cnpj, razaoSocial: b.legalName })),
    cargos: e.cargos.map((c) => c.nome),
  }));
}

/** As admissões, da mais nova para a mais antiga, com a etapa de cada uma. */
export async function listaDeAdmissoes(companyId?: string) {
  const lista = await prisma.admissao.findMany({
    where: companyId ? { companyId } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
    select: {
      id: true,
      nome: true,
      funcao: true,
      createdAt: true,
      cpf: true,
      dataNascimento: true,
      exameData: true,
      enviadoAoMedicoEm: true,
      documentosEnviadosEm: true,
      pacoteGeradoEm: true,
      naoSeAplica: true,
      company: { select: { id: true, name: true } },
      documentos: { select: { tipo: true }, distinct: ["tipo"] },
    },
  });
  return lista.map((a) => {
    const tipos = a.documentos.map((d) => d.tipo);
    return {
      id: a.id,
      nome: a.nome,
      funcao: a.funcao,
      empresa: a.company,
      createdAt: a.createdAt,
      etapa: etapaDaAdmissao({ ...a, tipos }),
      documentos: contagemDosDocumentos(tipos, a.naoSeAplica),
    };
  });
}
