"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import { criarVaga, editarVaga, excluirVaga, type SelecaoState } from "@/app/(app)/selecao/actions";
import { Etiqueta, Painel, Vazio } from "./ui";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";

/**
 * As vagas: a lista e a abertura de uma nova.
 *
 * Serve às duas telas — o menu Seleção, com todas as empresas, e a aba da
 * empresa, que já chega com a empresa escolhida e não mostra o seletor.
 */

export type VagaNaLista = {
  id: string;
  titulo: string;
  status: string;
  empresa: { id: string; nome: string } | null;
  aberta: string;
  etapas: number;
  emAndamento: number;
  aprovados: number;
  /** Candidatos com alguma pendência: esperando resposta, parados ou sem retorno. */
  pendentes: number;
};

type Opcao = { id: string; nome: string };

const TOM: Record<string, "azul" | "atencao" | "neutro"> = {
  ABERTA: "azul",
  PAUSADA: "atencao",
  ENCERRADA: "neutro",
};

const ROTULO: Record<string, string> = {
  ABERTA: "aberta",
  PAUSADA: "pausada",
  ENCERRADA: "encerrada",
};

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";

function NovaVaga({
  empresas,
  empresaFixa,
  modelos,
  fechar,
}: {
  empresas: Opcao[];
  empresaFixa: string | null;
  modelos: { id: string; nome: string; etapas: number }[];
  fechar: () => void;
}) {
  const [state, action] = useActionState<SelecaoState, FormData>(criarVaga, {});
  const [modeloId, setModeloId] = useState(modelos[0]?.id ?? "");

  useEffect(() => {
    if (state.ok) fechar();
  }, [state, fechar]);

  const escolhido = modelos.find((m) => m.id === modeloId);

  return (
    <form action={action}>
      <Painel titulo="Abrir vaga" descricao="As etapas vêm do modelo escolhido e podem ser ajustadas dentro da vaga, sem mexer no modelo.">
        {empresaFixa ? <input type="hidden" name="companyId" value={empresaFixa} /> : null}
        <div className="grid gap-2 sm:grid-cols-2">
          {empresaFixa ? null : (
            <Field label="Empresa">
              <Select name="companyId" required defaultValue="">
                <option value="" disabled>
                  Escolha…
                </option>
                {empresas.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.nome}
                  </option>
                ))}
              </Select>
            </Field>
          )}
          <Field label="Cargo">
            <Input name="title" required placeholder="Ex.: Recepcionista" />
          </Field>
          <Field
            label="Modelo de processo"
            hint={escolhido ? `${escolhido.etapas} etapa(s), copiadas para esta vaga` : "sem modelo, você monta as etapas na vaga"}
          >
            <Select name="modeloId" value={modeloId} onChange={(e) => setModeloId(e.target.value)}>
              <option value="">Sem modelo</option>
              {modelos.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nome}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="Observações" hint="O que o cliente pediu, faixa salarial, horário — o que ajudar na triagem.">
          <Textarea name="notes" rows={2} />
        </Field>
        <FormError message={state.error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={fechar} className={botao}>
            Cancelar
          </button>
          <SubmitButton>Abrir vaga</SubmitButton>
        </div>
      </Painel>
    </form>
  );
}

function LinhaDaVaga({ vaga, mostrarEmpresa }: { vaga: VagaNaLista; mostrarEmpresa: boolean }) {
  const [, startTransition] = useTransition();

  const mudarStatus = (status: string) =>
    startTransition(async () => {
      const r = await editarVaga(vaga.id, { status });
      if (r.error) alert(r.error);
    });

  const excluir = () =>
    startTransition(async () => {
      if (!confirm(`Excluir a vaga de ${vaga.titulo}, com os candidatos dela?`)) return;
      const r = await excluirVaga(vaga.id);
      if (r.error) alert(r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-slate-100 px-3 py-2 last:border-0">
      <div className="min-w-[14rem] flex-1">
        <Link href={`/selecao/${vaga.id}`} className="text-[13px] font-medium text-slate-800 hover:text-brand-700">
          {vaga.titulo}
        </Link>
        <p className="text-[11px] text-slate-500">
          {mostrarEmpresa && vaga.empresa ? `${vaga.empresa.nome} · ` : ""}
          aberta em {vaga.aberta} · {vaga.etapas} etapa(s)
        </p>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-slate-600">
        <span>{vaga.emAndamento} em andamento</span>
        {vaga.aprovados > 0 ? <span className="text-emerald-700">{vaga.aprovados} aprovado(s)</span> : null}
        {vaga.pendentes > 0 ? <Etiqueta tom="atencao">{vaga.pendentes} pendente(s)</Etiqueta> : null}
        <Etiqueta tom={TOM[vaga.status] ?? "neutro"}>{ROTULO[vaga.status] ?? vaga.status}</Etiqueta>
      </div>

      <div className="flex items-center gap-1">
        {vaga.status === "ABERTA" ? (
          <button type="button" className={botao} onClick={() => mudarStatus("PAUSADA")}>
            Pausar
          </button>
        ) : (
          <button type="button" className={botao} onClick={() => mudarStatus("ABERTA")}>
            Reabrir
          </button>
        )}
        {vaga.status === "ENCERRADA" ? null : (
          <button type="button" className={botao} onClick={() => mudarStatus("ENCERRADA")}>
            Encerrar
          </button>
        )}
        <button type="button" className={botao} onClick={excluir} title="Excluir a vaga">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

export default function SelecaoVagas({
  vagas,
  empresas,
  modelos,
  empresaFixa = null,
}: {
  vagas: VagaNaLista[];
  empresas: Opcao[];
  modelos: { id: string; nome: string; etapas: number }[];
  /** Na aba da empresa, a vaga já nasce dela e a coluna da empresa some. */
  empresaFixa?: string | null;
}) {
  const [abrindo, setAbrindo] = useState(false);
  const [verEncerradas, setVerEncerradas] = useState(false);

  const visiveis = verEncerradas ? vagas : vagas.filter((v) => v.status !== "ENCERRADA");
  const encerradas = vagas.length - vagas.filter((v) => v.status !== "ENCERRADA").length;

  return (
    <div className="space-y-3">
      {abrindo ? (
        <NovaVaga empresas={empresas} empresaFixa={empresaFixa} modelos={modelos} fechar={() => setAbrindo(false)} />
      ) : (
        <div className="flex items-center justify-between">
          <button type="button" className={botao} onClick={() => setAbrindo(true)}>
            <Plus className="h-3 w-3" /> Abrir vaga
          </button>
          {encerradas > 0 ? (
            <button type="button" className={botao} onClick={() => setVerEncerradas((v) => !v)}>
              {verEncerradas ? "Esconder encerradas" : `Ver encerradas (${encerradas})`}
            </button>
          ) : null}
        </div>
      )}

      {visiveis.length === 0 ? (
        <Vazio>Nenhuma vaga por aqui. Abra a primeira para começar a acompanhar os candidatos.</Vazio>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          {visiveis.map((v) => (
            <LinhaDaVaga key={v.id} vaga={v} mostrarEmpresa={!empresaFixa} />
          ))}
        </div>
      )}
    </div>
  );
}
