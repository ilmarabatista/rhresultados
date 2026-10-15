import type { Metadata } from "next";
import "./globals.css";
import { Avisos } from "@/components/avisos";

export const metadata: Metadata = {
  title: "RH Resultados — Controle Operacional",
  description:
    "Sistema de controle operacional de planejamento, tarefas e metas para empresas clientes.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen antialiased">
        {children}
        <Avisos />
      </body>
    </html>
  );
}
