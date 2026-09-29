import "server-only";
import { cache } from "react";
import { prisma } from "./prisma";

/** A configuração é linha única; este id é o único que existe. */
const ID = "app";

export type AppSettings = {
  orgName: string;
  orgDocument: string | null;
  orgContact: string | null;
  reportFooter: string | null;
};

const PADRAO: AppSettings = {
  orgName: "RH Resultados",
  orgDocument: null,
  orgContact: null,
  reportFooter: null,
};

/**
 * Lê a configuração. Enquanto ninguém salvou nada, devolve o padrão em vez de
 * criar a linha — assim uma instalação nova funciona sem seed adicional.
 */
export const getSettings = cache(async (): Promise<AppSettings> => {
  const s = await prisma.settings.findUnique({ where: { id: ID } });
  return s
    ? {
        orgName: s.orgName,
        orgDocument: s.orgDocument,
        orgContact: s.orgContact,
        reportFooter: s.reportFooter,
      }
    : PADRAO;
});

export { ID as SETTINGS_ID };
