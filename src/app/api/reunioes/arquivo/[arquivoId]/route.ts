import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/** A apresentação usada numa reunião, como ela foi enviada. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ arquivoId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { arquivoId } = await params;
  const arquivo = await prisma.meetingFile.findUnique({
    where: { id: arquivoId },
    select: { name: true, mimeType: true, data: true },
  });
  if (!arquivo) return NextResponse.json({ erro: "Arquivo não encontrado." }, { status: 404 });

  return new NextResponse(new Uint8Array(arquivo.data), {
    headers: {
      "Content-Type": arquivo.mimeType,
      // Sempre como download: o tipo vem de quem enviou, e abrir na página seria confiar nele.
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(arquivo.name)}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
