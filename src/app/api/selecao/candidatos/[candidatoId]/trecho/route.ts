import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { transcreverAudio } from "@/lib/transcricao";
import { limparTrecho, TAMANHO_MAXIMO_DO_TRECHO } from "@/lib/reuniao-gravada";

export const maxDuration = 60;

/**
 * Recebe um trecho da gravação da entrevista (uns dois minutos de áudio) e
 * devolve o texto. Nada é guardado aqui: o texto vai para o campo da
 * transcrição na tela, e fica na pasta quando ela salva a entrevista. O áudio
 * não é guardado em lugar nenhum.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ candidatoId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { candidatoId } = await params;
  const candidato = await prisma.candidate.findUnique({ where: { id: candidatoId }, select: { id: true } });
  if (!candidato) return NextResponse.json({ erro: "Candidato não encontrado." }, { status: 404 });

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return NextResponse.json({ erro: "Trecho de áudio vazio." }, { status: 400 });
  }
  if (audio.size > TAMANHO_MAXIMO_DO_TRECHO) {
    return NextResponse.json({ erro: "Trecho de áudio grande demais." }, { status: 413 });
  }
  if (!audio.type.startsWith("audio/") && !audio.type.startsWith("video/")) {
    return NextResponse.json({ erro: "O trecho não é áudio." }, { status: 400 });
  }

  try {
    const extensao = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
    const texto = limparTrecho(await transcreverAudio(audio, `trecho.${extensao}`));
    return NextResponse.json({ texto });
  } catch (e) {
    return NextResponse.json(
      { erro: e instanceof Error ? e.message : "Não foi possível transcrever o trecho." },
      { status: 502 },
    );
  }
}
