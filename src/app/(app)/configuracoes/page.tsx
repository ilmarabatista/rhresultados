import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";
import SettingsPanel from "@/components/settings-panel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurações — RH Resultados" };

export default async function ConfiguracoesPage() {
  const session = await requireSession();

  const [settings, servicos] = await Promise.all([
    getSettings(),
    prisma.service.findMany({
      orderBy: [{ active: "desc" }, { order: "asc" }],
      include: { _count: { select: { planos: true, reunioes: true, visitas: true } } },
    }),
  ]);


  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Configurações
        </h1>
        <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-500">
          Identidade da sua empresa nos relatórios e o catálogo de produtos
          que a consultoria oferece.
        </p>
      </div>

      <SettingsPanel
        isAdmin={session.role === "ADMIN"}
        settings={settings}
        servicos={servicos.map((s) => ({
          id: s.id,
          nome: s.name,
          descricao: s.description,
          ativo: s.active,
          usos: s._count.planos + s._count.reunioes + s._count.visitas,
        }))}
      />
    </main>
  );
}
