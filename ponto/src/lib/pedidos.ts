import "server-only";
import { prisma } from "./prisma";
import { addDaysUTC, dateToDayKey, dayKeyToDate, todayKey } from "./dates";
import { instanteNoDia, minutoNoDia, relogio } from "./calculo";

/**
 * Pedidos do colaborador: justificar falta com atestado e corrigir a própria
 * batida. O colaborador pede pelo aplicativo; nada muda no ponto até o RH
 * aprovar. Aprovado, o pedido vira o mesmo ajuste que o RH faria à mão:
 *
 * - atestado: os dias viram ATESTADO (substituindo o que estava no dia);
 * - correção: a batida certa entra como MANUAL (o asterisco no espelho) e a
 *   errada é anulada, riscada, com o horário de antes no motivo.
 */

/** Quantos dias para trás o colaborador pode pedir correção ou mandar atestado. */
export const JANELA_PARA_TRAS = 60;
/** Atestado pode começar até estes dias à frente (afastamento já marcado). */
export const JANELA_ATESTADO_A_FRENTE = 30;
/** Maior período de um atestado num pedido só. */
export const MAXIMO_DE_DIAS_DO_ATESTADO = 31;

export function limitesDoPedido() {
  const hoje = todayKey();
  const base = dayKeyToDate(hoje);
  return {
    hoje,
    de: dateToDayKey(addDaysUTC(base, -JANELA_PARA_TRAS)),
    ateAtestado: dateToDayKey(addDaysUTC(base, JANELA_ATESTADO_A_FRENTE)),
  };
}

/** Os dias de um período, de "AAAA-MM-DD" a "AAAA-MM-DD". */
export function diasEntre(de: string, ate: string): string[] {
  const dias: string[] = [];
  for (let x = dayKeyToDate(de); dateToDayKey(x) <= ate; x = addDaysUTC(x, 1)) dias.push(dateToDayKey(x));
  return dias;
}

export type TipoPedido = "ATESTADO" | "CORRECAO";
export type SituacaoPedido = "PENDENTE" | "APROVADO" | "RECUSADO";

/** O pedido como o RH e o colaborador veem. */
export type PedidoPublico = {
  id: string;
  tipo: TipoPedido;
  situacao: SituacaoPedido;
  colaboradorId: string;
  colaborador: string;
  dia: string;
  ate: string | null;
  marcacaoId: string | null;
  minutos: number | null;
  era: string | null;
  motivo: string | null;
  anexo: { nome: string; tipo: string } | null;
  criadoEm: string;
  decididoEm: string | null;
  decididoPor: string | null;
  resposta: string | null;
};

const SELECAO = {
  id: true,
  tipo: true,
  situacao: true,
  colaboradorId: true,
  dia: true,
  ate: true,
  marcacaoId: true,
  minutos: true,
  era: true,
  motivo: true,
  createdAt: true,
  decididoEm: true,
  decididoPor: true,
  resposta: true,
  colaborador: { select: { nome: true, email: true } },
  anexo: { select: { nome: true, tipo: true } },
} as const;

type Lido = {
  id: string;
  tipo: TipoPedido;
  situacao: SituacaoPedido;
  colaboradorId: string;
  dia: Date;
  ate: Date | null;
  marcacaoId: string | null;
  minutos: number | null;
  era: string | null;
  motivo: string | null;
  createdAt: Date;
  decididoEm: Date | null;
  decididoPor: string | null;
  resposta: string | null;
  colaborador: { nome: string | null; email: string };
  anexo: { nome: string; tipo: string } | null;
};

function publico(p: Lido): PedidoPublico {
  return {
    id: p.id,
    tipo: p.tipo,
    situacao: p.situacao,
    colaboradorId: p.colaboradorId,
    colaborador: p.colaborador.nome ?? p.colaborador.email,
    dia: dateToDayKey(p.dia),
    ate: p.ate ? dateToDayKey(p.ate) : null,
    marcacaoId: p.marcacaoId,
    minutos: p.minutos,
    era: p.era,
    motivo: p.motivo,
    anexo: p.anexo,
    criadoEm: p.createdAt.toISOString(),
    decididoEm: p.decididoEm?.toISOString() ?? null,
    decididoPor: p.decididoPor,
    resposta: p.resposta,
  };
}

/** Os pendentes primeiro (mais antigos antes), depois os decididos mais recentes. */
export async function pedidosDaEmpresa(empresaId: string, filtro: { colaboradorId?: string; decididos?: number } = {}) {
  const onde = { empresaId, ...(filtro.colaboradorId ? { colaboradorId: filtro.colaboradorId } : {}) };
  const [pendentes, decididos] = await Promise.all([
    prisma.pedido.findMany({ where: { ...onde, situacao: "PENDENTE" }, orderBy: { createdAt: "asc" }, select: SELECAO }),
    prisma.pedido.findMany({
      where: { ...onde, situacao: { not: "PENDENTE" } },
      orderBy: { decididoEm: "desc" },
      take: filtro.decididos ?? 30,
      select: SELECAO,
    }),
  ]);
  return { pendentes: pendentes.map(publico), decididos: decididos.map(publico) };
}

export async function pedidosDoColaborador(colaboradorId: string) {
  const lista = await prisma.pedido.findMany({ where: { colaboradorId }, orderBy: { createdAt: "desc" }, take: 30, select: SELECAO });
  return lista.map(publico);
}

/** O que o pedido pede, numa frase. */
export function resumoDoPedido(p: Pick<PedidoPublico, "tipo" | "dia" | "ate" | "marcacaoId" | "minutos" | "era">): string {
  const data = (d: string) => d.split("-").reverse().join("/");
  if (p.tipo === "ATESTADO") {
    return p.ate && p.ate !== p.dia ? `Atestado de ${data(p.dia)} a ${data(p.ate)}` : `Atestado em ${data(p.dia)}`;
  }
  const novo = p.minutos === null ? null : `${relogio(p.minutos)}${p.minutos >= 1440 ? " (dia seguinte)" : ""}`;
  if (!p.marcacaoId) return `Incluir batida às ${novo} em ${data(p.dia)}`;
  if (novo === null) return `Tirar a batida das ${p.era} de ${data(p.dia)} (bateu a mais)`;
  return `Corrigir a batida de ${data(p.dia)}: ${p.era} → ${novo}`;
}

// ------------------------------------------------------------------ decisão

/**
 * Aprova o pedido e faz o ajuste no ponto, tudo junto: ou entra tudo, ou
 * nada. Devolve a mensagem de erro, ou null quando deu certo.
 */
export async function aprovarPedido(empresaId: string, id: string, autor: string | null): Promise<string | null> {
  const p = await prisma.pedido.findFirst({ where: { id, empresaId } });
  if (!p) return "Pedido não encontrado.";
  if (p.situacao !== "PENDENTE") return "Este pedido já foi decidido.";
  const quem = autor ?? "RH";
  const motivo = p.motivo ? `: ${p.motivo}` : "";

  try {
    await prisma.$transaction(async (tx) => {
      // Só um aprova: quem chegar depois encontra o pedido já decidido.
      const marcado = await tx.pedido.updateMany({
        where: { id, situacao: "PENDENTE" },
        data: { situacao: "APROVADO", decididoEm: new Date(), decididoPor: autor },
      });
      if (marcado.count === 0) throw new ErroDoPedido("Este pedido já foi decidido.");

      if (p.tipo === "ATESTADO") {
        const datas = diasEntre(dateToDayKey(p.dia), dateToDayKey(p.ate ?? p.dia)).map(dayKeyToDate);
        await tx.ocorrencia.deleteMany({ where: { empresaId, colaboradorId: p.colaboradorId, dia: { in: datas } } });
        await tx.ocorrencia.createMany({
          data: datas.map((dia) => ({
            empresaId,
            colaboradorId: p.colaboradorId,
            dia,
            tipo: "ATESTADO" as const,
            descricao: `Atestado enviado pelo colaborador${motivo}`.slice(0, 200),
            criadoPor: quem,
          })),
        });
        return;
      }

      const dia = dateToDayKey(p.dia);
      let original: { id: string; momento: Date } | null = null;
      if (p.marcacaoId) {
        original = await tx.marcacao.findFirst({
          where: { id: p.marcacaoId, colaboradorId: p.colaboradorId, anuladaEm: null },
          select: { id: true, momento: true },
        });
        if (!original) throw new ErroDoPedido("A batida deste pedido já foi corrigida ou anulada. Recuse o pedido.");
      }
      const era = original ? relogio(minutoNoDia(original.momento, dia)) : null;

      if (p.minutos !== null) {
        const momento = instanteNoDia(dia, p.minutos);
        if (momento.getTime() > Date.now()) throw new ErroDoPedido("O horário pedido ainda não chegou.");
        await tx.marcacao.create({
          data: {
            empresaId,
            colaboradorId: p.colaboradorId,
            dia: p.dia,
            momento,
            origem: "MANUAL",
            motivo: `Pedido do colaborador${motivo}${era ? ` (era ${era})` : ""}`.slice(0, 300),
            criadoPor: quem,
          },
        });
      }
      if (original) {
        await tx.marcacao.update({
          where: { id: original.id },
          data: {
            anuladaEm: new Date(),
            anuladaMotivo:
              p.minutos === null
                ? `Batida a mais, a pedido do colaborador (${quem})`
                : `Corrigida para ${relogio(p.minutos)} a pedido do colaborador (${quem})`,
          },
        });
      }
    });
  } catch (e) {
    if (e instanceof ErroDoPedido) return e.message;
    throw e;
  }
  return null;
}

export async function recusarPedido(empresaId: string, id: string, autor: string | null, resposta: string): Promise<string | null> {
  const r = await prisma.pedido.updateMany({
    where: { id, empresaId, situacao: "PENDENTE" },
    data: { situacao: "RECUSADO", decididoEm: new Date(), decididoPor: autor, resposta: resposta.slice(0, 300) },
  });
  if (r.count) return null;
  const existe = await prisma.pedido.count({ where: { id, empresaId } });
  return existe ? "Este pedido já foi decidido." : "Pedido não encontrado.";
}

/** O arquivo do atestado, só de um pedido da empresa. */
export async function anexoDoPedido(empresaId: string, id: string) {
  return prisma.anexoPedido.findFirst({ where: { pedidoId: id, pedido: { empresaId } } });
}

class ErroDoPedido extends Error {}
