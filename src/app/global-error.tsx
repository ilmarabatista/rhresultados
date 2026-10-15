"use client";

/**
 * Última rede: falha no próprio layout raiz. Precisa do <html> e não pode
 * contar com o CSS do sistema, por isso o estilo vai inline.
 */
export default function ErroGeral({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#f4f7fa", color: "#0f172a", margin: 0 }}>
        <main style={{ maxWidth: 480, margin: "64px auto", padding: "0 16px" }}>
          <h1 style={{ fontSize: 20 }}>O sistema não conseguiu abrir</h1>
          <p style={{ fontSize: 14, color: "#475569" }}>Confira a conexão com a internet e tente de novo.</p>
          <button
            type="button"
            onClick={reset}
            style={{ marginTop: 12, padding: "8px 16px", borderRadius: 8, border: 0, background: "#275a99", color: "#fff", fontSize: 14, cursor: "pointer" }}
          >
            Tentar de novo
          </button>
        </main>
      </body>
    </html>
  );
}
