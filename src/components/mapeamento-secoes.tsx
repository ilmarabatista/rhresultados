"use client";

import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import {
  CRITICIDADES,
  PERIODICIDADES,
  ROTULO_DA_CRITICIDADE,
  ROTULO_DA_PERIODICIDADE,
  type Criticidade,
  type DadosDoMapeamento,
  type Periodicidade,
} from "@/lib/mapeamento";
import { Field, Input, Select, Textarea } from "./form";

/**
 * As seções 1 a 8 do mapeamento, as que a própria pessoa também preenche.
 * Servem ao editor do RH e ao link da pessoa: muda só o texto de ajuda, que no
 * link fala com ela ("você") e no RH orienta a entrevista.
 */

type Campo = keyof DadosDoMapeamento;

const botaoIcone = "rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30";
const botaoLinha =
  "inline-flex items-center gap-1 rounded-md border border-dashed border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-brand-400 hover:text-brand-700";

export function Secao({ n, titulo, dica, children }: { n: number; titulo: string; dica?: string; children: React.ReactNode }) {
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

export default function MapeamentoSecoes({
  d,
  muda,
  publico = false,
}: {
  d: DadosDoMapeamento;
  muda: <K extends Campo>(campo: K, valor: DadosDoMapeamento[K]) => void;
  /** No link da pessoa: os textos de ajuda falam com ela. */
  publico?: boolean;
}) {
  const p = (rh: string, pessoa: string) => (publico ? pessoa : rh);
  const texto = (campo: Campo & string, rows = 2, placeholder?: string) => (
    <Textarea
      rows={rows}
      value={d[campo] as string}
      placeholder={placeholder}
      onChange={(e) => muda(campo, e.target.value as never)}
    />
  );

  return (
    <>
      <Secao n={1} titulo="Identificação">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={p("Cargo / função", "Sua função")}>
            <Input value={d.cargo} onChange={(e) => muda("cargo", e.target.value)} />
          </Field>
          <Field label="Setor">
            <Input value={d.setor} onChange={(e) => muda("setor", e.target.value)} />
          </Field>
          <Field label={p("Tempo no cargo", "Há quanto tempo está nessa função?")}>
            <Input value={d.tempoNoCargo} onChange={(e) => muda("tempoNoCargo", e.target.value)} />
          </Field>
        </div>
      </Secao>

      <Secao n={2} titulo="Visão geral da função" dica={p("Pergunte: como você descreveria o que você faz aqui em poucas palavras?", "Conte com as suas palavras.")}>
        <Field label={p("Resumo da função", "Como você descreveria o que você faz aqui, em poucas palavras?")}>{texto("resumo", 4)}</Field>
        <Field label="Qual é o seu principal entregável?">{texto("entregavel")}</Field>
        <Field label="Com quem você mais se relaciona no trabalho?">{texto("relacionamentos", 3)}</Field>
      </Secao>

      <Secao
        n={3}
        titulo="Processos e tarefas"
        dica={p("Pergunte: o que você faz logo quando chega? E todo dia, toda semana, todo mês? Uma tarefa por linha.", "O que você faz logo quando chega? E todo dia, toda semana, todo mês? Uma tarefa em cada linha, com a frequência e o quanto ela é importante.")}
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

      <Secao n={4} titulo="Passo a passo do processo principal" dica={p("Escolha com a pessoa o processo mais importante e peça que explique como se fosse ensinar alguém do zero.", "Escolha a tarefa mais importante e explique como se estivesse ensinando alguém que nunca fez.")}>
        <Field label={p("Nome do processo", "Qual é a tarefa mais importante?")}>
          <Input value={d.processoNome} onChange={(e) => muda("processoNome", e.target.value)} />
        </Field>
        <Field label={p("Exemplo real", "Conte um exemplo real de quando você fez")}>{texto("processoExemplo", 3)}</Field>
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

      <Secao n={5} titulo="Ferramentas, sistemas e acessos" dica={p("Todos os sistemas, aplicativos, planilhas ou equipamentos que a pessoa usa.", "Todos os sistemas, aplicativos, planilhas ou equipamentos que você usa.")}>
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

      <Secao n={6} titulo="Conhecimento crítico e informal" dica={p("O que não está escrito em lugar nenhum e se perderia se a pessoa saísse amanhã.", "O que você sabe e não está escrito em lugar nenhum.")}>
        <Field label="O que uma pessoa nova precisaria saber para te substituir por um dia?">{texto("substituir", 3)}</Field>
        <Field label="Tem algum contato externo que só você gerencia?">{texto("contatoExterno")}</Field>
        <Field label="Existe alguma regra não documentada que você aplica no dia a dia?">{texto("regraNaoEscrita")}</Field>
      </Secao>

      <Secao n={7} titulo="Gargalos, riscos e oportunidades de melhoria" dica={p("Pergunte: o que mais trava o seu trabalho? O que poderia ser diferente?", "O que mais trava o seu trabalho? O que poderia ser diferente?")}>
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

      <Secao n={8} titulo="Indicadores e metas do cargo" dica={p("Como a pessoa sabe se está indo bem, ou não.", "Como você sabe se está indo bem, ou não.")}>
        <Field label="Como você sabe que fez um bom trabalho hoje?">{texto("bomTrabalho")}</Field>
        <Field label="Existe alguma meta ou número que você acompanha?">{texto("metaAcompanhada")}</Field>
        <Field label="Como você mediria a qualidade do seu trabalho para alguém de fora?">{texto("qualidade")}</Field>
      </Secao>
    </>
  );
}
