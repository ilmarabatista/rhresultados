import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * O que o navegador precisa para montar o pacote da contabilidade: os dados
 * iniciais e a lista dos arquivos. Os PDFs são montados no navegador, um
 * arquivo por vez, porque a Vercel não devolve mais de 4,5 MB numa resposta.
 */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { id } = await params;
  const a = await prisma.admissao.findUnique({
    where: { id },
    select: {
      nome: true,
      cnpj: true,
      razaoSocial: true,
      branch: { select: { name: true } },
      cpf: true,
      dataNascimento: true,
      funcao: true,
      telefone: true,
      dataAdmissao: true,
      observacoes: true,
      enviadoAoMedicoEm: true,
      exameData: true,
      exameHora: true,
      exameLocal: true,
      naoSeAplica: true,
      company: { select: { name: true, legalName: true } },
      documentos: { orderBy: { criadoEm: "asc" }, select: { id: true, tipo: true, mime: true, nome: true } },
    },
  });
  if (!a) return NextResponse.json({ erro: "Admissão não encontrada." }, { status: 404 });

  return NextResponse.json(a, { headers: { "Cache-Control": "private, no-store" } });
}
