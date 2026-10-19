import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Momento 1 da integração com o sistema de ponto: a lista de empresas, para
 * o administrador do ponto escolher de qual delas vai criar o ponto. Só
 * responde a quem mandar a chave INTEGRACAO_SECRET, e só id e nome.
 */
export const dynamic = "force-dynamic";

function autorizado(request: Request): boolean {
  const esperada = process.env.INTEGRACAO_SECRET;
  if (!esperada || esperada.length < 16) return false;
  const recebida = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const a = Buffer.from(recebida);
  const b = Buffer.from(esperada);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(request: Request) {
  if (!autorizado(request)) return NextResponse.json({ erro: "Não autorizado." }, { status: 401 });
  const empresas = await prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  return NextResponse.json({ empresas: empresas.map((e) => ({ id: e.id, nome: e.name })) });
}
