import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ponto — RH Resultados",
  description: "Registro de ponto dos colaboradores das empresas atendidas pela RH Resultados.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#1c605a" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
