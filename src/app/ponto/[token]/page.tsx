import { prisma } from "@/lib/prisma";
import { AvisoAoCandidato } from "@/components/public-candidate-page";
import PontoRegistro from "@/components/ponto-registro";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Registro de ponto",
  robots: { index: false, follow: false },
};

/**
 * Rota pública: o relógio de ponto da empresa. Fica aberto num tablet na
 * entrada, ou cada pessoa abre no próprio celular.
 */
export default async function RegistroDePontoPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const config = await prisma.pontoConfig.findUnique({
    where: { token },
    select: { ativo: true, company: { select: { name: true } } },
  });

  if (!config) {
    return <AvisoAoCandidato titulo="Link inválido" texto="Este endereço não corresponde a nenhum ponto. Peça o link ao RH." />;
  }
  if (!config.ativo) {
    return <AvisoAoCandidato titulo="Ponto desativado" texto="O registro de ponto desta empresa está desligado. Fale com o RH." />;
  }

  return <PontoRegistro token={token} empresa={config.company.name} />;
}
