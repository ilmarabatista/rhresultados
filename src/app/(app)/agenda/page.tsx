import AgendaScreen, { type AgendaBusca } from "./agenda-screen";

export const dynamic = "force-dynamic";
export const metadata = { title: "Agenda — RH Resultados" };

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: AgendaBusca;
}) {
  return <AgendaScreen searchParams={searchParams} />;
}
