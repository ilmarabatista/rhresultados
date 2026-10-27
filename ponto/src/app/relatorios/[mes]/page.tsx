import { redirect } from "next/navigation";

/** Endereço antigo do relatório do mês: abre o mês em Meu ponto. */
export default async function RelatorioPage({ params }: { params: Promise<{ mes: string }> }) {
  const { mes } = await params;
  redirect(/^\d{4}-\d{2}$/.test(mes) ? `/meu-ponto?mes=${mes}` : "/meu-ponto");
}
