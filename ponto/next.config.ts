import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança. Câmera e localização ficam liberadas só para o
 * próprio site: são elas que fazem a batida (foto e local do colaborador).
 */
const CSP = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const SEGURANCA = [
  { key: "Content-Security-Policy", value: CSP },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), geolocation=(self), microphone=(), payment=(), usb=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // O ponto mora numa pasta do repositório do RH: a raiz dele é esta pasta.
  outputFileTracingRoot: process.cwd(),
  experimental: {
    // A foto da batida vai junto com o formulário; ela é reduzida no celular
    // antes de sair, mas fica uma folga.
    serverActions: { bodySizeLimit: "1mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: SEGURANCA }];
  },
};

export default nextConfig;
