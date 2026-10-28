import { confirmar } from "@/components/avisos";
import { pedidoParaApagar } from "@/lib/respostas-protegidas";

/**
 * Chama a exclusão; se ela devolver `respostas` (o que se perde respondido por
 * link), pergunta e, com o sim, chama de novo já com a permissão. Devolve null
 * quando ela desiste.
 */
export async function excluirComPermissao<T extends { respostas?: string }>(
  excluir: (apagarRespostas: boolean) => Promise<T>,
): Promise<T | null> {
  const r = await excluir(false);
  if (!r.respostas) return r;
  if (!(await confirmar(pedidoParaApagar(r.respostas), { sim: "Apagar as respostas" }))) return null;
  return excluir(true);
}
