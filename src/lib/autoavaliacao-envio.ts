import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  lerDestino,
  lerTipoDePergunta,
  modeloSugerido,
  TIPOS_DE_PERGUNTA,
  type PerguntaEnviada,
} from "@/lib/autoavaliacao";
import { foraDoPdi } from "@/lib/prestadores";

/** O que o servidor faz no envio da autoavaliação, usado pelo PDI e pelo cadastro da equipe. */

/** As perguntas do modelo na ordem da ficha, para copiar no envio. */
export function perguntasParaEnviar(
  perguntas: { id: string; tipo: string; texto: string; destino: string | null; ordem: number }[],
) {
  const ordemDoTipo = (t: string) => (TIPOS_DE_PERGUNTA as readonly string[]).indexOf(t);
  return [...perguntas]
    .sort((a, b) => ordemDoTipo(a.tipo) - ordemDoTipo(b.tipo) || a.ordem - b.ordem)
    .flatMap((p): PerguntaEnviada[] => {
      const tipo = lerTipoDePergunta(p.tipo);
      return tipo ? [{ id: p.id, tipo, texto: p.texto, destino: tipo === "ABERTA" ? lerDestino(p.destino) : null }] : [];
    });
}

export function novoToken() {
  return randomBytes(24).toString("hex");
}

/**
 * Gera o link da autoavaliação de quem ainda não tem nenhum, com o modelo da
 * função da pessoa. Sem modelo para a função, não gera nada.
 */
export async function gerarLinkDaFuncao(
  employeeId: string,
  enviadoPor: string,
): Promise<{ token: string; titulo: string } | null> {
  const pessoa = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { companyId: true, cargoId: true, role: true, _count: { select: { autoavaliacoes: true } } },
  });
  if (!pessoa || pessoa._count.autoavaliacoes > 0 || foraDoPdi(pessoa.role)) return null;
  const modelos = await prisma.modeloDeAutoavaliacao.findMany({
    where: { companyId: pessoa.companyId, perguntas: { some: {} } },
    select: { id: true, nome: true, cargoId: true },
  });
  const sugerido = modeloSugerido(modelos, pessoa);
  if (!sugerido) return null;
  const modelo = await prisma.modeloDeAutoavaliacao.findUnique({
    where: { id: sugerido.id },
    include: { perguntas: true },
  });
  if (!modelo || modelo.perguntas.length === 0) return null;
  const token = novoToken();
  await prisma.autoavaliacao.create({
    data: {
      token,
      employeeId,
      modeloId: modelo.id,
      titulo: modelo.nome,
      instrucoes: modelo.instrucoes,
      perguntas: perguntasParaEnviar(modelo.perguntas),
      enviadoPor,
    },
  });
  return { token, titulo: modelo.nome };
}
