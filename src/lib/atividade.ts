import "server-only";
import { prisma } from "./prisma";

/**
 * O registro no Fluxo de atividades.
 *
 * Cada módulo tinha a sua cópia desta função, idêntica a não ser pelo tipo de
 * registro. Agora o módulo diz só o tipo — `const log = atividade("SETOR")` — e
 * a gravação mora num lugar.
 */
export function atividade(entityType: string) {
  return async function log(
    companyId: string,
    userId: string,
    action: string,
    entityId: string,
    description: string,
  ) {
    await prisma.activity.create({
      data: { companyId, userId, action, entityType, entityId, description },
    });
  };
}
