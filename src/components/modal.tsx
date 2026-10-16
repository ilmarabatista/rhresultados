"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

const LARGURAS = { lg: "max-w-lg", xl: "max-w-xl", "2xl": "max-w-2xl" } as const;

const FOCAVEIS =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Janela por cima da tela. Uma só para o sistema inteiro, com o básico de
 * acessibilidade: anunciada como diálogo, fecha no Esc, o foco entra nela,
 * fica preso nela enquanto aberta e volta para quem abriu. Clicar fora não
 * fecha, para um formulário pela metade não se perder.
 */
export default function Modal({
  titulo,
  aoFechar,
  largura = "2xl",
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  largura?: keyof typeof LARGURAS;
  children: React.ReactNode;
}) {
  const id = useId();
  const caixa = useRef<HTMLDivElement>(null);
  const fechar = useRef(aoFechar);
  fechar.current = aoFechar;

  useEffect(() => {
    const antes = document.activeElement;
    const primeiro = caixa.current?.querySelector<HTMLElement>(
      "input:not([type=hidden]), select, textarea",
    );
    (primeiro ?? caixa.current)?.focus();

    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar.current();
        return;
      }
      if (e.key !== "Tab" || !caixa.current) return;
      const itens = [...caixa.current.querySelectorAll<HTMLElement>(FOCAVEIS)];
      if (itens.length === 0) return;
      const [inicio, fim] = [itens[0], itens[itens.length - 1]];
      if (e.shiftKey && document.activeElement === inicio) {
        e.preventDefault();
        fim.focus();
      } else if (!e.shiftKey && document.activeElement === fim) {
        e.preventDefault();
        inicio.focus();
      }
    }
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      if (antes instanceof HTMLElement) antes.focus();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm sm:p-8">
      <div
        ref={caixa}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className={`w-full ${LARGURAS[largura]} rounded-lg border border-slate-200 bg-white p-4 shadow-xl outline-none`}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 id={id} className="text-sm font-semibold text-slate-900">
            {titulo}
          </h2>
          <button
            type="button"
            onClick={aoFechar}
            className="-m-1.5 rounded-md p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
