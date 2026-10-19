import "server-only";
import { prisma } from "./prisma";
import { addDaysUTC, dateToDayKey, dayKeyToDate, todayKey } from "./dates";
import { diaDaBatida, minutoNoDia } from "./calculo";

/** A jornada em que o colaborador está agora e as batidas válidas dela. */
export async function jornadaAtual(colaboradorId: string, agora = new Date()) {
  const hoje = todayKey();
  const ontem = dateToDayKey(addDaysUTC(dayKeyToDate(hoje), -1));
  const marcacoes = await prisma.marcacao.findMany({
    where: { colaboradorId, anuladaEm: null, dia: { gte: dayKeyToDate(ontem), lte: dayKeyToDate(hoje) } },
    orderBy: { momento: "asc" },
    select: { id: true, nsr: true, dia: true, momento: true, origem: true },
  });
  const deOntem = marcacoes.filter((m) => dateToDayKey(m.dia) === ontem);
  const deHoje = marcacoes.filter((m) => dateToDayKey(m.dia) === hoje);
  const dia = diaDaBatida({
    hoje,
    ontem,
    batidasDeOntem: deOntem.map((m) => m.momento),
    batidasDeHoje: deHoje.length,
    agora,
  });
  const batidas = (dia === hoje ? deHoje : deOntem).map((m) => ({
    id: m.id,
    nsr: m.nsr,
    momento: m.momento,
    minuto: minutoNoDia(m.momento, dia),
    origem: m.origem,
  }));
  return { dia, batidas };
}

/** "data:image/jpeg;base64,..." → bytes, só se for mesmo um JPEG de tamanho razoável. */
export function lerFoto(dataUrl: string): Buffer | null {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!m) return null;
  const bytes = Buffer.from(m[1], "base64");
  if (bytes.length < 1000 || bytes.length > 600_000) return null;
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  return bytes;
}
