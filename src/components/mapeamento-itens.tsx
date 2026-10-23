"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sparkles, ListChecks } from "lucide-react";
import { levarItensParaOModelo, sugerirItensDoMapeamento } from "@/app/(app)/empresas/[id]/equipe/mapeamento-actions";
import { SECAO_DO_TIPO } from "@/lib/autoavaliacao";
import { chaveDoTexto, type ItemSugerido, type TipoSugerido } from "@/lib/mapeamento";
import { FormError, Input, Select, Textarea } from "./form";
import { avisar } from "@/components/avisos";

/**
 * Do mapeamento para a autoavaliação: a IA (ou as tarefas como estão) sugere
 * os itens, o RH revisa, marca os que quer e leva para o modelo da função.
 */

type Linha = ItemSugerido & { marcado: boolean };

const TIPOS: TipoSugerido[] = ["TAREFA", "TECNICA", "COMPORTAMENTAL"];

export default function MapeamentoItens({
  companyId,
  mapId,
  modelos,
  sugerido,
  funcao,
}: {
  companyId: string;
  mapId: string;
  modelos: { id: string; nome: string; textos: string[] }[];
  sugerido: string | null;
  funcao: string;
}) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [modeloId, setModeloId] = useState(sugerido ?? (modelos[0]?.id || ""));
  const [nomeNovo, setNomeNovo] = useState(funcao);
  const [erro, setErro] = useState<string>();
  const [feito, setFeito] = useState<{ id: string; incluidos: number; repetidos: number } | null>(null);
  const [pensando, startPensar] = useTransition();
  const [levando, startLevar] = useTransition();

  const doModelo = new Set((modelos.find((m) => m.id === modeloId)?.textos ?? []).map(chaveDoTexto));

  function sugerir(usarIA: boolean) {
    setErro(undefined);
    setFeito(null);
    startPensar(async () => {
      const r = await sugerirItensDoMapeamento(mapId, usarIA);
      if (r.error || !r.itens) return setErro(r.error ?? "Nada a sugerir.");
      setLinhas(r.itens.map((i) => ({ ...i, marcado: true })));
    });
  }

  function levar() {
    setErro(undefined);
    const marcados = linhas.filter((l) => l.marcado && !doModelo.has(chaveDoTexto(l.texto)));
    startLevar(async () => {
      const r = await levarItensParaOModelo(mapId, modeloId, nomeNovo, marcados);
      if (r.error || !r.id) return setErro(r.error ?? "Não foi possível levar os itens.");
      setFeito({ id: r.id, incluidos: r.incluidos ?? 0, repetidos: r.repetidos ?? 0 });
      setModeloId(r.id);
      router.refresh();
      avisar(`${r.incluidos} item(ns) incluído(s) na autoavaliação.`);
    });
  }

  const marcados = linhas.filter((l) => l.marcado && !doModelo.has(chaveDoTexto(l.texto))).length;

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Levar para a autoavaliação</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Os itens saem do mapeamento salvo, no padrão “Tema: frase”, uma ação por item. Revise, marque e leve para o modelo
            da função.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pensando}
            onClick={() => sugerir(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            <Sparkles size={14} /> {pensando ? "Pensando…" : "Sugerir itens com a IA"}
          </button>
          <button
            type="button"
            disabled={pensando}
            onClick={() => sugerir(false)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            <ListChecks size={14} /> Usar as tarefas como estão
          </button>
        </div>
      </div>

      {linhas.length ? (
        <>
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {linhas.map((l, i) => {
              const ja = doModelo.has(chaveDoTexto(l.texto));
              return (
                <li key={i} className={`grid gap-2 p-2 sm:grid-cols-[auto_9rem_1fr] ${ja ? "opacity-50" : ""}`}>
                  <input
                    type="checkbox"
                    className="mt-2.5"
                    checked={l.marcado && !ja}
                    disabled={ja}
                    aria-label="Levar este item"
                    onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, marcado: e.target.checked } : x)))}
                  />
                  <Select
                    value={l.tipo}
                    aria-label="Seção"
                    onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, tipo: e.target.value as TipoSugerido } : x)))}
                  >
                    {TIPOS.map((t) => (
                      <option key={t} value={t}>
                        {SECAO_DO_TIPO[t].curto}
                      </option>
                    ))}
                  </Select>
                  <div>
                    <Textarea
                      rows={1}
                      value={l.texto}
                      onChange={(e) => setLinhas(linhas.map((x, j) => (j === i ? { ...x, texto: e.target.value } : x)))}
                    />
                    <p className="mt-0.5 text-micro text-slate-400">
                      {ja ? "Já está no modelo." : l.origem ? `De: ${l.origem}` : null}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-wrap items-end gap-2">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Modelo da função</span>
              <Select value={modeloId} onChange={(e) => setModeloId(e.target.value)} className="w-auto">
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nome}
                  </option>
                ))}
                <option value="">Criar um modelo novo…</option>
              </Select>
            </label>
            {modeloId === "" ? (
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-600">Nome do modelo novo</span>
                <Input value={nomeNovo} onChange={(e) => setNomeNovo(e.target.value)} />
              </label>
            ) : null}
            <button
              type="button"
              disabled={levando || marcados === 0}
              onClick={levar}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {levando ? "Levando…" : `Levar ${marcados} item(ns)`}
            </button>
          </div>
        </>
      ) : null}

      <FormError message={erro} />
      {feito ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {feito.incluidos} item(ns) incluído(s){feito.repetidos ? `, ${feito.repetidos} já estava(m) no modelo` : ""}.{" "}
          <Link href={`/empresas/${companyId}/pdi/autoavaliacoes/${feito.id}`} className="font-medium underline">
            Abrir o modelo
          </Link>
        </p>
      ) : null}
    </section>
  );
}
