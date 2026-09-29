"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { CheckCircle2, Fingerprint } from "lucide-react";
import { baterPonto, type BatidaState } from "@/app/ponto/[token]/actions";
import { FUSO } from "@/lib/dates";

/**
 * A tela do relógio de ponto: hora corrente grande, CPF, PIN e um botão.
 * Depois da batida mostra o comprovante por alguns segundos e limpa tudo
 * para a próxima pessoa.
 */

function formatarCpf(valor: string) {
  const d = valor.replace(/\D/g, "").slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

function Relogio() {
  const [agora, setAgora] = useState<Date | null>(null);
  useEffect(() => {
    setAgora(new Date());
    const t = setInterval(() => setAgora(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!agora) return <p className="h-[4.5rem]" />;
  const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(agora);
  const data = new Intl.DateTimeFormat("pt-BR", { timeZone: FUSO, weekday: "long", day: "2-digit", month: "long" }).format(agora);
  return (
    <div className="text-center">
      <p className="text-5xl font-semibold tabular-nums tracking-tight text-brand-900">{hora}</p>
      <p className="mt-1 text-sm text-slate-500 first-letter:uppercase">{data}</p>
    </div>
  );
}

export default function PontoRegistro({ token, empresa }: { token: string; empresa: string }) {
  const [state, action, pendente] = useActionState<BatidaState, FormData>(baterPonto, {});
  const [cpf, setCpf] = useState("");
  const [pin, setPin] = useState("");
  const [mostrarComprovante, setMostrarComprovante] = useState(false);
  const cpfRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    setMostrarComprovante(true);
    setCpf("");
    setPin("");
    const t = setTimeout(() => {
      setMostrarComprovante(false);
      cpfRef.current?.focus();
    }, 10_000);
    return () => clearTimeout(t);
  }, [state]);

  useEffect(() => {
    if (state.error) setPin("");
  }, [state]);

  const c = state.comprovante;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f7fa] px-4 py-8">
      <div className="w-full max-w-sm">
        <p className="text-center text-xs uppercase tracking-[0.12em] text-brand-600">{empresa}</p>
        <h1 className="mb-5 mt-1 text-center text-base font-semibold text-slate-800">Registro de ponto</h1>

        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <Relogio />

          {mostrarComprovante && c ? (
            <div className="mt-6 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-center">
              <CheckCircle2 className="mx-auto text-emerald-600" size={36} />
              <p className="mt-2 text-lg font-semibold text-emerald-900">
                {c.tipo} registrada às {c.hora}
              </p>
              <p className="text-sm text-emerald-800">{c.nome}</p>
              <div className="mt-3 border-t border-emerald-200 pt-2 text-left text-[11px] leading-relaxed text-emerald-900/80">
                <p className="font-semibold uppercase tracking-wider">Comprovante</p>
                <p>{c.empresa}</p>
                <p>
                  {c.data} às {c.hora} · NSR {String(c.nsr).padStart(9, "0")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMostrarComprovante(false);
                  cpfRef.current?.focus();
                }}
                className="mt-3 text-xs font-medium text-emerald-800 underline"
              >
                Próxima pessoa
              </button>
            </div>
          ) : (
            <form action={action} className="mt-6 space-y-3">
              <input type="hidden" name="token" value={token} />
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">CPF</span>
                <input
                  ref={cpfRef}
                  name="cpf"
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus
                  required
                  value={cpf}
                  onChange={(e) => setCpf(formatarCpf(e.target.value))}
                  placeholder="000.000.000-00"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-lg tabular-nums tracking-wider outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-slate-700">PIN</span>
                <input
                  name="pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  maxLength={6}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="••••"
                  className="w-full rounded-lg border border-slate-300 px-3 py-3 text-center text-lg tracking-[0.4em] outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
                />
              </label>

              {state.error ? (
                <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-center text-sm text-red-700">
                  {state.error}
                </p>
              ) : null}

              <button
                type="submit"
                disabled={pendente}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 py-3.5 text-base font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-60"
              >
                <Fingerprint size={20} />
                {pendente ? "Registrando…" : "Registrar ponto"}
              </button>
            </form>
          )}
        </div>

        <p className="mt-4 text-center text-[11px] leading-relaxed text-slate-400">
          Esqueceu o PIN ou bateu errado? Fale com o RH — a correção é feita por lá.
        </p>
      </div>
    </main>
  );
}
