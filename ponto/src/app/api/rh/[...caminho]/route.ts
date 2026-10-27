import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { chamadaDoRh } from "@/lib/integracao";
import { dateToDayKey, dayKeyToDate } from "@/lib/dates";
import { horarioValido, instanteNoDia } from "@/lib/calculo";
import {
  calcularPessoas,
  empresaPorRh,
  horarioDaEmpresa,
  pessoasDoPonto,
  presentesAgora,
  saldosDoBanco,
  type EmpresaDoPonto,
} from "@/lib/dados";
import { enviarRelatorio } from "@/lib/relatorio";
import { anexoDoPedido, aprovarPedido, pedidosDaEmpresa, recusarPedido } from "@/lib/pedidos";

/**
 * Momento 2 da integração: o RH Resultados lê e ajusta o ponto de cada
 * empresa por aqui. Toda chamada leva a chave INTEGRACAO_SECRET e o id da
 * empresa no RH (/api/rh/empresas/<id do RH>/...). O que é de uma empresa
 * nunca é lido nem mexido pelo caminho de outra.
 */

export const dynamic = "force-dynamic";

type Contexto = { params: Promise<{ caminho: string[] }> };
type Rota = (e: EmpresaDoPonto, partes: string[], req: Request) => Promise<Response>;

const dia = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const mes = z.string().regex(/^\d{4}-\d{2}$/);
const autor = z.string().trim().max(120).nullish().transform((v) => v || null);

const erro = (mensagem: string, status = 400) => NextResponse.json({ erro: mensagem }, { status });
const ok = (dados: Record<string, unknown> = {}) => NextResponse.json({ ok: true, ...dados });

async function corpo<T>(req: Request, schema: z.ZodType<T>): Promise<T | Response> {
  const json = await req.json().catch(() => null);
  const parsed = schema.safeParse(json);
  return parsed.success ? parsed.data : erro(parsed.error.issues[0]?.message ?? "Dados inválidos.");
}

async function colaboradorDa(e: EmpresaDoPonto, id: string) {
  return prisma.colaborador.findFirst({ where: { id, empresaId: e.id }, select: { id: true } });
}

function empresaPublica(e: EmpresaDoPonto) {
  return {
    id: e.id,
    nome: e.nome,
    ativo: e.ativo,
    regime: e.regime,
    horario: horarioDaEmpresa(e),
    tolerancia: e.tolerancia,
    intervaloMinimo: e.intervaloMinimo,
    validadeBancoMeses: e.validadeBancoMeses,
    bancoSemanal: e.bancoSemanal,
    inicio: dateToDayKey(e.inicio),
  };
}

// ----------------------------------------------------------------- leitura

const LEITURAS: Record<string, Rota> = {
  "": async (e) =>
    NextResponse.json({
      empresa: empresaPublica(e),
      colaboradores: await pessoasDoPonto(e.id),
      pedidosPendentes: await prisma.pedido.count({ where: { empresaId: e.id, situacao: "PENDENTE" } }),
    }),

  calculo: async (e, _p, req) => {
    const q = new URL(req.url).searchParams;
    const desde = dia.safeParse(q.get("desde"));
    const ate = dia.safeParse(q.get("ate"));
    if (!desde.success || !ate.success) return erro("Período inválido.");
    const colaborador = q.get("colaborador");
    const pessoas = await pessoasDoPonto(e.id, colaborador ? [colaborador] : undefined);
    return NextResponse.json({ calculos: await calcularPessoas(e, pessoas, desde.data, ate.data) });
  },

  saldos: async (e, _p, req) => {
    const colaborador = new URL(req.url).searchParams.get("colaborador");
    const pessoas = await pessoasDoPonto(e.id, colaborador ? [colaborador] : undefined);
    return NextResponse.json({ saldos: await saldosDoBanco(e, pessoas) });
  },

  presentes: async (e) => NextResponse.json(await presentesAgora(e.id)),

  ocorrencias: async (e, _p, req) => {
    const q = new URL(req.url).searchParams;
    const desde = dia.safeParse(q.get("desde"));
    const ate = dia.safeParse(q.get("ate"));
    if (!desde.success || !ate.success) return erro("Período inválido.");
    const lista = await prisma.ocorrencia.findMany({
      where: { empresaId: e.id, dia: { gte: dayKeyToDate(desde.data), lte: dayKeyToDate(ate.data) } },
      orderBy: { dia: "asc" },
      include: { colaborador: { select: { nome: true, email: true } } },
    });
    return NextResponse.json({
      ocorrencias: lista.map((o) => ({
        id: o.id,
        dia: dateToDayKey(o.dia),
        tipo: o.tipo,
        descricao: o.descricao,
        colaborador: o.colaborador ? (o.colaborador.nome ?? o.colaborador.email) : null,
        criadoPor: o.criadoPor,
        criadoEm: o.createdAt.toISOString(),
      })),
    });
  },

  lancamentos: async (e, _p, req) => {
    const colaborador = new URL(req.url).searchParams.get("colaborador");
    if (!colaborador) return erro("Informe o colaborador.");
    const lista = await prisma.lancamento.findMany({
      where: { empresaId: e.id, colaboradorId: colaborador },
      orderBy: { dia: "desc" },
      take: 50,
    });
    return NextResponse.json({
      lancamentos: lista.map((l) => ({ id: l.id, dia: dateToDayKey(l.dia), minutos: l.minutos, descricao: l.descricao, criadoPor: l.criadoPor })),
    });
  },

  relatorios: async (e, _p, req) => {
    const m = mes.safeParse(new URL(req.url).searchParams.get("mes"));
    if (!m.success) return erro("Mês inválido.");
    const lista = await prisma.relatorio.findMany({
      where: { mes: m.data, colaborador: { empresaId: e.id } },
      select: { colaboradorId: true, enviadoEm: true, enviadoPor: true, cienteEm: true },
    });
    return NextResponse.json({ relatorios: lista });
  },

  pedidos: async (e, partes, req) => {
    const [id, oque] = partes;
    if (!id) {
      const q = new URL(req.url).searchParams;
      const decididos = Number(q.get("decididos") ?? 30);
      return NextResponse.json(
        await pedidosDaEmpresa(e.id, {
          colaboradorId: q.get("colaborador") ?? undefined,
          decididos: Number.isInteger(decididos) && decididos >= 0 && decididos <= 200 ? decididos : 30,
        }),
      );
    }
    // pedidos/<id>/anexo
    if (oque !== "anexo") return erro("Caminho desconhecido.", 404);
    const anexo = await anexoDoPedido(e.id, id);
    if (!anexo) return erro("Sem anexo.", 404);
    return new Response(new Uint8Array(anexo.dados), {
      headers: {
        "Content-Type": anexo.tipo,
        "Content-Disposition": `inline; filename="${encodeURIComponent(anexo.nome)}"`,
        "Cache-Control": "private, max-age=86400",
      },
    });
  },

  marcacoes: async (e, partes) => {
    // marcacoes/<id>/foto
    const [id, oque] = partes;
    if (oque !== "foto" || !id) return erro("Caminho desconhecido.", 404);
    const foto = await prisma.fotoMarcacao.findFirst({ where: { marcacaoId: id, marcacao: { empresaId: e.id } } });
    if (!foto) return erro("Sem foto.", 404);
    return new Response(new Uint8Array(foto.dados), {
      headers: { "Content-Type": foto.tipo, "Cache-Control": "private, max-age=86400" },
    });
  },
};

// ------------------------------------------------------------------ escrita

const regrasSchema = z.object({
  regime: z.enum(["BANCO_DE_HORAS", "HORAS_EXTRAS"]),
  horario: z.unknown().refine(horarioValido, "Horário inválido."),
  tolerancia: z.number().int().min(0).max(30),
  intervaloMinimo: z.number().int().min(0).max(240),
  validadeBancoMeses: z.number().int().min(1).max(24),
  /** Opcional: quem não manda (o RH antigo) não mexe nele. */
  bancoSemanal: z.boolean().optional(),
  inicio: dia,
  ativo: z.boolean(),
});

const colaboradorSchema = z.object({
  horario: z.unknown().refine((v) => v === null || horarioValido(v), "Horário inválido."),
  admissao: dia.nullable(),
  nome: z.string().trim().max(120).nullish(),
});

const marcacaoSchema = z.object({
  colaboradorId: z.string().min(1),
  dia,
  minutos: z.number().int().min(0).max(2879),
  motivo: z.string().trim().min(3).max(300),
  autor,
});

const anularSchema = z.object({ motivo: z.string().trim().min(3).max(300), autor });

const ocorrenciaSchema = z.object({
  colaboradorId: z.string().min(1).nullable(),
  tipo: z.enum(["FERIADO", "FOLGA", "FERIAS", "ABONO", "ATESTADO"]),
  dias: z.array(dia).min(1).max(62),
  descricao: z.string().trim().max(200).nullish().transform((v) => v || null),
  autor,
});

const lancamentoSchema = z.object({
  colaboradorId: z.string().min(1),
  dia,
  minutos: z.number().int().refine((v) => v !== 0 && Math.abs(v) <= 100 * 60, "Horas inválidas."),
  descricao: z.string().trim().min(3).max(200),
  autor,
});

const relatorioSchema = z.object({ colaboradorId: z.string().min(1), mes, autor });

const aprovarSchema = z.object({ autor });
const recusarSchema = z.object({ resposta: z.string().trim().min(3, "Diga ao colaborador por que o pedido foi recusado.").max(300), autor });

async function escrever(e: EmpresaDoPonto, partes: string[], req: Request): Promise<Response> {
  const [recurso, id, acao] = partes;
  const metodo = req.method;

  if (metodo === "PUT" && recurso === "regras") {
    const d = await corpo(req, regrasSchema);
    if (d instanceof Response) return d;
    await prisma.empresa.update({
      where: { id: e.id },
      data: {
        regime: d.regime,
        horario: d.horario as object,
        tolerancia: d.tolerancia,
        intervaloMinimo: d.intervaloMinimo,
        validadeBancoMeses: d.validadeBancoMeses,
        ...(d.bancoSemanal === undefined ? {} : { bancoSemanal: d.regime === "BANCO_DE_HORAS" && d.bancoSemanal }),
        inicio: dayKeyToDate(d.inicio),
        ativo: d.ativo,
      },
    });
    return ok();
  }

  if (metodo === "PUT" && recurso === "colaboradores" && id) {
    const d = await corpo(req, colaboradorSchema);
    if (d instanceof Response) return d;
    if (!(await colaboradorDa(e, id))) return erro("Colaborador não encontrado.", 404);
    await prisma.colaborador.update({
      where: { id },
      data: {
        horario: d.horario === null ? Prisma.DbNull : (d.horario as object),
        admissao: d.admissao ? dayKeyToDate(d.admissao) : null,
        ...(d.nome !== undefined ? { nome: d.nome || null } : {}),
      },
    });
    return ok();
  }

  if (metodo === "POST" && recurso === "marcacoes" && !id) {
    const d = await corpo(req, marcacaoSchema);
    if (d instanceof Response) return d;
    if (!(await colaboradorDa(e, d.colaboradorId))) return erro("Colaborador não encontrado.", 404);
    const momento = instanteNoDia(d.dia, d.minutos);
    if (momento.getTime() > Date.now()) return erro("Não dá para incluir batida no futuro.");
    const m = await prisma.marcacao.create({
      data: {
        empresaId: e.id,
        colaboradorId: d.colaboradorId,
        dia: dayKeyToDate(d.dia),
        momento,
        origem: "MANUAL",
        motivo: d.motivo,
        criadoPor: d.autor,
      },
      select: { id: true },
    });
    return ok({ id: m.id });
  }

  if (metodo === "POST" && recurso === "marcacoes" && id && (acao === "anular" || acao === "restaurar")) {
    const m = await prisma.marcacao.findFirst({ where: { id, empresaId: e.id }, select: { anuladaEm: true } });
    if (!m) return erro("Batida não encontrada.", 404);
    if (acao === "restaurar") {
      await prisma.marcacao.update({ where: { id }, data: { anuladaEm: null, anuladaMotivo: null } });
      return ok();
    }
    const d = await corpo(req, anularSchema);
    if (d instanceof Response) return d;
    if (!m.anuladaEm) {
      await prisma.marcacao.update({
        where: { id },
        data: { anuladaEm: new Date(), anuladaMotivo: d.autor ? `${d.motivo} (${d.autor})` : d.motivo },
      });
    }
    return ok();
  }

  if (metodo === "POST" && recurso === "ocorrencias") {
    const d = await corpo(req, ocorrenciaSchema);
    if (d instanceof Response) return d;
    if (d.tipo === "FERIADO" && d.colaboradorId) return erro("Feriado vale para a empresa toda.");
    if (d.tipo !== "FERIADO" && !d.colaboradorId) return erro("Escolha o colaborador.");
    if (d.colaboradorId && !(await colaboradorDa(e, d.colaboradorId))) return erro("Colaborador não encontrado.", 404);
    const datas = d.dias.map(dayKeyToDate);
    // Um dia tem uma ocorrência só: a nova substitui a que já estava.
    await prisma.$transaction([
      prisma.ocorrencia.deleteMany({ where: { empresaId: e.id, colaboradorId: d.colaboradorId, dia: { in: datas } } }),
      prisma.ocorrencia.createMany({
        data: datas.map((x) => ({
          empresaId: e.id,
          colaboradorId: d.colaboradorId,
          dia: x,
          tipo: d.tipo,
          descricao: d.descricao,
          criadoPor: d.autor,
        })),
      }),
    ]);
    return ok({ dias: datas.length });
  }

  if (metodo === "DELETE" && recurso === "ocorrencias" && id) {
    const r = await prisma.ocorrencia.deleteMany({ where: { id, empresaId: e.id } });
    return r.count ? ok() : erro("Ocorrência não encontrada.", 404);
  }

  if (metodo === "POST" && recurso === "lancamentos") {
    const d = await corpo(req, lancamentoSchema);
    if (d instanceof Response) return d;
    if (!(await colaboradorDa(e, d.colaboradorId))) return erro("Colaborador não encontrado.", 404);
    await prisma.lancamento.create({
      data: {
        empresaId: e.id,
        colaboradorId: d.colaboradorId,
        dia: dayKeyToDate(d.dia),
        minutos: d.minutos,
        descricao: d.descricao,
        criadoPor: d.autor,
      },
    });
    return ok();
  }

  if (metodo === "DELETE" && recurso === "lancamentos" && id) {
    const r = await prisma.lancamento.deleteMany({ where: { id, empresaId: e.id } });
    return r.count ? ok() : erro("Lançamento não encontrado.", 404);
  }

  if (metodo === "POST" && recurso === "relatorios") {
    const d = await corpo(req, relatorioSchema);
    if (d instanceof Response) return d;
    const r = await enviarRelatorio(e, d.colaboradorId, d.mes, d.autor);
    return r ? ok({ enviadoEm: r.enviadoEm }) : erro("Colaborador não encontrado.", 404);
  }

  if (metodo === "POST" && recurso === "pedidos" && id && acao === "aprovar") {
    const d = await corpo(req, aprovarSchema);
    if (d instanceof Response) return d;
    const falha = await aprovarPedido(e.id, id, d.autor);
    return falha ? erro(falha, falha === "Pedido não encontrado." ? 404 : 409) : ok();
  }

  if (metodo === "POST" && recurso === "pedidos" && id && acao === "recusar") {
    const d = await corpo(req, recusarSchema);
    if (d instanceof Response) return d;
    const falha = await recusarPedido(e.id, id, d.autor, d.resposta);
    return falha ? erro(falha, falha === "Pedido não encontrado." ? 404 : 409) : ok();
  }

  return erro("Caminho desconhecido.", 404);
}

// ------------------------------------------------------------------ entrada

async function atender(req: Request, { params }: Contexto): Promise<Response> {
  if (!chamadaDoRh(req)) return erro("Não autorizado.", 401);
  const { caminho } = await params;
  const [raiz, rhCompanyId, ...resto] = caminho;
  if (raiz !== "empresas" || !rhCompanyId) return erro("Caminho desconhecido.", 404);

  const e = await empresaPorRh(rhCompanyId);
  if (!e) return erro("Esta empresa ainda não tem ponto.", 404);

  try {
    if (req.method === "GET") {
      const rota = LEITURAS[resto[0] ?? ""];
      return rota ? await rota(e, resto.slice(1), req) : erro("Caminho desconhecido.", 404);
    }
    return await escrever(e, resto, req);
  } catch (err) {
    console.error("[api/rh]", err);
    return erro("Erro no servidor do ponto.", 500);
  }
}

export const GET = atender;
export const POST = atender;
export const PUT = atender;
export const DELETE = atender;
