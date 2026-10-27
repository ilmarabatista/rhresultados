import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { anexoDoPedido } from "@/lib/ponto-api";

/** O atestado (foto ou PDF) que o colaborador mandou, trazido do sistema de ponto para quem está logado no RH. */
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ erro: "Não autenticado." }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const empresa = searchParams.get("empresa");
  const id = searchParams.get("id");
  if (!empresa || !id) return NextResponse.json({ erro: "Faltou o pedido." }, { status: 400 });

  try {
    const r = await anexoDoPedido(empresa, id);
    const tipo = r.headers.get("content-type") ?? "application/octet-stream";
    return new Response(r.body, {
      headers: {
        "Content-Type": ["image/jpeg", "image/png", "application/pdf"].includes(tipo) ? tipo : "application/octet-stream",
        "Content-Disposition": r.headers.get("content-disposition") ?? "inline",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch {
    return NextResponse.json({ erro: "Anexo não encontrado." }, { status: 404 });
  }
}
