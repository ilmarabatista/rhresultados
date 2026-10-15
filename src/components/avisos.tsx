"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";

/**
 * Avisos e confirmações no visual do sistema, no lugar do alert() e do
 * confirm() do navegador.
 *
 *   if (!(await confirmar("Excluir esta vaga?"))) return;
 *   avisar("Não foi possível salvar.");
 *
 * Funcionam de qualquer componente de cliente, sem contexto: os pedidos entram
 * numa fila e o <Avisos /> do layout raiz mostra um de cada vez.
 */

type Rotulos = { sim?: string; nao?: string };

type Pedido = {
  tipo: "confirmar" | "avisar";
  texto: string;
  rotulos?: Rotulos;
  responder: (ok: boolean) => void;
};

let fila: Pedido[] = [];
const ouvintes = new Set<() => void>();

function trocar(nova: Pedido[]) {
  fila = nova;
  ouvintes.forEach((ouvir) => ouvir());
}

function assinar(ouvir: () => void) {
  ouvintes.add(ouvir);
  return () => {
    ouvintes.delete(ouvir);
  };
}

/**
 * Pergunta sim ou não. Resolve true quando a pessoa confirma; Esc ou
 * "Cancelar" resolvem false.
 */
export function confirmar(texto: string, rotulos?: Rotulos): Promise<boolean> {
  return new Promise((responder) => trocar([...fila, { tipo: "confirmar", texto, rotulos, responder }]));
}

/** Mostra um aviso com um botão de ok. */
export function avisar(texto: string): void {
  trocar([...fila, { tipo: "avisar", texto, responder: () => {} }]);
}

/** Atalho para o retorno das actions: avisa só quando veio erro. */
export function avisarSeErro(r: { error?: string } | undefined | null): void {
  if (r?.error) avisar(r.error);
}

export function Avisos() {
  const atual = useSyncExternalStore(
    assinar,
    () => fila[0],
    () => undefined,
  );
  const principal = useRef<HTMLButtonElement>(null);
  const cancelar = useRef<HTMLButtonElement>(null);
  const antes = useRef<Element | null>(null);

  function fechar(ok: boolean) {
    if (!atual) return;
    atual.responder(ok);
    trocar(fila.slice(1));
  }

  useEffect(() => {
    if (!atual) return;
    antes.current = document.activeElement;
    // Numa pergunta o foco fica no Cancelar: um Enter distraído não exclui nada.
    (cancelar.current ?? principal.current)?.focus();
    function tecla(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        fechar(false);
      }
    }
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("keydown", tecla);
      // Devolve o foco a quem abriu, para o teclado não se perder.
      if (antes.current instanceof HTMLElement) antes.current.focus();
    };
    // fechar muda a cada render; o que importa é o pedido atual.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atual]);

  if (!atual) return null;
  const pergunta = atual.tipo === "confirmar";

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-sm">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="aviso-texto"
        className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-xl"
      >
        <p id="aviso-texto" className="whitespace-pre-line text-sm text-slate-800">
          {atual.texto}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          {pergunta ? (
            <button
              ref={cancelar}
              type="button"
              onClick={() => fechar(false)}
              className="min-h-9 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              {atual.rotulos?.nao ?? "Cancelar"}
            </button>
          ) : null}
          <button
            ref={principal}
            type="button"
            onClick={() => fechar(true)}
            className="min-h-9 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            {pergunta ? (atual.rotulos?.sim ?? "Confirmar") : "Ok"}
          </button>
        </div>
      </div>
    </div>
  );
}
