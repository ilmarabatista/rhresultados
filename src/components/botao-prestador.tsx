"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { marcarPrestador } from "@/app/(app)/empresas/[id]/equipe/actions";
import { confirmar } from "@/components/avisos";

/**
 * Tira a pessoa do PDI e da autoavaliação (marca como prestador de serviço),
 * ou a traz de volta. Nada é apagado: a pessoa só muda para a aba Prestadores.
 */
export default function BotaoPrestador({
  employeeId,
  nome,
  prestador,
  className,
}: {
  employeeId: string;
  nome: string;
  prestador: boolean;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return (
    <button
      type="button"
      disabled={pending}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
      }
      title={prestador ? undefined : "Prestador de serviço: sai do PDI e da autoavaliação. Nada é apagado."}
      onClick={async () => {
        const texto = prestador
          ? `Voltar ${nome} para o PDI e a autoavaliação?`
          : `Tirar ${nome} do PDI e da autoavaliação? A pessoa passa para a aba Prestadores da Equipe. Nada é apagado.`;
        if (!(await confirmar(texto))) return;
        startTransition(async () => {
          await marcarPrestador(employeeId, !prestador);
          router.refresh();
        });
      }}
    >
      {prestador ? "Voltar para o PDI" : "Tirar do PDI"}
    </button>
  );
}
