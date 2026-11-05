import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { tipoDoArquivo } from "@/lib/admissao";

/**
 * Um arquivo da admissão. Com sessão, qualquer um; sem sessão, só com o
 * token do link da própria admissão (?t=), para o funcionário ver o que
 * mandou. O tipo de saída é conferido de novo pelos bytes.
 */
export async function GET(request: Request, { params }: { params: Promise<{ arquivoId: string }> }) {
  const url = new URL(request.url);
  const session = await getSession();
  const token = url.searchParams.get("t") ?? "";
  if (!session && !token) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { arquivoId } = await params;
  const arquivo = await prisma.documentoDaAdmissao.findUnique({
    where: { id: arquivoId },
    select: { nome: true, dados: true, admissao: { select: { token: true } } },
  });
  if (!arquivo || (!session && arquivo.admissao.token !== token)) {
    return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });
  }

  const bytes = new Uint8Array(arquivo.dados);
  const mime = tipoDoArquivo(bytes.subarray(0, 1100));
  const baixar = url.searchParams.has("baixar") || !mime;

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": mime ?? "application/octet-stream",
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
