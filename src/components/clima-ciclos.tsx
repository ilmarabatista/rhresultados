"use client";

import { useActionState, useEffect, useState } from "react";
import { criarHistorico, criarPesquisa, type ClimaState } from "@/app/(app)/empresas/[id]/clima/actions";
import { Field, FormError, Input, SubmitButton, Textarea } from "./form";
import Modal from "./modal";

/**
 * Os dois jeitos de começar um ciclo: um novo, que nasce como cópia do último
 * ciclo da empresa (ou das perguntas padrão), e um antigo, feito fora do
 * sistema, de que se digitam só as médias.
 */

const botaoClaro =
  "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50";
const botao = "rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700";

function NovoCiclo({ companyId, sugestaoDeNome, aoFechar }: { companyId: string; sugestaoDeNome: string; aoFechar: () => void }) {
  // Criada, a action leva direto para a montagem do ciclo.
  const [state, action] = useActionState<ClimaState, FormData>(criarPesquisa, {});

  return (
    <Modal titulo="Novo ciclo" aoFechar={aoFechar} largura="lg">
      <form action={action} className="space-y-3">
        <input type="hidden" name="companyId" value={companyId} />
        <Field label="Nome do ciclo *" hint="Ele começa como cópia do último ciclo da empresa. Na primeira vez, com as perguntas padrão da biblioteca.">
          <Input name="nome" required defaultValue={sugestaoDeNome} />
        </Field>
        <FormError message={state.error} />
        <div className="flex justify-end">
          <SubmitButton pendingLabel="Criando…">Criar e montar</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

export function FormularioDeHistorico({
  action,
  state,
  companyId,
  pesquisaId,
  inicial,
}: {
  action: (formData: FormData) => void;
  state: ClimaState;
  companyId?: string;
  pesquisaId?: string;
  inicial?: { nome: string; ano: number; medias: string };
}) {
  return (
    <form action={action} className="space-y-3">
      {companyId ? <input type="hidden" name="companyId" value={companyId} /> : null}
      {pesquisaId ? <input type="hidden" name="pesquisaId" value={pesquisaId} /> : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
        <Field label="Nome do ciclo *">
          <Input name="nome" required defaultValue={inicial?.nome ?? ""} placeholder="Clima 2021" />
        </Field>
        <Field label="Ano *">
          <Input name="ano" type="number" min={1990} max={2100} required defaultValue={inicial?.ano ?? ""} />
        </Field>
      </div>
      <Field label="Média de cada dimensão *" hint="Uma por linha: Dimensão; média. Também dá para colar as duas colunas de uma planilha.">
        <Textarea
          name="medias"
          rows={8}
          required
          defaultValue={inicial?.medias ?? ""}
          placeholder={"Liderança; 7,2\nComunicação; 5,8\nRemuneração e benefícios; 6,1"}
        />
      </Field>
      <FormError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}

function CicloAntigo({ companyId, aoFechar }: { companyId: string; aoFechar: () => void }) {
  const [state, action] = useActionState<ClimaState, FormData>(criarHistorico, {});
  useEffect(() => {
    if (state.ok) aoFechar();
  }, [state, aoFechar]);

  return (
    <Modal titulo="Ciclo antigo" aoFechar={aoFechar} largura="lg">
      <p className="mb-3 text-xs leading-relaxed text-slate-500">
        Para pesquisas feitas antes do sistema: com as médias de cada dimensão, o comparativo já mostra a evolução desde
        aquela época. Use os mesmos nomes de dimensão da biblioteca para as linhas se encontrarem.
      </p>
      <FormularioDeHistorico action={action} state={state} companyId={companyId} />
    </Modal>
  );
}

export default function ClimaCiclos({ companyId, sugestaoDeNome }: { companyId: string; sugestaoDeNome: string }) {
  const [aberto, setAberto] = useState<"novo" | "antigo" | null>(null);
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => setAberto("antigo")} className={botaoClaro}>
        Ciclo antigo
      </button>
      <button type="button" onClick={() => setAberto("novo")} className={botao}>
        Novo ciclo
      </button>
      {aberto === "novo" ? <NovoCiclo companyId={companyId} sugestaoDeNome={sugestaoDeNome} aoFechar={() => setAberto(null)} /> : null}
      {aberto === "antigo" ? <CicloAntigo companyId={companyId} aoFechar={() => setAberto(null)} /> : null}
    </div>
  );
}
