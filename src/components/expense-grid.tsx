"use client";

import { Fragment, useState, useTransition } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import {
  arquivarLinha,
  criarLinha,
  excluirLinha,
  lancarDespesa,
  moverLinha,
  renomearLinha,
  usarLinhasSugeridas,
  type GestaoState,
} from "@/app/(app)/gestao/actions";
import {
  formatarValor,
  GRUPOS,
  lerValor,
  MESES_CURTOS,
  peso,
  rotuloDoGrupo,
} from "@/lib/gestao";

/**
 * Lançamento de despesa mês a mês, no formato de planilha.
 *
 * Cada célula é um campo: digita e sai do campo, grava. Vazio apaga. É o
 * gesto que a pessoa já conhece de planilha, e por isso não há botão de
 * salvar — ter um faria alguém perder o que digitou ao trocar de aba.
 */

export type LinhaDespesa = {
  id: string;
  nome: string;
  grupo: string | null;
  ativa: boolean;
  notas: string | null;
  /** Valor em centavos por mês, indexado de 1 a 12. */
  valores: Record<number, number>;
  temLancamento: boolean;
};

function Celula({
  lineId,
  ano,
  mes,
  centavos,
}: {
  lineId: string;
  ano: number;
  mes: number;
  centavos: number;
}) {
  const [valor, setValor] = useState(centavos ? formatarValor(centavos) : "");
  const [erro, setErro] = useState(false);
  const [pending, startTransition] = useTransition();

  const gravar = () => {
    const atual = centavos ? formatarValor(centavos) : "";
    if (valor.trim() === atual) return;

    if (valor.trim() !== "" && lerValor(valor) === null) {
      setErro(true);
      return;
    }
    setErro(false);

    startTransition(async () => {
      const r = await lancarDespesa(lineId, ano, mes, valor);
      if (r.error) setErro(true);
    });
  };

  return (
    <input
      value={valor}
      onChange={(e) => {
        setValor(e.target.value);
        setErro(false);
      }}
      onBlur={gravar}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") {
          setValor(centavos ? formatarValor(centavos) : "");
          setErro(false);
        }
      }}
      inputMode="decimal"
      aria-label={`${MESES_CURTOS[mes - 1]} — valor`}
      className={`w-full rounded px-1 py-0.5 text-right text-[11px] tabular-nums outline-none transition ${
        erro
          ? "bg-red-50 text-red-700 ring-1 ring-red-300"
          : pending
            ? "bg-brand-50 text-slate-500"
            : "bg-transparent text-slate-700 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-brand-300"
      }`}
    />
  );
}

function NomeEditavel({ linha }: { linha: LinhaDespesa }) {
  const [nome, setNome] = useState(linha.nome);
  const [, startTransition] = useTransition();

  return (
    <input
      value={nome}
      onChange={(e) => setNome(e.target.value)}
      onBlur={() => {
        if (nome.trim() && nome.trim() !== linha.nome) {
          startTransition(() => {
            void renomearLinha(linha.id, nome);
          });
        } else if (!nome.trim()) {
          setNome(linha.nome);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        if (e.key === "Escape") setNome(linha.nome);
      }}
      aria-label={`Nome da linha ${linha.nome}`}
      className={`w-full rounded px-1 py-0.5 text-left text-[11px] outline-none transition hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-brand-300 ${
        linha.ativa ? "text-slate-700" : "text-slate-400 line-through"
      }`}
    />
  );
}

export default function ExpenseGrid({
  ano,
  linhas,
}: {
  ano: number;
  linhas: LinhaDespesa[];
}) {
  const [novo, setNovo] = useState(false);
  const [mostrarArquivadas, setMostrarArquivadas] = useState(false);
  const [erro, setErro] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const visiveis = linhas.filter((l) => l.ativa || mostrarArquivadas);
  const arquivadas = linhas.filter((l) => !l.ativa).length;

  const meses = Array.from({ length: 12 }, (_, i) => i + 1);
  const totalDoMes = (m: number) =>
    linhas.reduce((s, l) => s + (l.valores[m] ?? 0), 0);
  const totalDaLinha = (l: LinhaDespesa) =>
    meses.reduce((s, m) => s + (l.valores[m] ?? 0), 0);
  const totalGeral = meses.reduce((s, m) => s + totalDoMes(m), 0);

  const acao = (f: () => Promise<unknown> | void) =>
    startTransition(async () => {
      setErro(undefined);
      const r = (await f()) as GestaoState | undefined;
      if (r?.error) setErro(r.error);
    });

  if (linhas.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="text-sm text-slate-600">
          O plano de contas está vazio.
        </p>
        <p className="mx-auto mt-1 max-w-md text-xs leading-relaxed text-slate-500">
          Comece pelas linhas sugeridas para consultoria de RH — todas podem ser
          renomeadas, reagrupadas, reordenadas ou removidas depois.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => acao(() => usarLinhasSugeridas())}
          className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          Usar as linhas sugeridas
        </button>
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="ml-3 text-sm text-slate-500 transition hover:text-slate-800"
        >
          criar do zero
        </button>
        {novo ? <FormularioLinha aoFechar={() => setNovo(false)} /> : null}
      </div>
    );
  }

  return (
    <div className={pending ? "opacity-70" : ""}>
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <button
          type="button"
          onClick={() => setNovo((v) => !v)}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50"
        >
          <Plus size={12} /> linha
        </button>

        {arquivadas > 0 ? (
          <button
            type="button"
            onClick={() => setMostrarArquivadas((v) => !v)}
            className="text-[11px] text-slate-500 transition hover:text-slate-800"
          >
            {mostrarArquivadas ? "esconder" : "mostrar"} {arquivadas} arquivada(s)
          </button>
        ) : null}

        <span className="ml-auto text-[11px] text-slate-400">
          digite na célula e saia do campo para gravar · vazio apaga
        </span>
      </div>

      {novo ? <FormularioLinha aoFechar={() => setNovo(false)} /> : null}

      {erro ? (
        <p role="alert" className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="w-full min-w-[1240px] border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80 text-[10px] uppercase tracking-wide text-slate-500">
              <th className="sticky left-0 z-10 w-64 min-w-64 bg-slate-50/95 px-2 py-1.5 text-left font-medium">
                Linha
              </th>
              {MESES_CURTOS.map((m) => (
                <th key={m} className="px-1 py-1.5 text-right font-medium">
                  {m}
                </th>
              ))}
              <th className="px-2 py-1.5 text-right font-medium">Ano</th>
              <th className="px-2 py-1.5 text-right font-medium">%</th>
              <th className="w-16 px-1 py-1.5" />
            </tr>
          </thead>

          <tbody>
            {GRUPOS.map((g) => {
              const doGrupo = visiveis.filter((l) => l.grupo === g.valor);
              if (doGrupo.length === 0) return null;

              const totalGrupo = doGrupo.reduce((s, l) => s + totalDaLinha(l), 0);

              return (
                <Fragment key={g.valor}>
                  <tr className="bg-slate-50/60">
                    <td
                      colSpan={16}
                      className="sticky left-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {g.label}
                      {totalGrupo > 0 ? (
                        <span className="ml-2 font-normal normal-case text-slate-400">
                          {formatarValor(totalGrupo)} no ano
                        </span>
                      ) : null}
                    </td>
                  </tr>

                  {doGrupo.map((l) => (
                    <LinhaDaTabela
                      key={l.id}
                      linha={l}
                      ano={ano}
                      meses={meses}
                      total={totalDaLinha(l)}
                      percentual={peso(totalDaLinha(l), totalGeral)}
                      aoAgir={acao}
                    />
                  ))}
                </Fragment>
              );
            })}

            {(() => {
              const semGrupo = visiveis.filter(
                (l) => !l.grupo || !GRUPOS.some((g) => g.valor === l.grupo),
              );
              if (semGrupo.length === 0) return null;
              return (
                <Fragment key="sem-grupo">
                  <tr className="bg-slate-50/60">
                    <td
                      colSpan={16}
                      className="sticky left-0 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {rotuloDoGrupo(null)}
                    </td>
                  </tr>
                  {semGrupo.map((l) => (
                    <LinhaDaTabela
                      key={l.id}
                      linha={l}
                      ano={ano}
                      meses={meses}
                      total={totalDaLinha(l)}
                      percentual={peso(totalDaLinha(l), totalGeral)}
                      aoAgir={acao}
                    />
                  ))}
                </Fragment>
              );
            })()}
          </tbody>

          <tfoot>
            <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold text-slate-800">
              <td className="sticky left-0 z-10 w-64 min-w-64 bg-slate-50 px-2 py-1.5 text-left">
                Total
              </td>
              {meses.map((m) => (
                <td key={m} className="px-1 py-1.5 text-right tabular-nums">
                  {totalDoMes(m) ? formatarValor(totalDoMes(m)) : "—"}
                </td>
              ))}
              <td className="px-2 py-1.5 text-right tabular-nums">
                {totalGeral ? formatarValor(totalGeral) : "—"}
              </td>
              <td className="px-2 py-1.5 text-right text-slate-400">100%</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function LinhaDaTabela({
  linha,
  ano,
  meses,
  total,
  percentual,
  aoAgir,
}: {
  linha: LinhaDespesa;
  ano: number;
  meses: number[];
  total: number;
  percentual: number;
  aoAgir: (f: () => Promise<unknown> | void) => void;
}) {
  return (
    <tr className="border-b border-slate-50 last:border-b-0 hover:bg-slate-50/40">
      <td
        className="sticky left-0 z-10 w-64 min-w-64 bg-white px-1 py-0.5"
        title={linha.notas ?? ""}
      >
        <NomeEditavel linha={linha} />
      </td>

      {meses.map((m) => (
        <td key={m} className="px-0.5 py-0.5">
          <Celula
            lineId={linha.id}
            ano={ano}
            mes={m}
            centavos={linha.valores[m] ?? 0}
          />
        </td>
      ))}

      <td className="px-2 py-0.5 text-right tabular-nums font-medium text-slate-700">
        {total ? formatarValor(total) : "—"}
      </td>
      <td className="px-2 py-0.5 text-right tabular-nums text-slate-400">
        {percentual ? `${percentual}%` : "—"}
      </td>

      <td className="whitespace-nowrap px-1 py-0.5 text-right">
        <button
          type="button"
          onClick={() => aoAgir(() => moverLinha(linha.id, "cima"))}
          className="text-slate-300 transition hover:text-slate-600"
          aria-label={`Subir ${linha.nome}`}
        >
          <ChevronUp size={12} />
        </button>
        <button
          type="button"
          onClick={() => aoAgir(() => moverLinha(linha.id, "baixo"))}
          className="ml-0.5 text-slate-300 transition hover:text-slate-600"
          aria-label={`Descer ${linha.nome}`}
        >
          <ChevronDown size={12} />
        </button>
        <button
          type="button"
          onClick={() => {
            if (linha.temLancamento) {
              aoAgir(() => arquivarLinha(linha.id, !linha.ativa));
              return;
            }
            if (!confirm(`Excluir a linha "${linha.nome}"?`)) return;
            aoAgir(() => excluirLinha(linha.id));
          }}
          className="ml-0.5 text-slate-300 transition hover:text-red-600"
          aria-label={
            linha.temLancamento
              ? `${linha.ativa ? "Arquivar" : "Reativar"} ${linha.nome}`
              : `Excluir ${linha.nome}`
          }
          title={
            linha.temLancamento
              ? "Tem lançamento: arquiva em vez de excluir"
              : "Excluir"
          }
        >
          <Trash2 size={12} />
        </button>
      </td>
    </tr>
  );
}

function FormularioLinha({ aoFechar }: { aoFechar: () => void }) {
  const [erro, setErro] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          const r = await criarLinha({}, fd);
          if (r.error) setErro(r.error);
          else aoFechar();
        })
      }
      className="mb-2 flex flex-wrap items-end gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3"
    >
      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
          Nome da linha
        </span>
        <input
          name="name"
          required
          autoFocus
          className="w-64 rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500"
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-[10px] uppercase tracking-wide text-slate-500">
          Grupo
        </span>
        <select
          name="group"
          defaultValue="ESTRUTURA"
          className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs outline-none focus:border-brand-500"
        >
          {GRUPOS.map((g) => (
            <option key={g.valor} value={g.valor}>
              {g.label}
            </option>
          ))}
        </select>
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Criando…" : "Criar"}
      </button>
      <button
        type="button"
        onClick={aoFechar}
        className="text-xs text-slate-500 transition hover:text-slate-800"
      >
        cancelar
      </button>

      {erro ? <span className="text-xs text-red-700">{erro}</span> : null}
    </form>
  );
}
