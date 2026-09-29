"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import {
  adicionarEtapaDoModelo,
  criarModelo,
  editarEtapaDoModelo,
  excluirEtapaDoModelo,
  excluirModelo,
  moverEtapaDoModelo,
  renomearModelo,
  type SelecaoState,
} from "@/app/(app)/selecao/actions";
import { TIPOS_DE_ETAPA, rotuloDoTipo } from "@/lib/selecao";
import { Painel, Vazio } from "./ui";
import { FormError, Input, Select, SubmitButton } from "./form";

/**
 * Os modelos de processo: as etapas que ela costuma usar, guardadas para
 * abrir vaga sem montar tudo de novo.
 *
 * O modelo é um ponto de partida, não um dono: a vaga leva uma cópia das
 * etapas, e mexer aqui depois não mexe em vaga nenhuma.
 */

export type ModeloNaTela = {
  id: string;
  nome: string;
  descricao: string | null;
  etapas: { id: string; nome: string; tipo: string; prazoDias: number | null }[];
};

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";

function Etapa({ etapa, primeira, ultima }: { etapa: ModeloNaTela["etapas"][number]; primeira: boolean; ultima: boolean }) {
  const [nome, setNome] = useState(etapa.nome);
  const [, startTransition] = useTransition();

  useEffect(() => setNome(etapa.nome), [etapa.nome]);

  const rodar = (fn: () => Promise<SelecaoState>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) alert(r.error);
    });

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-slate-100 py-1.5 last:border-0">
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={() => {
          if (nome !== etapa.nome) rodar(() => editarEtapaDoModelo(etapa.id, { nome }));
        }}
        className="min-w-[10rem] flex-1 rounded-md border border-transparent px-1.5 py-1 text-[12px] text-slate-700 outline-none hover:border-slate-200 focus:border-brand-400"
      />
      <select
        value={etapa.tipo}
        onChange={(e) => rodar(() => editarEtapaDoModelo(etapa.id, { tipo: e.target.value }))}
        className="rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-400"
      >
        {TIPOS_DE_ETAPA.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.rotulo}
          </option>
        ))}
      </select>
      <input
        defaultValue={etapa.prazoDias ?? ""}
        onBlur={(e) => {
          const n = Number(e.target.value);
          rodar(() => editarEtapaDoModelo(etapa.id, { prazoDias: Number.isFinite(n) && n > 0 ? Math.floor(n) : null }));
        }}
        placeholder="dias"
        title="Prazo: depois disso o candidato aparece como parado"
        className="w-16 rounded-md border border-slate-200 px-1.5 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-400"
      />
      {primeira ? null : (
        <button type="button" className={botao} onClick={() => rodar(() => moverEtapaDoModelo(etapa.id, "SUBIR"))}>
          ↑
        </button>
      )}
      {ultima ? null : (
        <button type="button" className={botao} onClick={() => rodar(() => moverEtapaDoModelo(etapa.id, "DESCER"))}>
          ↓
        </button>
      )}
      <button type="button" className={botao} onClick={() => rodar(() => excluirEtapaDoModelo(etapa.id))}>
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

function Modelo({ modelo }: { modelo: ModeloNaTela }) {
  const acao = adicionarEtapaDoModelo.bind(null, modelo.id);
  const [state, action] = useActionState<SelecaoState, FormData>(acao, {});
  const [nome, setNome] = useState(modelo.nome);
  const [aberto, setAberto] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => setNome(modelo.nome), [modelo.nome]);

  const rodar = (fn: () => Promise<SelecaoState>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) alert(r.error);
    });

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-2.5">
      <div className="flex items-center gap-2">
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onBlur={() => {
            if (nome !== modelo.nome) rodar(() => renomearModelo(modelo.id, nome, modelo.descricao ?? ""));
          }}
          className="flex-1 rounded-md border border-transparent px-1.5 py-1 text-[13px] font-medium text-slate-800 outline-none hover:border-slate-200 focus:border-brand-400"
        />
        <button type="button" className={botao} onClick={() => setAberto((v) => !v)}>
          {aberto ? "Fechar" : `${modelo.etapas.length} etapa(s)`}
        </button>
        <button
          type="button"
          className={botao}
          onClick={() => {
            if (confirm(`Excluir o modelo "${modelo.nome}"? As vagas já abertas não mudam.`)) rodar(() => excluirModelo(modelo.id));
          }}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>

      {aberto ? (
        <div className="mt-1.5">
          {modelo.etapas.length === 0 ? (
            <p className="py-2 text-[11px] text-slate-400">Sem etapas ainda.</p>
          ) : (
            modelo.etapas.map((e, i) => <Etapa key={e.id} etapa={e} primeira={i === 0} ultima={i === modelo.etapas.length - 1} />)
          )}
          <form action={action} className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <Input name="nome" required placeholder="Nova etapa" className="min-w-[10rem] flex-1" />
            <Select name="tipo" defaultValue="LIVRE" className="w-auto">
              {TIPOS_DE_ETAPA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo}
                </option>
              ))}
            </Select>
            <Input name="prazoDias" placeholder="dias" className="w-20" />
            <SubmitButton>Adicionar</SubmitButton>
            <FormError message={state.error} />
          </form>
        </div>
      ) : (
        <p className="mt-0.5 px-1.5 text-[11px] text-slate-500">
          {modelo.etapas.map((e) => `${e.nome} (${rotuloDoTipo(e.tipo)})`).join(" → ") || "sem etapas"}
        </p>
      )}
    </div>
  );
}

export default function SelecaoModelos({ modelos }: { modelos: ModeloNaTela[] }) {
  const [state, action] = useActionState<SelecaoState, FormData>(criarModelo, {});
  const [criando, setCriando] = useState(false);

  useEffect(() => {
    if (state.ok) setCriando(false);
  }, [state]);

  return (
    <Painel
      titulo="Modelos de processo"
      descricao="As etapas que você costuma usar. Ao abrir uma vaga, elas são copiadas para lá e podem ser ajustadas na vaga."
      acao={
        criando ? null : (
          <button type="button" className={botao} onClick={() => setCriando(true)}>
            <Plus className="h-3 w-3" /> Novo modelo
          </button>
        )
      }
    >
      <div className="space-y-2">
        {criando ? (
          <form action={action} className="flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 p-2">
            <Input name="nome" required placeholder="Nome do modelo (ex.: Recepção)" className="min-w-[12rem] flex-1" />
            <SubmitButton>Criar</SubmitButton>
            <button type="button" className={botao} onClick={() => setCriando(false)}>
              Cancelar
            </button>
            <FormError message={state.error} />
            <p className="w-full text-[11px] text-slate-500">Já nasce com as etapas de sempre; é só ajustar.</p>
          </form>
        ) : null}

        {modelos.length === 0 && !criando ? (
          <Vazio>Nenhum modelo ainda. Crie um para não montar as etapas em toda vaga.</Vazio>
        ) : (
          modelos.map((m) => <Modelo key={m.id} modelo={m} />)
        )}
      </div>
    </Painel>
  );
}
