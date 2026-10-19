import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fotoDaBatida } from "@/lib/ponto-api";

/** A foto de uma batida, trazida do sistema de ponto para quem está logado no RH. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const empresa = searchParams.get("empresa");
  const id = searchParams.get("id");
  if (!empresa || !id) return NextResponse.json({ erro: "Faltou a batida." }, { status: 400 });

  try {
    const r = await fotoDaBatida(empresa, id);
    return new Response(r.body, {
      headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ erro: "Foto não encontrada." }, { status: 404 });
  }
}
