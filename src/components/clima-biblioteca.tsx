"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  alternarDimensao,
  alternarPergunta,
  carregarBibliotecaInicial,
  excluirPergunta,
  moverDimensao,
  salvarDimensao,
  salvarPergunta,
  type BibliotecaState,
} from "@/app/(app)/clima/actions";
import { NOME_DO_TIPO, TIPOS, type TipoDePergunta } from "@/lib/clima";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";
import { Etiqueta, Painel, Vazio } from "./ui";
import { avisarSeErro, confirmar } from "./avisos";

/**
 * A biblioteca da pesquisa de clima: dimensões e perguntas. "Padrão" quer dizer
 * que a pergunta entra sozinha na primeira pesquisa de uma empresa; as outras
 * ficam à mão na montagem.
 */

export type PerguntaDaBiblioteca = {
  id: string;
  enunciado: string;
  tipo: TipoDePergunta;
  opcoes: string[];
  maxEscolhas: number | null;
  enps: boolean;
  padrao: boolean;
  ativa: boolean;
  usos: number;
};

export type DimensaoDaBiblioteca = {
  id: string;
  nome: string;
  descricao: string;
  ativa: boolean;
  perguntas: PerguntaDaBiblioteca[];
};

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";
const icone = "rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-brand-700 disabled:opacity-40";

function FormularioDeDimensao({ inicial, aoFim }: { inicial?: DimensaoDaBiblioteca; aoFim: () => void }) {
  const [state, action] = useActionState<BibliotecaState, FormData>(salvarDimensao, {});
  useEffect(() => {
    if (state.ok) aoFim();
  }, [state, aoFim]);
  return (
    <form action={action} className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/30 p-3">
      {inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-[16rem_minmax(0,1fr)]">
        <Field label="Dimensão *">
          <Input name="nome" required defaultValue={inicial?.nome ?? ""} />
        </Field>
        <Field label="O que ela analisa">
          <Input name="descricao" defaultValue={inicial?.descricao ?? ""} />
        </Field>
      </div>
      <FormError message={state.error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoFim} className={botaoClaro}>Cancelar</button>
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}

function FormularioDePergunta({
  dimensaoId,
  inicial,
  aoFim,
}: {
  dimensaoId: string;
  inicial?: PerguntaDaBiblioteca;
  aoFim: () => void;
}) {
  const [state, action] = useActionState<BibliotecaState, FormData>(salvarPergunta, {});
  const [tipo, setTipo] = useState<TipoDePergunta>(inicial?.tipo ?? "NOTA");
  useEffect(() => {
    if (state.ok) aoFim();
  }, [state, aoFim]);
  return (
    <form action={action} className="my-1.5 space-y-2 rounded-lg border border-brand-200 bg-brand-50/30 p-3">
      <input type="hidden" name="dimensaoId" value={dimensaoId} />
      {inicial ? <input type="hidden" name="id" value={inicial.id} /> : null}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <Field label="Pergunta *" hint="Escreva de forma que nota alta seja bom.">
          <Input name="enunciado" required defaultValue={inicial?.enunciado ?? ""} placeholder="O quanto…" />
        </Field>
        <Field label="Tipo">
          <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDePergunta)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>{NOME_DO_TIPO[t]}</option>
            ))}
          </Select>
        </Field>
      </div>
      {tipo === "ESCOLHA" || tipo === "MULTIPLA" ? (
        <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="Opções *" hint="Uma por linha.">
            <Textarea name="opcoes" rows={4} required defaultValue={inicial?.opcoes.join("\n") ?? ""} />
          </Field>
          {tipo === "MULTIPLA" ? (
            <Field label="Escolher até">
              <Input name="maxEscolhas" type="number" min={1} defaultValue={inicial?.maxEscolhas ?? 3} />
            </Field>
          ) : null}
        </div>
      ) : null}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" name="padrao" defaultChecked={inicial?.padrao ?? false} className="accent-brand-600" />
          Entra na primeira pesquisa de cada empresa
        </label>
        {tipo === "NOTA" ? (
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="enps" defaultChecked={inicial?.enps ?? false} className="accent-brand-600" />
            É a pergunta do eNPS (de 0 a 10)
          </label>
        ) : null}
      </div>
      <FormError message={state.error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={aoFim} className={botaoClaro}>Cancelar</button>
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}

function LinhaDePergunta({ dimensaoId, p }: { dimensaoId: string; p: PerguntaDaBiblioteca }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [pendente, start] = useTransition();
  if (editando) return <FormularioDePergunta dimensaoId={dimensaoId} inicial={p} aoFim={() => setEditando(false)} />;

  function rodar(f: () => Promise<BibliotecaState>) {
    start(async () => {
      avisarSeErro(await f());
      router.refresh();
    });
  }

  return (
    <li className={`flex items-start gap-2 py-1 text-xs ${p.ativa ? "" : "opacity-50"}`}>
      <span className="min-w-0 flex-1 leading-snug text-slate-700">
        {p.enunciado}
        {p.tipo !== "NOTA" ? <span className="ml-1.5"><Etiqueta>{NOME_DO_TIPO[p.tipo]}</Etiqueta></span> : null}
        {p.enps ? <span className="ml-1.5"><Etiqueta tom="azul">eNPS · 0 a 10</Etiqueta></span> : null}
        {!p.ativa ? <span className="ml-1.5"><Etiqueta>desativada</Etiqueta></span> : null}
      </span>
      <label className="flex shrink-0 items-center gap-1 text-micro text-slate-500" title="Entra na primeira pesquisa de cada empresa">
        <input type="checkbox" checked={p.padrao} disabled={pendente} onChange={(e) => rodar(() => alternarPergunta(p.id, "padrao", e.target.checked))} className="accent-brand-600" />
        padrão
      </label>
      <button type="button" aria-label="Editar" onClick={() => setEditando(true)} className={icone}>
        <Pencil size={13} />
      </button>
      {p.ativa ? (
        <button
          type="button"
          aria-label={p.usos ? "Desativar" : "Excluir"}
          title={p.usos ? `Já usada em ${p.usos} pesquisa(s): fica desativada, sem sumir delas.` : "Excluir"}
          disabled={pendente}
          onClick={async () => {
            if (!(await confirmar(p.usos ? "Desativar esta pergunta? Ela continua nas pesquisas que já a usaram." : "Excluir esta pergunta?", { sim: p.usos ? "Desativar" : "Excluir" }))) return;
            rodar(() => excluirPergunta(p.id));
          }}
          className={`${icone} hover:bg-red-50 hover:text-red-700`}
        >
          <Trash2 size={13} />
        </button>
      ) : (
        <button type="button" disabled={pendente} onClick={() => rodar(() => alternarPergunta(p.id, "ativa", true))} className="text-micro text-brand-700 hover:text-brand-900">
          reativar
        </button>
      )}
    </li>
  );
}

function Dimensao({ d, primeira, ultima }: { d: DimensaoDaBiblioteca; primeira: boolean; ultima: boolean }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [nova, setNova] = useState(false);
  const [pendente, start] = useTransition();

  function rodar(f: () => Promise<BibliotecaState>) {
    start(async () => {
      avisarSeErro(await f());
      router.refresh();
    });
  }

  const padrao = d.perguntas.filter((p) => p.ativa && p.padrao).length;
  return (
    <section className={`rounded-lg border border-slate-200 bg-white ${d.ativa ? "" : "opacity-60"}`}>
      {editando ? (
        <div className="p-3">
          <FormularioDeDimensao inicial={d} aoFim={() => setEditando(false)} />
        </div>
      ) : (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-3.5 py-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800">
              {d.nome}
              <span className="ml-2 text-micro font-normal text-slate-500">
                {d.perguntas.filter((p) => p.ativa).length} perguntas · {padrao} padrão
              </span>
            </h3>
            {d.descricao ? <p className="mt-0.5 text-xs text-slate-500">{d.descricao}</p> : null}
          </div>
          <div className="flex items-center gap-0.5">
            <button type="button" aria-label="Subir" disabled={primeira || pendente} onClick={() => rodar(() => moverDimensao(d.id, -1))} className={icone}>
              <ArrowUp size={13} />
            </button>
            <button type="button" aria-label="Descer" disabled={ultima || pendente} onClick={() => rodar(() => moverDimensao(d.id, 1))} className={icone}>
              <ArrowDown size={13} />
            </button>
            <button type="button" aria-label="Editar a dimensão" onClick={() => setEditando(true)} className={icone}>
              <Pencil size={13} />
            </button>
            <button
              type="button"
              disabled={pendente}
              onClick={() => rodar(() => alternarDimensao(d.id, !d.ativa))}
              className="ml-1 text-micro text-slate-500 hover:text-brand-700"
            >
              {d.ativa ? "desativar" : "reativar"}
            </button>
          </div>
        </div>
      )}
      <div className="px-3.5 py-1.5">
        <ul className="divide-y divide-slate-50">
          {d.perguntas.map((p) => (
            <LinhaDePergunta key={p.id} dimensaoId={d.id} p={p} />
          ))}
        </ul>
        {nova ? (
          <FormularioDePergunta dimensaoId={d.id} aoFim={() => setNova(false)} />
        ) : (
          <button type="button" onClick={() => setNova(true)} className="my-1 inline-flex items-center gap-1 text-micro font-medium text-brand-700 hover:text-brand-900">
            <Plus size={12} /> pergunta
          </button>
        )}
      </div>
    </section>
  );
}

export default function ClimaBiblioteca({ dimensoes }: { dimensoes: DimensaoDaBiblioteca[] }) {
  const router = useRouter();
  const [nova, setNova] = useState(false);
  const [pendente, start] = useTransition();

  if (dimensoes.length === 0) {
    return (
      <Vazio
        acao={
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              start(async () => {
                avisarSeErro(await carregarBibliotecaInicial());
                router.refresh();
              })
            }
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {pendente ? "Carregando…" : "Carregar a biblioteca inicial"}
          </button>
        }
      >
        A biblioteca está vazia. A inicial traz 18 dimensões e as perguntas de cada uma, todas no padrão “nota alta é bom”.
        Depois de carregada, tudo se edita aqui.
      </Vazio>
    );
  }

  return (
    <div className="space-y-2.5">
      <Painel>
        <p className="text-xs leading-relaxed text-slate-500">
          Mudar a biblioteca não mexe nas pesquisas já montadas: cada pesquisa guarda a sua cópia das perguntas. Escreva as
          perguntas de nota de forma que nota alta seja sempre bom, para a média da dimensão não se confundir.
        </p>
      </Painel>
      {dimensoes.map((d, i) => (
        <Dimensao key={d.id} d={d} primeira={i === 0} ultima={i === dimensoes.length - 1} />
      ))}
      {nova ? (
        <FormularioDeDimensao aoFim={() => setNova(false)} />
      ) : (
        <button type="button" onClick={() => setNova(true)} className={botaoClaro}>
          <Plus size={13} /> Dimensão
        </button>
      )}
    </div>
  );
}
