import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { SignJWT, jwtVerify } from "jose";
import { prisma } from "./prisma";

/**
 * A sessão do ponto, num cookie assinado. Serve aos dois tipos de acesso: o
 * administrador, que cadastra empresas e colaboradores, e o colaborador, que
 * bate o ponto.
 *
 * O cookie leva a versão da senha: trocar a senha derruba as sessões antigas.
 * A cada requisição a pessoa é conferida no banco, para que desativar alguém
 * valha na hora.
 */

const COOKIE = "ponto_sessao";
const MAX_AGE = 60 * 60 * 24 * 30; // 30 dias: o colaborador bate ponto todo dia no mesmo celular.

function segredo() {
  const valor = process.env.AUTH_SECRET;
  if (!valor) throw new Error("AUTH_SECRET não configurado.");
  return new TextEncoder().encode(valor);
}

type Conteudo = { tipo: "admin" | "colaborador"; id: string; versao: number };

export async function abrirSessao(conteudo: Conteudo) {
  const token = await new SignJWT({ ...conteudo })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(segredo());
  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function fecharSessao() {
  (await cookies()).delete(COOKIE);
}

async function lerCookie(): Promise<Conteudo | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, segredo());
    if (payload.tipo !== "admin" && payload.tipo !== "colaborador") return null;
    return { tipo: payload.tipo, id: String(payload.id), versao: Number(payload.versao ?? 0) };
  } catch {
    return null;
  }
}

export type Sessao =
  | { tipo: "admin"; id: string; nome: string; email: string }
  | {
      tipo: "colaborador";
      id: string;
      nome: string;
      email: string;
      trocarSenha: boolean;
      empresa: { id: string; nome: string; ativo: boolean };
    };

export const sessaoAtual = cache(async (): Promise<Sessao | null> => {
  const c = await lerCookie();
  if (!c) return null;

  if (c.tipo === "admin") {
    const a = await prisma.admin.findUnique({ where: { id: c.id } });
    if (!a || !a.ativo || a.sessionVersion !== c.versao) return null;
    return { tipo: "admin", id: a.id, nome: a.nome, email: a.email };
  }

  const p = await prisma.colaborador.findUnique({
    where: { id: c.id },
    include: { empresa: { select: { id: true, nome: true, ativo: true } } },
  });
  if (!p || !p.ativo || p.sessionVersion !== c.versao) return null;
  return {
    tipo: "colaborador",
    id: p.id,
    nome: p.nome ?? p.email,
    email: p.email,
    trocarSenha: p.trocarSenha,
    empresa: p.empresa,
  };
});

export async function exigirAdmin() {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  if (s.tipo !== "admin") redirect("/");
  return s;
}

/** O colaborador logado. Quem ainda está com a senha padrão vai trocá-la antes de tudo. */
export async function exigirColaborador({ podeComSenhaPadrao = false } = {}) {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  if (s.tipo !== "colaborador") redirect("/admin");
  if (s.trocarSenha && !podeComSenhaPadrao) redirect("/trocar-senha");
  return s;
}
