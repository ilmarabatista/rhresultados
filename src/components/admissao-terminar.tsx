"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { terminarEnvio } from "@/app/admissao/[token]/actions";
import { avisar, confirmar } from "@/components/avisos";

/** O "Terminei" do link: avisa o RH que os documentos estão lá. */
export default function AdmissaoTerminar({ token, faltando, terminado }: { token: string; faltando: string[]; terminado: boolean }) {
  const router = useRouter();
  const [enviando, setEnviando] = useState(false);

  async function terminar() {
    if (faltando.length > 0) {
      const ok = await confirmar(`Ainda faltam: ${faltando.join(", ")}. Avisar o RH mesmo assim?`, { sim: "Avisar assim", nao: "Voltar" });
      if (!ok) return;
    }
    setEnviando(true);
    const r = await terminarEnvio(token);
    setEnviando(false);
    if (r.error) avisar(r.error);
    else avisar("Pronto! O RH foi avisado. Se faltar algo, você pode voltar a este link e mandar.");
    router.refresh();
  }

  return (
    <div className="mt-4 rounded-lg border border-slate-200 bg-white p-4 text-center">
      {terminado ? (
        <p className="mb-2 text-sm text-emerald-700">Você já avisou o RH. Se mandar mais alguma coisa, toque de novo.</p>
      ) : faltando.length > 0 ? (
        <p className="mb-2 text-xs text-slate-500">Faltam: {faltando.join(", ")}.</p>
      ) : (
        <p className="mb-2 text-sm text-emerald-700">Tudo certo com os documentos principais.</p>
      )}
      <button
        type="button"
        onClick={terminar}
        disabled={enviando}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
      >
        {enviando ? "Enviando…" : "Terminei"}
      </button>
    </div>
  );
}
