import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ehPdf } from "@/lib/curriculo";

/**
 * O currículo do candidato. Abre no navegador (o visualizador de PDF) ou,
 * com ?baixar=1, vem como download.
 *
 * Abrir na página é seguro aqui porque só entra PDF conferido pelo conteúdo,
 * e a conferência se repete na saída: o que não for PDF sai como download.
 */
export async function GET(request: Request, { params }: { params: Promise<{ arquivoId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { arquivoId } = await params;
  const arquivo = await prisma.arquivoDoCandidato.findUnique({
    where: { id: arquivoId },
    select: { nome: true, dados: true },
  });
  if (!arquivo) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });

  const bytes = new Uint8Array(arquivo.dados);
  const baixar = new URL(request.url).searchParams.has("baixar") || !ehPdf(bytes.subarray(0, 1100));

  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${baixar ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(arquivo.nome)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
