import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // A apresentação anexada a uma reunião pode ter até 25 MB (TAMANHO_MAXIMO
    // em empresas/[id]/reunioes/actions), e o arquivo AFD do ponto até 20 MB.
    serverActions: { bodySizeLimit: "30mb" },
  },
};

export default nextConfig;
