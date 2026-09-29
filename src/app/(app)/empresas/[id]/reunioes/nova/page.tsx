import { redirect } from "next/navigation";

/** A nova reunião abre na própria lista, numa janela. O endereço antigo leva para lá. */
export default async function NovaReuniaoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/empresas/${id}/reunioes?nova=1`);
}
