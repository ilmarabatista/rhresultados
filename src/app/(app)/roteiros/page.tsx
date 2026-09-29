import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatFullDate } from "@/lib/dates";
import ScriptStudio, {
  type BlocoItem,
} from "@/components/script-studio";

export const dynamic = "force-dynamic";
export const metadata = { title: "Roteiros — RH Resultados" };
// Escrever um roteiro passa pela IA.
export const maxDuration = 300;

export default async function RoteirosPage() {
  await requireSession();

  const [roteiros, exemplos] = await Promise.all([
    prisma.script.findMany({
      orderBy: { createdAt: "desc" },
      take: 40,
      include: { _count: { select: { edits: true } } },
    }),
    prisma.scriptEdit.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        bloco: true,
        antes: true,
        depois: true,
        usarComoExemplo: true,
        createdAt: true,
      },
    }),
  ]);

  return (
    <ScriptStudio
      roteiros={roteiros.map((r) => ({
        id: r.id,
        tema: r.tema,
        publico: r.publico,
        objetivo: r.objetivo,
        plataforma: r.plataforma,
        duracaoSegundos: r.duracaoSegundos,
        framework: r.framework,
        angulo: r.angulo,
        copyThesis: r.copyThesis,
        dsi: r.dsi,
        blocos: r.blocos as unknown as BlocoItem[],
        ganchosAlternativos: r.ganchosAlternativos as unknown as string[],
        status: r.status,
        descartadoPorque: r.descartadoPorque,
        quando: formatFullDate(r.createdAt),
        edicoes: r._count.edits,
        tinhaProva: Boolean(r.provaSocial?.trim()),
      }))}
      exemplos={exemplos.map((e) => ({
        id: e.id,
        bloco: e.bloco,
        antes: e.antes,
        depois: e.depois,
        usar: e.usarComoExemplo,
        quando: formatFullDate(e.createdAt),
      }))}
    />
  );
}
