"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Trash2 } from "lucide-react";
import {
  excluirAcao,
  mudarStatusDaAcao,
  salvarAcao,
  salvarConclusao,
  type ClimaState,
} from "@/app/(app)/empresas/[id]/clima/actions";
import { formatarNota, NOME_DO_STATUS_DA_ACAO, STATUS_DA_ACAO, type StatusDaAcao } from "@/lib/clima";
import { FormError, Input, SmallSubmitButton } from "./form";
import { Faixa } from "./clima-faixa";
import { Etiqueta, Painel } from "./ui";
import { avisarSeErro, confirmar } from "./avisos";

/**
 * O relatório em construção: para cada dimensão, a média, a conclusão e as
 * ações. A conclusão começa com a frase que a régua sugere, e quem conduz a
 * pesquisa escreve o resto. As ações ficam com responsável e prazo, e o ciclo
 * seguinte mostra o que aconteceu com elas.
 */

export type Acao = {
  id: string;
  dimensao: string;
  descricao: string;
  responsavel: string;
  prazo: string;
  status: StatusDaAcao;
};

export type DimensaoDoPlano = {
  dimensao: string;
  media: number | null;
  dentro: number;
  abaixo: number;
  classificacao: "DENTRO" | "ABAIXO" | null;
  variacao: number | null;
  conclusao: string;
  sugerida: string;
};

export type AcaoAnterior = Acao & { antes: number | null; agora: number | null };

const TOM_DA_ACAO: Record<StatusDaAcao, "neutro" | "azul" | "bom"> = { PENDENTE: "neutro", ANDAMENTO: "azul", CONCLUIDA: "bom" };

function Conclusao({ pesquisaId, d }: { pesquisaId: string; d: DimensaoDoPlano }) {
  const router = useRouter();
  const [texto, setTexto] = useState(d.conclusao);
  const [pendente, start] = useTransition();
  const [salvo, setSalvo] = useState(false);
  const mudou = texto !== d.conclusao;

  return (
    <div className="space-y-1">
      <textarea
        value={texto}
        onChange={(e) => {
          setTexto(e.target.value);
          setSalvo(false);
        }}
        placeholder={d.sugerida}
        rows={2}
        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs leading-relaxed text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
      />
      <div className="flex justify-end gap-2 text-micro">
        {salvo ? <span className="text-emerald-700">salvo</span> : null}
        {!texto && !d.conclusao ? (
          <button type="button" onClick={() => setTexto(d.sugerida)} className="text-brand-700 hover:text-brand-900">
            usar a frase sugerida
          </button>
        ) : null}
        {mudou ? (
          <button
            type="button"
            disabled={pendente}
            onClick={() =>
              start(async () => {
                const r = await salvarConclusao(pesquisaId, d.dimensao, texto);
                avisarSeErro(r);
                if (r.ok) {
                  setSalvo(true);
                  router.refresh();
                }
              })
            }
            className="rounded-md bg-brand-700 px-2.5 py-1 font-medium text-white transition hover:bg-brand-800 disabled:opacity-60"
          >
            {pendente ? "Salvando…" : "Salvar conclusão"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function NovaAcao({ pesquisaId, dimensao }: { pesquisaId: string; dimensao: string }) {
  const [aberta, setAberta] = useState(false);
  const [state, action] = useActionState<ClimaState, FormData>(salvarAcao, {});
  useEffect(() => {
    if (state.ok) setAberta(false);
  }, [state]);

  if (!aberta) {
    return (
      <button type="button" onClick={() => setAberta(true)} className="inline-flex items-center gap-1 text-micro font-medium text-brand-700 hover:text-brand-900">
        <Plus size={12} /> ação
      </button>
    );
  }
  return (
    <form action={action} className="space-y-1.5 rounded-lg border border-brand-200 bg-brand-50/30 p-2">
      <input type="hidden" name="pesquisaId" value={pesquisaId} />
      <input type="hidden" name="dimensao" value={dimensao} />
      <Input name="descricao" required placeholder="O que será feito" className="text-xs" />
      <div className="grid gap-1.5 sm:grid-cols-[minmax(0,1fr)_9rem_auto_auto]">
        <Input name="responsavel" placeholder="Responsável" className="text-xs" />
        <Input name="prazo" type="date" className="text-xs" />
        <button type="button" onClick={() => setAberta(false)} className="text-micro text-slate-500 hover:text-slate-700">
          cancelar
        </button>
        <SmallSubmitButton>Incluir</SmallSubmitButton>
      </div>
      <FormError message={state.error} />
    </form>
  );
}

function LinhaDaAcao({ a }: { a: Acao }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-2 py-1 text-xs">
      <span className="min-w-0 flex-1 text-slate-700">
        {a.descricao}
        {a.responsavel || a.prazo ? (
          <span className="text-slate-500">
            {" "}
            · {[a.responsavel, a.prazo ? a.prazo.split("-").reverse().join("/") : ""].filter(Boolean).join(" · ")}
          </span>
        ) : null}
      </span>
      <select
        value={a.status}
        disabled={pendente}
        onChange={(e) =>
          start(async () => {
            avisarSeErro(await mudarStatusDaAcao(a.id, e.target.value));
            router.refresh();
          })
        }
        className="rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-micro"
      >
        {STATUS_DA_ACAO.map((s) => (
          <option key={s} value={s}>{NOME_DO_STATUS_DA_ACAO[s]}</option>
        ))}
      </select>
      <button
        type="button"
        aria-label="Excluir a ação"
        disabled={pendente}
        onClick={async () => {
          if (!(await confirmar("Excluir esta ação?", { sim: "Excluir" }))) return;
          start(async () => {
            avisarSeErro(await excluirAcao(a.id));
            router.refresh();
          });
        }}
        className="rounded p-1 text-slate-400 transition hover:bg-red-50 hover:text-red-700"
      >
        <Trash2 size={13} />
      </button>
    </li>
  );
}

export default function ClimaPlano({
  pesquisaId,
  relatorioHref,
  dimensoes,
  acoes,
  anteriores,
  nomeDoAnterior,
}: {
  pesquisaId: string;
  relatorioHref: string;
  dimensoes: DimensaoDoPlano[];
  acoes: Acao[];
  anteriores: AcaoAnterior[];
  nomeDoAnterior: string | null;
}) {
  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-500">Escreva a conclusão de cada dimensão e as ações. O relatório para imprimir junta tudo.</p>
        <Link href={relatorioHref} className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700">
          Ver o relatório
        </Link>
      </div>

      {anteriores.length ? (
        <Painel titulo={`Ações de ${nomeDoAnterior ?? "do ciclo anterior"}`} descricao="O que foi combinado no ciclo anterior e como a dimensão ficou depois.">
          <ul className="divide-y divide-slate-100 text-xs">
            {anteriores.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 py-1">
                <span className="w-44 shrink-0 font-medium text-slate-700">{a.dimensao}</span>
                <span className="min-w-0 flex-1 text-slate-600">{a.descricao}</span>
                <Etiqueta tom={TOM_DA_ACAO[a.status]}>{NOME_DO_STATUS_DA_ACAO[a.status]}</Etiqueta>
                <span className="w-28 text-right tabular-nums text-slate-600">
                  {formatarNota(a.antes)} → {formatarNota(a.agora)}
                </span>
              </li>
            ))}
          </ul>
        </Painel>
      ) : null}

      {dimensoes.map((d) => {
        const daDimensao = acoes.filter((a) => a.dimensao === d.dimensao);
        return (
          <Painel key={d.dimensao}>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <h3 className="text-sm font-semibold text-slate-800">{d.dimensao}</h3>
              <span className="text-sm font-semibold tabular-nums text-brand-800">{formatarNota(d.media)}</span>
              {d.classificacao ? (
                <Etiqueta tom={d.classificacao === "ABAIXO" ? "atencao" : "bom"}>
                  {d.classificacao === "ABAIXO" ? "Abaixo do esperado" : "Dentro do esperado"}
                </Etiqueta>
              ) : null}
              <Faixa dentro={d.dentro} abaixo={d.abaixo} />
              {d.variacao !== null && d.variacao !== 0 ? (
                <span className={`text-micro ${d.variacao > 0 ? "text-emerald-700" : "text-red-700"}`}>
                  {d.variacao > 0 ? "▲" : "▼"} {formatarNota(Math.abs(d.variacao))} desde {nomeDoAnterior}
                </span>
              ) : null}
            </div>
            <Conclusao pesquisaId={pesquisaId} d={d} />
            <div className="mt-1.5">
              <p className="text-micro font-medium uppercase tracking-wider text-slate-500">Ações</p>
              {daDimensao.length ? (
                <ul className="divide-y divide-slate-50">
                  {daDimensao.map((a) => (
                    <LinhaDaAcao key={a.id} a={a} />
                  ))}
                </ul>
              ) : null}
              <NovaAcao pesquisaId={pesquisaId} dimensao={d.dimensao} />
            </div>
          </Painel>
        );
      })}
    </div>
  );
}
