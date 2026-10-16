import type { NextConfig } from "next";

/**
 * Cabeçalhos de segurança em todas as respostas.
 *
 * A CSP aceita script e estilo inline porque o Next injeta os dois na página
 * sem nonce; o resto fica preso ao próprio domínio. `frame-ancestors 'none'`
 * impede que o login ou o ponto sejam abertos dentro de outro site
 * (clickjacking). O microfone fica liberado só para o próprio site, por causa
 * do ditado nos campos de texto.
 */
const CSP = [
  "default-src 'self'",
  // Em desenvolvimento o Next recarrega o código com eval.
  `script-src 'self' 'unsafe-inline'${process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
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
  {
    key: "Permissions-Policy",
    value: "camera=(), geolocation=(), payment=(), usb=(), microphone=(self)",
  },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // A Vercel recusa corpo acima de 4,5 MB; o limite daqui acompanha o de
    // lá para o erro ser o mesmo no computador e no ar (src/lib/apresentacao).
    serverActions: { bodySizeLimit: "4.5mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: SEGURANCA }];
  },
};

export default nextConfig;
