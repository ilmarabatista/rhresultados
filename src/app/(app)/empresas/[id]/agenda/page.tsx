import AgendaScreen, {
  type AgendaBusca,
} from "@/app/(app)/agenda/agenda-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda do cliente — RH Resultados" };

/**
 * A agenda de uma empresa só.
 *
 * É a mesma tela da agenda geral, com a empresa fixa: mesmo calendário, mesma
 * recorrência, mesma pauta. Duplicar a tela para filtrar uma coluna criaria
 * duas versões da mesma coisa para manter.
 */
export default async function AgendaDaEmpresaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: AgendaBusca;
}) {
  const { id } = await params;
  return <AgendaScreen searchParams={searchParams} companyId={id} />;
}
