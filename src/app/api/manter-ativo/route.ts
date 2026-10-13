import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Mantém o banco da nuvem acordado.
 *
 * O Supabase gratuito pausa o projeto depois de uma semana sem acesso, e aí o
 * site inteiro cai (foi o que aconteceu em 2026-10-13). A Vercel chama esta
 * rota uma vez por dia (vercel.json → crons), e uma consulta basta.
 *
 * Com CRON_SECRET definido na Vercel, só a própria Vercel consegue chamar.
 */
export async function GET(request: Request) {
  const segredo = process.env.CRON_SECRET;
  if (segredo && request.headers.get("authorization") !== `Bearer ${segredo}`) {
    return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  }
  await prisma.$queryRaw`SELECT 1`;
  return NextResponse.json({ ok: true });
}
