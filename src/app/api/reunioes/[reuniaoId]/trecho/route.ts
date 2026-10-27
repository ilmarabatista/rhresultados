import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { transcreverAudio } from "@/lib/transcricao";
import { limparTrecho, TAMANHO_MAXIMO_DO_TRECHO } from "@/lib/reuniao-gravada";

export const maxDuration = 60;

/**
 * Recebe um trecho da gravação da reunião (uns dois minutos de áudio), passa
 * para texto e guarda o texto. O áudio não é guardado.
 *
 * Responde o texto do trecho, para a página mostrar a transcrição crescendo.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ reuniaoId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { reuniaoId } = await params;
  const reuniao = await prisma.meeting.findUnique({
    where: { id: reuniaoId },
    select: { companyId: true },
  });
  if (!reuniao) return NextResponse.json({ erro: "Reunião não encontrada." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const inicio = Number(form?.get("inicio"));
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ erro: "Trecho de áudio vazio." }, { status: 400 });
  }
  if (audio.size > TAMANHO_MAXIMO_DO_TRECHO) {
    return NextResponse.json({ erro: "Trecho de áudio grande demais." }, { status: 413 });
  }
  if (!audio.type.startsWith("audio/") && !audio.type.startsWith("video/")) {
    return NextResponse.json({ erro: "O trecho não é áudio." }, { status: 400 });
  }

  // Quando o trecho começou; sem um horário que faça sentido, agora.
  const agora = Date.now();
  const gravadoEm = Number.isFinite(inicio) && Math.abs(agora - inicio) < 6 * 3600_000 ? new Date(inicio) : new Date(agora);

  let texto: string;
  try {
    const extensao = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
    texto = limparTrecho(await transcreverAudio(audio, `trecho.${extensao}`));
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Não foi possível transcrever o trecho." },
      { status: 502 },
    );
  }

  // Trecho de silêncio: nada a guardar.
  if (texto) {
    await prisma.meetingTranscriptPart.create({
      data: { meetingId: reuniaoId, recordedAt: gravadoEm, text: texto },
    });
    revalidatePath(`/empresas/${reuniao.companyId}/reunioes/${reuniaoId}`);
  }

  return NextResponse.json({ texto });
}
