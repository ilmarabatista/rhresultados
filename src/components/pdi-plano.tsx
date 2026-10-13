"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, Pencil, Trash2, X } from "lucide-react";
import {
  editarPlano,
  encerrarPlano,
  comentarAcao,
  excluirAcao,
  excluirMeta,
  excluirPlano,
  marcarAcao,
  salvarAcao,
  salvarMeta,
  type PdiState,
} from "@/app/(app)/empresas/[id]/pdi/actions";
import {
  checarSmart,
  DICA_DA_ACAO,
  distribuicao,
  execucaoDasAcoes,
  QUANTO_FEITO,
  ROTULO_DO_QUANTO,
  situacaoDaAcao,
  type SituacaoDaAcao,
  LETRAS_SMART,
  lerStatusDaMeta,
  lerTipoDeAcao,
  progressoDoPlano,
  ROTULO_DA_ACAO,
  ROTULO_DA_META,
  TIPOS_DE_ACAO,
  TOM_DA_META,
} from "@/lib/pdi";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";
import { Aviso, Etiqueta } from "./ui";

/**
 * O plano: cada meta SMART com as ações que levam a ela. Uma ação ligada a um
 * treinamento do catálogo se cumpre sozinha quando a pessoa está presente
 * numa turma realizada.
 */

export type AcaoDaTela = {
  id: string;
  title: string;
  tipo: string;
  responsavel: string;
  dueDate: string;
  prazo: string | null;
  done: boolean;
  /** 0, 25, 50, 75 ou 100. */
  quantoFeito: number;
  observacao: string;
  treinamentoId: string;
  treinamentoNome: string | null;
  /** Dia da turma realizada em que a pessoa esteve: a ação está cumprida. */
  feitoNaTurma: string | null;
};

export type MetaDaTela = {
  id: string;
  notaId: string;
  competencia: string;
  titulo: string;
  indicador: string;
  recursos: string;
  relevancia: string;
  prazo: string;
  prazoTexto: string | null;
  status: string;
  progresso: number;
  acoes: AcaoDaTela[];
};

export type PlanoDaTela = {
  id: string;
  title: string;
  objective: string;
  startDate: string;
  endDate: string;
  periodo: string | null;
  status: string;
  balanco: string;
  criadoEm: string;
  metas: MetaDaTela[];
  /** Ações dos planos antigos, de antes das metas. */
  acoesSoltas: { id: string; title: string; done: boolean }[];
};

const botaoClaro =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function Modal({ titulo, onClose, children }: { titulo: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-4 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-slate-900">{titulo}</h3>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-700" aria-label="Fechar">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function useFecharAoSalvar(state: PdiState, onClose: () => void) {
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);
}

function FormularioDoPlano({ plano, onClose }: { plano: PlanoDaTela; onClose: () => void }) {
  const [state, action] = useActionState<PdiState, FormData>(editarPlano, {});
  useFecharAoSalvar(state, onClose);
  return (
    <Modal titulo="Editar plano" onClose={onClose}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="planId" value={plano.id} />
        <Field label="Nome do plano *">
          <Input name="title" required defaultValue={plano.title} />
        </Field>
        <Field label="Objetivo geral">
          <Textarea name="objective" rows={3} defaultValue={plano.objective} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Início">
            <Input name="startDate" type="date" defaultValue={plano.startDate} />
          </Field>
          <Field label="Fim">
            <Input name="endDate" type="date" defaultValue={plano.endDate} />
          </Field>
        </div>
        <FormError message={state.error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={botaoClaro}>
            Cancelar
          </button>
          <SubmitButton>Salvar</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function FormularioDeMeta({
  plano,
  meta,
  gaps,
  onClose,
}: {
  plano: PlanoDaTela;
  meta: MetaDaTela | null;
  gaps: { id: string; nome: string; detalhe: string }[];
  onClose: () => void;
}) {
  const [state, action] = useActionState<PdiState, FormData>(salvarMeta, {});
  useFecharAoSalvar(state, onClose);
  const [campos, setCampos] = useState({
    titulo: meta?.titulo ?? "",
    indicador: meta?.indicador ?? "",
    recursos: meta?.recursos ?? "",
    relevancia: meta?.relevancia ?? "",
    prazo: meta?.prazo ?? plano.endDate,
  });
  const smart = checarSmart(campos);
  const muda = (k: keyof typeof campos) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setCampos((c) => ({ ...c, [k]: e.target.value }));

  const CAMPO: Record<string, { name: keyof typeof campos; exemplo: string; linhas?: number; tipo?: string }> = {
    S: { name: "titulo", exemplo: "Conduzir sozinha o fechamento mensal da folha", linhas: 2 },
    M: { name: "indicador", exemplo: "Fechamento de dezembro entregue até o dia 5, sem retrabalho apontado pelo contador", linhas: 2 },
    A: { name: "recursos", exemplo: "Curso de DP, 1h por semana com a líder, acesso ao sistema de folha", linhas: 2 },
    R: { name: "relevancia", exemplo: "É a principal entrega do cargo e o passo para assumir a coordenação", linhas: 2 },
    T: { name: "prazo", exemplo: "", tipo: "date" },
  };

  return (
    <Modal titulo={meta ? "Editar meta" : "Nova meta"} onClose={onClose}>
      <form action={action} className="space-y-3">
        <input type="hidden" name="planId" value={plano.id} />
        {meta ? <input type="hidden" name="metaId" value={meta.id} /> : null}

        <Field label="Competência (gap)" hint="O gap da avaliação que esta meta trabalha.">
          <Select name="notaId" defaultValue={meta?.notaId ?? ""}>
            <option value="">— nenhuma / outra —</option>
            {gaps.map((g) => (
              <option key={g.id} value={g.id}>
                {g.nome} {g.detalhe}
              </option>
            ))}
          </Select>
        </Field>
        {!meta?.notaId ? (
          <Field label="Ou escreva a competência">
            <Input name="competencia" defaultValue={meta?.competencia ?? ""} placeholder="Opcional" />
          </Field>
        ) : null}

        {LETRAS_SMART.map((l) => {
          const c = CAMPO[l.letra];
          const ok = smart[l.letra];
          return (
            <div key={l.letra} className="grid grid-cols-[2rem_minmax(0,1fr)] gap-2">
              <span
                className={`mt-6 flex h-7 w-7 items-center justify-center rounded-md text-sm font-bold ${
                  ok ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                }`}
                title={ok ? "ok" : "falta"}
              >
                {l.letra}
              </span>
              <Field label={`${l.nome}${l.letra === "S" ? " *" : ""}`} hint={l.dica}>
                {c.tipo === "date" ? (
                  <Input name={c.name} type="date" value={campos[c.name]} onChange={muda(c.name)} />
                ) : (
                  <Textarea
                    name={c.name}
                    rows={c.linhas}
                    value={campos[c.name]}
                    onChange={muda(c.name)}
                    placeholder={`Ex.: ${c.exemplo}`}
                    required={l.letra === "S"}
                  />
                )}
              </Field>
            </div>
          );
        })}

        <FormError message={state.error} />
        <div className="flex items-center justify-end gap-2">
          {!Object.values(smart).every(Boolean) ? (
            <span className="mr-auto text-[11px] text-amber-700">Dá para salvar e completar depois.</span>
          ) : null}
          <button type="button" onClick={onClose} className={botaoClaro}>
            Cancelar
          </button>
          <SubmitButton>{meta ? "Salvar meta" : "Criar meta"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function FormularioDeAcao({
  meta,
  acao,
  treinamentos,
  onClose,
}: {
  meta: MetaDaTela;
  acao: AcaoDaTela | null;
  treinamentos: { id: string; nome: string }[];
  onClose: () => void;
}) {
  const [state, action] = useActionState<PdiState, FormData>(salvarAcao, {});
  useFecharAoSalvar(state, onClose);
  const [tipo, setTipo] = useState(lerTipoDeAcao(acao?.tipo ?? "PRATICA"));
  const [treinamento, setTreinamento] = useState(acao?.treinamentoId ?? "");

  return (
    <form action={action} className="space-y-2.5 rounded-lg border border-brand-200 bg-brand-50/30 p-3">
      <input type="hidden" name="metaId" value={meta.id} />
      {acao ? <input type="hidden" name="acaoId" value={acao.id} /> : null}
      <Input
        name="title"
        required
        autoFocus
        defaultValue={acao?.title ?? ""}
        placeholder="O que vai ser feito. Ex.: Acompanhar a Ana em 3 fechamentos"
      />
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <Select name="tipo" value={treinamento ? "FORMAL" : tipo} onChange={(e) => setTipo(lerTipoDeAcao(e.target.value))} disabled={Boolean(treinamento)}>
          {TIPOS_DE_ACAO.map((t) => (
            <option key={t} value={t}>
              {ROTULO_DA_ACAO[t]}
            </option>
          ))}
        </Select>
        <Input name="responsavel" defaultValue={acao?.responsavel ?? ""} placeholder="Responsável (pessoa, líder, RH)" />
        <Input name="dueDate" type="date" defaultValue={acao?.dueDate || meta.prazo} aria-label="Prazo da ação" />
      </div>
      <p className="text-[11px] text-slate-400">{DICA_DA_ACAO[treinamento ? "FORMAL" : tipo]}</p>
      {treinamentos.length > 0 ? (
        <Select name="treinamentoId" value={treinamento} onChange={(e) => setTreinamento(e.target.value)}>
          <option value="">Sem treinamento do catálogo</option>
          {treinamentos.map((t) => (
            <option key={t.id} value={t.id}>
              Treinamento: {t.nome}
            </option>
          ))}
        </Select>
      ) : null}
      {treinamento ? (
        <p className="text-[11px] text-slate-500">
          A ação se cumpre sozinha quando a pessoa estiver presente numa turma realizada deste treinamento.
        </p>
      ) : null}
      <FormError message={state.error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onClose} className={botaoClaro}>
          Cancelar
        </button>
        <SubmitButton>{acao ? "Salvar" : "Incluir ação"}</SubmitButton>
      </div>
    </form>
  );
}

const PRAZO_DA_ACAO: Record<SituacaoDaAcao, { cor: string; texto: (prazo: string | null) => string }> = {
  FEITA: { cor: "text-emerald-600", texto: () => "feito" },
  ATRASADA: { cor: "text-red-600", texto: (p) => `atrasado · era até ${p}` },
  HOJE: { cor: "text-amber-700", texto: () => "é hoje" },
  NO_PRAZO: { cor: "text-slate-500", texto: (p) => `até ${p}` },
  SEM_DATA: { cor: "text-amber-700", texto: () => "sem data — combine um prazo" },
};

const COR_DO_QUANTO: Record<number, string> = {
  0: "bg-slate-500 text-white",
  25: "bg-amber-400 text-white",
  50: "bg-amber-500 text-white",
  75: "bg-sky-500 text-white",
  100: "bg-emerald-600 text-white",
};

/** Como foi a ação, escrito na própria linha. */
function ComoFoi({ acao, aberto }: { acao: AcaoDaTela; aberto: boolean }) {
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(acao.observacao);
  if (!editando) {
    if (!acao.observacao && !aberto) return null;
    return (
      <button
        type="button"
        disabled={!aberto}
        onClick={() => setEditando(true)}
        className={`block text-left text-[11px] ${acao.observacao ? "text-slate-600" : "text-slate-400 hover:text-brand-700"}`}
      >
        {acao.observacao ? `Como foi: ${acao.observacao}` : "+ como foi"}
      </button>
    );
  }
  return (
    <textarea
      autoFocus
      rows={2}
      value={texto}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={async () => {
        setEditando(false);
        if (texto !== acao.observacao) {
          const r = await comentarAcao(acao.id, texto);
          if (r.error) alert(r.error);
        }
      }}
      placeholder="O que foi feito, o que faltou, o que se aprendeu"
      className="mt-1 w-full rounded-md border border-brand-300 px-2 py-1 text-[12px] outline-none"
    />
  );
}

/**
 * Cada ação é um combinado: responsável, prazo e cobrança. O quadradinho
 * marca feito de uma vez; a escala ao lado diz o quanto foi feito.
 */
function Acoes({
  meta,
  treinamentos,
  aberto,
  hoje,
}: {
  meta: MetaDaTela;
  treinamentos: { id: string; nome: string }[];
  aberto: boolean;
  hoje: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<AcaoDaTela | null | false>(false);
  const [acoes, setAcoes] = useState(meta.acoes);
  useEffect(() => setAcoes(meta.acoes), [meta.acoes]);

  function marcar(a: AcaoDaTela, quanto: number) {
    setAcoes((atual) => atual.map((x) => (x.id === a.id ? { ...x, quantoFeito: quanto, done: quanto === 100 } : x)));
    startTransition(async () => {
      const r = await marcarAcao(a.id, quanto);
      if (r.error) alert(r.error);
    });
  }

  return (
    <div className={pending ? "opacity-60" : ""}>
      {acoes.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhuma ação ainda. Toda meta precisa de pelo menos uma.</p>
      ) : (
        <ul className="space-y-1">
          {acoes.map((a) => {
            if (editando && editando.id === a.id) {
              return (
                <li key={a.id}>
                  <FormularioDeAcao meta={meta} acao={a} treinamentos={treinamentos} onClose={() => setEditando(false)} />
                </li>
              );
            }
            const quanto = a.feitoNaTurma ? 100 : a.quantoFeito;
            const situacao = situacaoDaAcao({ quantoFeito: quanto, prazo: a.dueDate || null }, hoje);
            const travada = !aberto || Boolean(a.feitoNaTurma);
            return (
              <li key={a.id} className="group flex flex-wrap items-start gap-2 rounded px-1 py-1 transition hover:bg-slate-50">
                <button
                  type="button"
                  disabled={travada}
                  onClick={() => marcar(a, quanto === 100 ? 0 : 100)}
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                    quanto === 100 ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400 hover:border-emerald-500"
                  }`}
                  aria-label={quanto === 100 ? "Reabrir a ação" : "Marcar a ação como feita"}
                >
                  {quanto === 100 ? <Check size={11} strokeWidth={3} /> : null}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`text-[13px] leading-snug ${quanto === 100 ? "text-slate-400 line-through" : "text-slate-700"}`}>
                    {a.title}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-2 text-[11px]">
                    <span className="text-slate-600">{a.responsavel || "sem responsável"}</span>
                    <span className={PRAZO_DA_ACAO[situacao].cor}>{PRAZO_DA_ACAO[situacao].texto(a.prazo)}</span>
                    <span className="text-slate-400">{ROTULO_DA_ACAO[lerTipoDeAcao(a.tipo)]}</span>
                    {a.treinamentoNome ? (
                      <span className={a.feitoNaTurma ? "text-emerald-700" : "text-slate-500"}>
                        {a.feitoNaTurma ? `feito na turma de ${a.feitoNaTurma}` : `treinamento: ${a.treinamentoNome}`}
                      </span>
                    ) : null}
                  </p>
                  <ComoFoi acao={a} aberto={aberto} />
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div
                    className="flex overflow-hidden rounded-md border border-slate-200"
                    role="radiogroup"
                    aria-label={`Quanto foi feito: ${a.title}`}
                  >
                    {QUANTO_FEITO.map((q) => (
                      <button
                        key={q}
                        type="button"
                        role="radio"
                        aria-checked={quanto === q}
                        disabled={travada}
                        title={ROTULO_DO_QUANTO[q]}
                        onClick={() => marcar(a, q)}
                        className={`w-9 border-l border-slate-200 py-0.5 text-[10px] tabular-nums transition first:border-l-0 ${
                          quanto === q ? `${COR_DO_QUANTO[q]} font-semibold` : "bg-white text-slate-400 hover:bg-slate-100"
                        }`}
                      >
                        {q}%
                      </button>
                    ))}
                  </div>
                  {aberto ? (
                    <span className="flex gap-1 text-slate-300 transition sm:opacity-0 sm:group-hover:opacity-100">
                      <button type="button" onClick={() => setEditando(a)} className="hover:text-brand-700" aria-label="Editar ação">
                        <Pencil size={12} />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (confirm("Excluir esta ação?")) startTransition(async () => void (await excluirAcao(a.id)));
                        }}
                        className="hover:text-red-600"
                        aria-label="Excluir ação"
                      >
                        <Trash2 size={12} />
                      </button>
                    </span>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {aberto ? (
        editando === null ? (
          <div className="mt-2">
            <FormularioDeAcao meta={meta} acao={null} treinamentos={treinamentos} onClose={() => setEditando(false)} />
          </div>
        ) : (
          <button type="button" onClick={() => setEditando(null)} className="mt-1.5 text-xs text-brand-700 hover:text-brand-800">
            + Ação (combinado)
          </button>
        )
      ) : null}
    </div>
  );
}

function CartaoDaMeta({
  meta,
  numero,
  aberto,
  treinamentos,
  onEditar,
  hoje,
}: {
  meta: MetaDaTela;
  numero: number;
  aberto: boolean;
  treinamentos: { id: string; nome: string }[];
  onEditar: () => void;
  hoje: string;
}) {
  const [pending, startTransition] = useTransition();
  const smart = checarSmart({ ...meta, prazo: meta.prazo || null });
  const status = lerStatusDaMeta(meta.status);
  const progresso = status === "ATINGIDA" ? 100 : meta.progresso;
  const execucao = execucaoDasAcoes(meta.acoes.map((a) => ({ quantoFeito: a.feitoNaTurma ? 100 : a.quantoFeito })));

  return (
    <article className={`rounded-lg border border-slate-200 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-start gap-3 border-b border-slate-100 p-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-900 text-xs font-semibold text-white">
          {numero}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {meta.competencia ? <Etiqueta tom="azul">{meta.competencia}</Etiqueta> : null}
            <Etiqueta tom={TOM_DA_META[status]}>{ROTULO_DA_META[status]}</Etiqueta>
            <span className="flex gap-0.5" title="Checagem SMART">
              {LETRAS_SMART.map((l) => (
                <span
                  key={l.letra}
                  title={`${l.nome}: ${smart[l.letra] ? "ok" : "falta"}`}
                  className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold ${
                    smart[l.letra] ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {l.letra}
                </span>
              ))}
            </span>
          </div>
          <h4 className="mt-1 text-sm font-semibold leading-snug text-slate-900">{meta.titulo}</h4>
          <dl className="mt-1.5 grid gap-x-4 gap-y-1 text-[12px] leading-snug sm:grid-cols-2">
            {[
              ["Como medir", meta.indicador],
              ["Apoio e recursos", meta.recursos],
              ["Por que importa", meta.relevancia],
              ["Prazo", meta.prazoTexto],
            ].map(([rotulo, valor]) => (
              <div key={rotulo}>
                <dt className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{rotulo}</dt>
                <dd className={valor ? "text-slate-600" : "text-amber-700"}>{valor || "a definir"}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="w-28 shrink-0 text-right">
          <span className="text-lg font-semibold tabular-nums text-brand-800">{progresso}%</span>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${progresso}%` }} />
          </div>
          <span className="mt-0.5 block text-[10px] text-slate-400">meta, na última conversa</span>
          {execucao != null ? <span className="block text-[10px] text-slate-500">ações: {execucao}% feito</span> : null}
          {aberto ? (
            <div className="mt-2 flex justify-end gap-1.5 text-slate-400">
              <button type="button" onClick={onEditar} className="hover:text-brand-700" aria-label="Editar meta">
                <Pencil size={13} />
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Excluir a meta e as ${meta.acoes.length} ação(ões) dela?`))
                    startTransition(async () => void (await excluirMeta(meta.id)));
                }}
                className="hover:text-red-600"
                aria-label="Excluir meta"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ) : null}
        </div>
      </div>
      <div className="p-3">
        <Acoes meta={meta} treinamentos={treinamentos} aberto={aberto} hoje={hoje} />
      </div>
    </article>
  );
}

function Encerrar({ plano, onClose }: { plano: PlanoDaTela; onClose: () => void }) {
  const [pending, startTransition] = useTransition();
  const [balanco, setBalanco] = useState(plano.balanco);
  const [status, setStatus] = useState<"CONCLUIDO" | "CANCELADO">("CONCLUIDO");
  return (
    <Modal titulo="Encerrar o plano" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Como terminou">
          <Select value={status} onChange={(e) => setStatus(e.target.value as "CONCLUIDO" | "CANCELADO")}>
            <option value="CONCLUIDO">Concluído</option>
            <option value="CANCELADO">Cancelado</option>
          </Select>
        </Field>
        <Field label="Balanço" hint="O que mudou, o que ficou para o próximo plano. Uma nova avaliação mostra quanto os gaps fecharam.">
          <Textarea rows={5} value={balanco} onChange={(e) => setBalanco(e.target.value)} />
        </Field>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={botaoClaro}>
            Cancelar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await encerrarPlano(plano.id, status, balanco);
                if (r.error) alert(r.error);
                else onClose();
              })
            }
            className="rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Encerrar plano
          </button>
        </div>
      </div>
    </Modal>
  );
}

export default function PdiPlano({
  planos,
  escolhido,
  gaps,
  treinamentos,
  hoje,
}: {
  planos: PlanoDaTela[];
  escolhido: string | null;
  gaps: { id: string; nome: string; detalhe: string }[];
  treinamentos: { id: string; nome: string }[];
  hoje: string;
}) {
  const [pending, startTransition] = useTransition();
  const [editandoPlano, setEditandoPlano] = useState(false);
  const [meta, setMeta] = useState<MetaDaTela | null | false>(false);
  const [encerrando, setEncerrando] = useState(false);

  const plano =
    planos.find((p) => p.id === escolhido) ?? planos.find((p) => p.status === "EM_ANDAMENTO") ?? planos[0] ?? null;
  const aberto = plano?.status === "EM_ANDAMENTO";
  const todasAcoes = plano ? plano.metas.flatMap((m) => m.acoes) : [];
  const dist = distribuicao(todasAcoes);
  const progresso = plano ? progressoDoPlano(plano.metas) : null;
  const metasSemAcao = plano ? plano.metas.filter((m) => m.acoes.length === 0).length : 0;
  const metasIncompletas = plano
    ? plano.metas.filter((m) => !Object.values(checarSmart({ ...m, prazo: m.prazo || null })).every(Boolean)).length
    : 0;

  return (
    <section id="plano" className={`rounded-lg border border-slate-200 bg-white p-4 ${pending ? "opacity-60" : ""}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            <span className="mr-1.5 text-brand-600">3</span>Plano e metas SMART
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Cada meta precisa ser específica, mensurável, atingível, relevante e ter prazo — as letras ficam verdes
            quando estão preenchidas. As ações seguem o 70-20-10: a maior parte aprendendo na prática.
          </p>
        </div>
        {planos.length > 1 ? (
          <div className="flex flex-wrap gap-1.5">
            {planos.map((p) => (
              <Link
                key={p.id}
                href={`?plano=${p.id}#plano`}
                scroll={false}
                className={`rounded-full border px-2.5 py-0.5 text-xs ${
                  p.id === plano?.id ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 text-slate-600 hover:border-brand-300"
                }`}
              >
                {p.title}
                {p.status !== "EM_ANDAMENTO" ? ` · ${p.status === "CONCLUIDO" ? "concluído" : "cancelado"}` : ""}
              </Link>
            ))}
          </div>
        ) : null}
      </div>

      {!plano ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Nenhum plano ainda. Termine a avaliação e clique em “Montar o PDI com estes gaps”.
        </p>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-semibold text-slate-900">{plano.title}</h3>
                {plano.objective ? <p className="mt-0.5 text-sm text-slate-600">{plano.objective}</p> : null}
                <p className="mt-1 text-[11px] text-slate-400">
                  {plano.periodo ?? `criado em ${plano.criadoEm}`}
                  {plano.status !== "EM_ANDAMENTO" ? ` · ${plano.status === "CONCLUIDO" ? "concluído" : "cancelado"}` : ""}
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {aberto ? (
                  <>
                    <button type="button" onClick={() => setEditandoPlano(true)} className={botaoClaro}>
                      Editar
                    </button>
                    <button type="button" onClick={() => setEncerrando(true)} className={botaoClaro}>
                      Encerrar
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      startTransition(async () => {
                        const r = await encerrarPlano(plano.id, "EM_ANDAMENTO", "");
                        if (r.error) alert(r.error);
                      })
                    }
                    className={botaoClaro}
                  >
                    Reabrir
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    if (confirm(`Excluir o PDI "${plano.title}", com metas, ações e conversas? Não há como desfazer.`))
                      startTransition(async () => void (await excluirPlano(plano.id)));
                  }}
                  className="text-slate-400 hover:text-red-600"
                  aria-label="Excluir plano"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
              <div>
                <div className="flex items-baseline justify-between text-[11px] text-slate-500">
                  <span>Progresso do plano</span>
                  <span className="tabular-nums">{progresso ?? 0}%</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-white">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progresso ?? 0}%` }} />
                </div>
              </div>
              {todasAcoes.length > 0 ? (
                <div>
                  <span className="text-[11px] text-slate-500">
                    Ações: prática {dist.PRATICA}% · troca {dist.TROCA}% · formal {dist.FORMAL}%
                  </span>
                  <div className="mt-1 flex h-2 overflow-hidden rounded-full bg-white">
                    <div className="bg-brand-600" style={{ width: `${dist.PRATICA}%` }} />
                    <div className="bg-slate-400" style={{ width: `${dist.TROCA}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${dist.FORMAL}%` }} />
                  </div>
                </div>
              ) : null}
            </div>
            {plano.balanco && !aberto ? (
              <p className="mt-3 whitespace-pre-wrap rounded-md bg-white px-3 py-2 text-sm text-slate-600">
                <span className="mr-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Balanço</span>
                {plano.balanco}
              </p>
            ) : null}
          </div>

          {aberto && (metasSemAcao > 0 || metasIncompletas > 0) ? (
            <Aviso rotulo="Para o plano ficar de pé">
              {[
                metasIncompletas > 0 ? `${metasIncompletas} meta(s) com letras do SMART a completar` : null,
                metasSemAcao > 0 ? `${metasSemAcao} meta(s) sem ação` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
              .
            </Aviso>
          ) : null}
          {aberto && todasAcoes.length >= 3 && dist.FORMAL > 50 ? (
            <Aviso rotulo="70-20-10" tom="informacao">
              Mais da metade das ações é curso ou treinamento. O desenvolvimento acontece mais na prática: inclua
              desafios do dia a dia e momentos com um mentor.
            </Aviso>
          ) : null}

          {plano.metas.map((m, i) => (
            <CartaoDaMeta
              key={m.id}
              meta={m}
              numero={i + 1}
              aberto={aberto}
              treinamentos={treinamentos}
              onEditar={() => setMeta(m)}
              hoje={hoje}
            />
          ))}

          {plano.acoesSoltas.length > 0 ? (
            <div className="rounded-lg border border-slate-200 p-3">
              <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Ações sem meta</h4>
              <ul className="space-y-1">
                {plano.acoesSoltas.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-[13px] text-slate-700">
                    <input
                      type="checkbox"
                      defaultChecked={a.done}
                      disabled={!aberto}
                      onChange={(e) => startTransition(async () => void (await marcarAcao(a.id, e.target.checked ? 100 : 0)))}
                      className="h-4 w-4 accent-brand-600"
                    />
                    <span className={a.done ? "text-slate-400 line-through" : ""}>{a.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {aberto ? (
            <button type="button" onClick={() => setMeta(null)} className={botaoClaro}>
              + Meta
            </button>
          ) : null}
        </div>
      )}

      {plano && editandoPlano ? <FormularioDoPlano plano={plano} onClose={() => setEditandoPlano(false)} /> : null}
      {plano && meta !== false ? (
        <FormularioDeMeta plano={plano} meta={meta} gaps={gaps} onClose={() => setMeta(false)} />
      ) : null}
      {plano && encerrando ? <Encerrar plano={plano} onClose={() => setEncerrando(false)} /> : null}
    </section>
  );
}
