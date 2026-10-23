"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Printer, Sparkles, Trash2, ArrowDown, ArrowUp } from "lucide-react";
import {
  excluirMapeamento,
  preencherPelaTranscricao,
  salvarMapeamento,
  type CabecalhoDoMapeamento,
} from "@/app/(app)/empresas/[id]/equipe/mapeamento-actions";
import {
  CRITICIDADES,
  PERIODICIDADES,
  ROTULO_DA_CRITICIDADE,
  ROTULO_DA_PERIODICIDADE,
  type Criticidade,
  type DadosDoMapeamento,
  type Periodicidade,
} from "@/lib/mapeamento";
import { Field, FormError, Input, Select, Textarea } from "./form";
import { avisar, confirmar } from "@/components/avisos";

/**
 * O mapeamento de rotinas na tela, nas seções do modelo da clínica. Tudo fica
 * no estado da página e vai para o banco no Salvar; o rascunho da IA entra na
 * tela para o RH revisar antes de salvar.
 */

type Campo = keyof DadosDoMapeamento;

const botaoIcone = "rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30";
const botaoLinha =
  "inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-700";

function Secao({ n, titulo, dica, children }: { n: number; titulo: string; dica?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">
          {n}. {titulo}
        </h2>
        {dica ? <p className="mt-0.5 text-xs text-slate-500">{dica}</p> : null}
      </div>
      {children}
    </section>
  );
}

function mover<T>(lista: T[], i: number, direcao: -1 | 1): T[] {
  const j = i + direcao;
  if (j < 0 || j >= lista.length) return lista;
  const nova = [...lista];
  [nova[i], nova[j]] = [nova[j], nova[i]];
  return nova;
}

export default function MapeamentoEditor({
  companyId,
  employeeId,
  mapId,
  pessoa,
  cabecalho: cabecalhoInicial,
  dados: dadosIniciais,
}: {
  companyId: string;
  employeeId: string;
  mapId: string;
  pessoa: string;
  cabecalho: CabecalhoDoMapeamento;
  dados: DadosDoMapeamento;
}) {
  const router = useRouter();
  const [cab, setCab] = useState(cabecalhoInicial);
  const [d, setD] = useState(dadosIniciais);
  const [mudou, setMudou] = useState(false);
  const [erro, setErro] = useState<string>();
  const [salvando, startSalvar] = useTransition();
  const [lendo, startLer] = useTransition();
  const [transcricao, setTranscricao] = useState("");
  const [abrirIA, setAbrirIA] = useState(false);

  // Sair da página com mudança sem salvar pede confirmação do navegador.
  useEffect(() => {
    if (!mudou) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [mudou]);

  function muda<K extends Campo>(campo: K, valor: DadosDoMapeamento[K]) {
    setD((atual) => ({ ...atual, [campo]: valor }));
    setMudou(true);
  }
  function mudaCab(campo: keyof CabecalhoDoMapeamento, valor: string) {
    setCab((atual) => ({ ...atual, [campo]: valor }));
    setMudou(true);
  }

  const texto = (campo: Campo & string, rows = 2, placeholder?: string) => (
    <Textarea
      rows={rows}
      value={d[campo] as string}
      placeholder={placeholder}
      onChange={(e) => muda(campo, e.target.value as never)}
    />
  );

  function salvar() {
    setErro(undefined);
    startSalvar(async () => {
      const r = await salvarMapeamento(mapId, cab, d);
      if (r.error) return setErro(r.error);
      setMudou(false);
      avisar("Mapeamento salvo.");
      router.refresh();
    });
  }

  function lerTranscricao() {
    setErro(undefined);
    startLer(async () => {
      const r = await preencherPelaTranscricao(mapId, transcricao, d);
      if (r.error || !r.dados) return setErro(r.error ?? "A IA não respondeu.");
      setD(r.dados);
      setMudou(true);
      setAbrirIA(false);
      avisar("Rascunho da IA na tela. Revise e salve.");
    });
  }

  async function excluir() {
    if (!(await confirmar(`Excluir este mapeamento de ${pessoa}?`, { sim: "Excluir" }))) return;
    const r = await excluirMapeamento(mapId);
    if (r.error) return setErro(r.error);
    router.push(`/empresas/${companyId}/equipe/${employeeId}`);
  }

  return (
    <div className="space-y-3.5">
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-micro uppercase tracking-wider text-slate-500">Mapeamento de rotinas</p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{pessoa}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/empresas/${companyId}/equipe/${employeeId}/mapeamento/${mapId}/imprimir`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <Printer size={14} /> Imprimir
            </Link>
            <button
              type="button"
              onClick={() => setAbrirIA((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 transition hover:bg-brand-100"
            >
              <Sparkles size={14} /> Preencher pela transcrição
            </button>
          </div>
        </div>

        {abrirIA ? (
          <div className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
            <p className="text-xs text-slate-600">
              Cole a transcrição da entrevista ou as suas anotações. A IA organiza nas seções abaixo, sem apagar o que você já
              escreveu e o que ela não encontrou. Nada é salvo até você clicar em Salvar.
            </p>
            <Textarea rows={8} value={transcricao} onChange={(e) => setTranscricao(e.target.value)} />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={lendo}
                onClick={lerTranscricao}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {lendo ? "Lendo a entrevista… (pode levar 1 a 2 minutos)" : "Organizar com a IA"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Data da entrevista">
            <Input type="date" value={cab.dataDaEntrevista} onChange={(e) => mudaCab("dataDaEntrevista", e.target.value)} />
          </Field>
          <Field label="Entrevistado por">
            <Input value={cab.entrevistador} onChange={(e) => mudaCab("entrevistador", e.target.value)} />
          </Field>
          <Field label="Versão">
            <Input value={cab.versao} onChange={(e) => mudaCab("versao", e.target.value)} />
          </Field>
          <Field label="Próxima revisão">
            <Input type="date" value={cab.proximaRevisao} onChange={(e) => mudaCab("proximaRevisao", e.target.value)} />
          </Field>
        </div>
      </section>

      <Secao n={1} titulo="Identificação">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Cargo / função">
            <Input value={d.cargo} onChange={(e) => muda("cargo", e.target.value)} />
          </Field>
          <Field label="Setor">
            <Input value={d.setor} onChange={(e) => muda("setor", e.target.value)} />
          </Field>
          <Field label="Tempo no cargo">
            <Input value={d.tempoNoCargo} onChange={(e) => muda("tempoNoCargo", e.target.value)} />
          </Field>
        </div>
      </Secao>

      <Secao n={2} titulo="Visão geral da função" dica="Pergunte: como você descreveria o que você faz aqui em poucas palavras?">
        <Field label="Resumo da função">{texto("resumo", 4)}</Field>
        <Field label="Qual é o seu principal entregável?">{texto("entregavel")}</Field>
        <Field label="Com quem você mais se relaciona no trabalho?">{texto("relacionamentos", 3)}</Field>
      </Secao>

      <Secao
        n={3}
        titulo="Processos e tarefas"
        dica="Pergunte: o que você faz logo quando chega? E todo dia, toda semana, todo mês? Uma tarefa por linha."
      >
        <div className="space-y-2">
          {d.tarefas.map((t, i) => (
            <div key={i} className="grid gap-2 rounded-lg border border-slate-200 p-2 sm:grid-cols-[2rem_1fr_9rem_7rem_auto]">
              <span className="pt-2 text-center text-xs font-semibold text-slate-400">{i + 1}</span>
              <Textarea
                rows={2}
                value={t.descricao}
                aria-label={`Tarefa ${i + 1}`}
                onChange={(e) => muda("tarefas", d.tarefas.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)))}
              />
              <Select
                value={t.periodicidade ?? ""}
                aria-label="Periodicidade"
                onChange={(e) =>
                  muda(
                    "tarefas",
                    d.tarefas.map((x, j) => (j === i ? { ...x, periodicidade: (e.target.value || null) as Periodicidade | null } : x)),
                  )
                }
              >
                <option value="">Periodicidade</option>
                {PERIODICIDADES.map((p) => (
                  <option key={p} value={p}>
                    {ROTULO_DA_PERIODICIDADE[p]}
                  </option>
                ))}
              </Select>
              <Select
                value={t.criticidade ?? ""}
                aria-label="Criticidade"
                onChange={(e) =>
                  muda(
                    "tarefas",
                    d.tarefas.map((x, j) => (j === i ? { ...x, criticidade: (e.target.value || null) as Criticidade | null } : x)),
                  )
                }
              >
                <option value="">Criticidade</option>
                {CRITICIDADES.map((c) => (
                  <option key={c} value={c}>
                    {ROTULO_DA_CRITICIDADE[c]}
                  </option>
                ))}
              </Select>
              <div className="flex items-start gap-0.5 pt-1">
                <button type="button" className={botaoIcone} disabled={i === 0} onClick={() => muda("tarefas", mover(d.tarefas, i, -1))} aria-label="Subir">
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className={botaoIcone}
                  disabled={i === d.tarefas.length - 1}
                  onClick={() => muda("tarefas", mover(d.tarefas, i, 1))}
                  aria-label="Descer"
                >
                  <ArrowDown size={14} />
                </button>
                <button type="button" className={botaoIcone} onClick={() => muda("tarefas", d.tarefas.filter((_, j) => j !== i))} aria-label="Excluir">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            className={botaoLinha}
            onClick={() => muda("tarefas", [...d.tarefas, { descricao: "", periodicidade: null, criticidade: null }])}
          >
            <Plus size={13} /> Tarefa
          </button>
        </div>
        <Field label="Alguma tarefa só você faz? (ou: dá para repassar a colegas?)">{texto("tarefaExclusiva")}</Field>
      </Secao>

      <Secao n={4} titulo="Passo a passo do processo principal" dica="Escolha com a pessoa o processo mais importante e peça que explique como se fosse ensinar alguém do zero.">
        <Field label="Nome do processo">
          <Input value={d.processoNome} onChange={(e) => muda("processoNome", e.target.value)} />
        </Field>
        <Field label="Exemplo real">{texto("processoExemplo", 3)}</Field>
        <div className="space-y-2">
          {d.passos.map((p, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="w-14 shrink-0 pt-2 text-xs font-semibold text-slate-500">Passo {i + 1}</span>
              <Textarea rows={2} value={p} aria-label={`Passo ${i + 1}`} onChange={(e) => muda("passos", d.passos.map((x, j) => (j === i ? e.target.value : x)))} />
              <div className="flex gap-0.5 pt-1">
                <button type="button" className={botaoIcone} disabled={i === 0} onClick={() => muda("passos", mover(d.passos, i, -1))} aria-label="Subir">
                  <ArrowUp size={14} />
                </button>
                <button
                  type="button"
                  className={botaoIcone}
                  disabled={i === d.passos.length - 1}
                  onClick={() => muda("passos", mover(d.passos, i, 1))}
                  aria-label="Descer"
                >
                  <ArrowDown size={14} />
                </button>
                <button type="button" className={botaoIcone} onClick={() => muda("passos", d.passos.filter((_, j) => j !== i))} aria-label="Excluir">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className={botaoLinha} onClick={() => muda("passos", [...d.passos, ""])}>
            <Plus size={13} /> Passo
          </button>
        </div>
        <Field label="O que fazer quando algo dá errado nesse processo?">{texto("quandoDaErrado", 3)}</Field>
      </Secao>

      <Secao n={5} titulo="Ferramentas, sistemas e acessos" dica="Todos os sistemas, aplicativos, planilhas ou equipamentos que a pessoa usa.">
        <div className="space-y-2">
          {d.ferramentas.map((f, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1.5fr_10rem_auto]">
              <Input
                value={f.nome}
                placeholder="Ferramenta / sistema"
                onChange={(e) => muda("ferramentas", d.ferramentas.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)))}
              />
              <Input
                value={f.uso}
                placeholder="Para que usa"
                onChange={(e) => muda("ferramentas", d.ferramentas.map((x, j) => (j === i ? { ...x, uso: e.target.value } : x)))}
              />
              <Input
                value={f.acesso}
                placeholder="Nível de acesso"
                onChange={(e) => muda("ferramentas", d.ferramentas.map((x, j) => (j === i ? { ...x, acesso: e.target.value } : x)))}
              />
              <button type="button" className={botaoIcone} onClick={() => muda("ferramentas", d.ferramentas.filter((_, j) => j !== i))} aria-label="Excluir">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className={botaoLinha} onClick={() => muda("ferramentas", [...d.ferramentas, { nome: "", uso: "", acesso: "" }])}>
            <Plus size={13} /> Ferramenta
          </button>
        </div>
        <Field label="Tem acesso a algum dado sensível ou financeiro?">{texto("dadoSensivel")}</Field>
      </Secao>

      <Secao n={6} titulo="Conhecimento crítico e informal" dica="O que não está escrito em lugar nenhum e se perderia se a pessoa saísse amanhã.">
        <Field label="O que uma pessoa nova precisaria saber para te substituir por um dia?">{texto("substituir", 3)}</Field>
        <Field label="Tem algum contato externo que só você gerencia?">{texto("contatoExterno")}</Field>
        <Field label="Existe alguma regra não documentada que você aplica no dia a dia?">{texto("regraNaoEscrita")}</Field>
      </Secao>

      <Secao n={7} titulo="Gargalos, riscos e oportunidades de melhoria" dica="Pergunte: o que mais trava o seu trabalho? O que poderia ser diferente?">
        <div className="space-y-2">
          {d.gargalos.map((g, i) => (
            <div key={i} className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Textarea
                rows={2}
                value={g.situacao}
                placeholder="Situação de risco / gargalo"
                onChange={(e) => muda("gargalos", d.gargalos.map((x, j) => (j === i ? { ...x, situacao: e.target.value } : x)))}
              />
              <Textarea
                rows={2}
                value={g.impacto}
                placeholder="O que acontece se não for feito / sugestão de melhoria"
                onChange={(e) => muda("gargalos", d.gargalos.map((x, j) => (j === i ? { ...x, impacto: e.target.value } : x)))}
              />
              <button type="button" className={botaoIcone} onClick={() => muda("gargalos", d.gargalos.filter((_, j) => j !== i))} aria-label="Excluir">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button type="button" className={botaoLinha} onClick={() => muda("gargalos", [...d.gargalos, { situacao: "", impacto: "" }])}>
            <Plus size={13} /> Gargalo
          </button>
        </div>
        <Field label="Na sua opinião, o que poderia melhorar no seu setor?">{texto("melhoriaDoSetor")}</Field>
      </Secao>

      <Secao n={8} titulo="Indicadores e metas do cargo" dica="Como a pessoa sabe se está indo bem, ou não.">
        <Field label="Como você sabe que fez um bom trabalho hoje?">{texto("bomTrabalho")}</Field>
        <Field label="Existe alguma meta ou número que você acompanha?">{texto("metaAcompanhada")}</Field>
        <Field label="Como você mediria a qualidade do seu trabalho para alguém de fora?">{texto("qualidade")}</Field>
      </Secao>

      <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">9. Observações da gerente de RH</h2>
          <p className="mt-0.5 text-xs text-amber-800">Só para o RH. Não sai na via do colaborador.</p>
        </div>
        <Field label="Impressões gerais sobre o colaborador e o setor">{texto("rhImpressoes", 4)}</Field>
        <Field label="Pontos de atenção" hint="Um por linha. Cada linha vira uma sugestão de meta no PDI.">
          {texto("rhAtencao", 4)}
        </Field>
        <Field label="Próximos passos após a entrevista" hint="Um por linha. Também viram sugestões de meta no PDI.">
          {texto("rhProximosPassos", 4)}
        </Field>
      </section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
        <button type="button" onClick={excluir} className="text-sm text-red-600 hover:underline">
          Excluir mapeamento
        </button>
        <div className="flex flex-1 items-center justify-end gap-3">
          <FormError message={erro} />
          {mudou ? <span className="text-xs text-amber-700">Há mudanças sem salvar</span> : null}
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
