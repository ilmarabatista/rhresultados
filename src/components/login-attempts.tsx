"use client";

import { useTransition } from "react";
import { unlockLogin } from "@/app/(app)/admin/usuarios/actions";

export type TentativaItem = {
  email: string;
  ip: string | null;
  falhas: number;
  ultima: string;
  bloqueado: boolean;
};

function quando(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function Linha({ item }: { item: TentativaItem }) {
  const [pending, startTransition] = useTransition();

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-xl border px-4 py-2.5 ${
        item.bloqueado
          ? "border-red-200 bg-red-50/50"
          : "border-slate-200 bg-white"
      } ${pending ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-slate-800">{item.email}</p>
        <p className="text-[11px] text-slate-400">
          {item.falhas} falha(s) · última às {quando(item.ultima)}
          {item.ip ? ` · ${item.ip}` : ""}
        </p>
      </div>

      {item.bloqueado ? (
        <span className="shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
          bloqueado
        </span>
      ) : null}

      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            void unlockLogin(item.email);
          })
        }
        className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:bg-slate-50"
      >
        Liberar
      </button>
    </li>
  );
}

export default function LoginAttempts({
  tentativas,
}: {
  tentativas: TentativaItem[];
}) {
  if (tentativas.length === 0) return null;

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Tentativas de login recentes
        </h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Falhas dos últimos 15 minutos. Cinco no mesmo e-mail bloqueiam o
          acesso — liberar zera a contagem na hora.
        </p>
      </div>
      <ul className="space-y-2">
        {tentativas.map((t) => (
          <Linha key={t.email} item={t} />
        ))}
      </ul>
    </section>
  );
}
