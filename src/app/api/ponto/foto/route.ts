import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { fotoDaAprovacao, fotoDaBatida } from "@/lib/ponto-api";

/**
 * A foto de uma batida (?id=) ou da aprovação do mês (?colaborador=&mes=),
 * trazida do sistema de ponto para quem está logado no RH.
 */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const empresa = searchParams.get("empresa");
  const id = searchParams.get("id");
  const colaborador = searchParams.get("colaborador");
  const mes = searchParams.get("mes");
  if (!empresa || !(id || (colaborador && mes))) return NextResponse.json({ erro: "Faltou a batida." }, { status: 400 });

  try {
    const r = id ? await fotoDaBatida(empresa, id) : await fotoDaAprovacao(empresa, colaborador!, mes!);
    return new Response(r.body, {
      headers: { "Content-Type": r.headers.get("content-type") ?? "image/jpeg", "Cache-Control": "private, max-age=86400" },
    });
  } catch {
    return NextResponse.json({ erro: "Foto não encontrada." }, { status: 404 });
  }
}
