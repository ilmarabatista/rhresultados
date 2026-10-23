"use client";

import { useActionState, useEffect, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2 } from "lucide-react";
import {
  duplicarModelo,
  excluirModelo,
  salvarModelo,
  type AutoavaliacaoState,
} from "@/app/(app)/empresas/[id]/pdi/autoavaliacoes/actions";
import { Field, FormError, Input, Select, SubmitButton } from "./form";
import { Etiqueta, Tabela, Vazio } from "./ui";
import { avisar, confirmar } from "@/components/avisos";

/** Os modelos de autoavaliação da empresa: um por função. */

type ModeloNaLista = {
  id: string;
  nome: string;
  cargo: string | null;
  perguntas: number;
  enviadas: number;
  atualizado: string;
};

export type EnviadaNaLista = {
  id: string;
  token: string;
  titulo: string;
  status: string;
  pessoa: string;
  pessoaId: string;
  enviadoEm: string;
  respondidoEm: string | null;
  prazo: string | null;
  atrasado: boolean;
  montada: boolean;
};

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

export function linkDaAutoavaliacao(token: string) {
  return `${window.location.origin}/autoavaliacao/${token}`;
}

export async function copiarLink(token: string) {
  const link = linkDaAutoavaliacao(token);
  try {
    await navigator.clipboard.writeText(link);
    avisar("Link copiado.");
  } catch {
    avisar(link);
  }
}

export function SituacaoDoEnvio({ e }: { e: Pick<EnviadaNaLista, "status" | "atrasado" | "montada"> }) {
  if (e.status === "RESPONDIDO") return <Etiqueta tom="bom">{e.montada ? "respondida · na avaliação" : "respondida"}</Etiqueta>;
  if (e.atrasado) return <Etiqueta tom="atencao">prazo vencido</Etiqueta>;
  return <Etiqueta tom="azul">aguardando</Etiqueta>;
}

function NovoModelo({ companyId, cargos }: { companyId: string; cargos: { id: string; nome: string }[] }) {
  const router = useRouter();
  const [state, action] = useActionState<AutoavaliacaoState, FormData>(salvarModelo, {});
  useEffect(() => {
    if (state.ok && state.id) router.push(`/empresas/${companyId}/pdi/autoavaliacoes/${state.id}`);
  }, [state, companyId, router]);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <input type="hidden" name="companyId" value={companyId} />
      <h2 className="text-sm font-semibold text-slate-900">Novo modelo</h2>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1.4fr)_auto] sm:items-end">
        <Field label="Função">
          <Input name="nome" required placeholder="Ex.: Recepção" />
        </Field>
        <Field label="Cargo (opcional)">
          <Select name="cargoId" defaultValue="">
            <option value="">Nenhum</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton pendingLabel="Criando…">Criar e montar perguntas</SubmitButton>
      </div>
      <p className="text-xs text-slate-500">
        Para aproveitar as perguntas de outra função, use Duplicar na lista abaixo e depois ajuste.
      </p>
      <FormError message={state.error} />
    </form>
  );
}

export default function AutoavaliacaoModelos({
  companyId,
  cargos,
  modelos,
}: {
  companyId: string;
  cargos: { id: string; nome: string }[];
  modelos: ModeloNaLista[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const fazer = (acao: () => Promise<AutoavaliacaoState>, depois?: (r: AutoavaliacaoState) => void) =>
    startTransition(async () => {
      const r = await acao();
      if (r.error) avisar(r.error);
      else depois?.(r);
    });

  return (
    <div className={`space-y-4 ${pending ? "opacity-60" : ""}`}>
      <NovoModelo companyId={companyId} cargos={cargos} />

      {modelos.length === 0 ? (
        <Vazio>Nenhum modelo ainda. Crie o primeiro com o nome da função.</Vazio>
      ) : (
        <Tabela titulo="Modelos por função" direita={`${modelos.length} modelo(s)`}>
          {modelos.map((m) => (
            <div
              key={m.id}
              className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 px-3 py-2 last:border-b-0 even:bg-slate-50/60"
            >
              <div className="min-w-[12rem] flex-1">
                <Link
                  href={`/empresas/${companyId}/pdi/autoavaliacoes/${m.id}`}
                  className="text-sm font-medium text-slate-800 hover:text-brand-700"
                >
                  {m.nome}
                </Link>
                <span className="block text-micro text-slate-500">
                  {m.perguntas} pergunta(s) · {m.enviadas} link(s) mandado(s)
                  {m.cargo ? ` · cargo ${m.cargo}` : ""} · alterado em {m.atualizado}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Link href={`/empresas/${companyId}/pdi/autoavaliacoes/${m.id}`} className={botaoClaro}>
                  <Pencil size={13} /> Editar
                </Link>
                <button
                  type="button"
                  className={botaoClaro}
                  onClick={() =>
                    fazer(
                      () => duplicarModelo(m.id),
                      (r) => r.id && router.push(`/empresas/${companyId}/pdi/autoavaliacoes/${r.id}`),
                    )
                  }
                >
                  <Copy size={13} /> Duplicar
                </button>
                <button
                  type="button"
                  className="p-1 text-slate-400 hover:text-red-600"
                  aria-label={`Excluir o modelo ${m.nome}`}
                  onClick={async () => {
                    if (
                      await confirmar(
                        `Excluir o modelo ${m.nome}? Os links já mandados continuam valendo, com as perguntas que tinham.`,
                      )
                    )
                      fazer(() => excluirModelo(m.id));
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </Tabela>
      )}

    </div>
  );
}
