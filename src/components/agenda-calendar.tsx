"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { mandarParaReuniao } from "@/app/(app)/empresas/[id]/reunioes/actions";
import { useActionState, useEffect, useState, useTransition } from "react";
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  X,
} from "lucide-react";
import {
  colunasDoDia,
  DIAS_SEMANA,
  FREQUENCIAS,
  MAXIMO_DE_REPETICOES,
  rotuloDaFrequencia,
  diasDaSemana,
  faixaHoraria,
  faixaNaGrade,
  fimDaHora,
  gradeDoMes,
  horasDaGrade,
  mesKey,
  mesVizinho,
  nomeDoMes,
  rotuloDaSemana,
  rotuloDoDia,
  semanaVizinha,
} from "@/lib/agenda";
import { rotuloDoTipo as rotuloDoExame } from "@/lib/exames";
import {
  acrescentarAssunto,
  agendarBriefing,
  agendarRapido,
  alternarAssunto,
  atualizarVisita,
  excluirAssunto,
  excluirSerie,
  criarVisita,
  excluirVisita,
  mudarStatusVisita,
  type AgendaState,
} from "@/app/(app)/agenda/actions";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";

export type VisitaItem = {
  id: string;
  /** "AAAA-MM-DD". */
  dia: string;
  startTime: string;
  endTime: string | null;
  /** BRIEFING, ACOMPANHAMENTO, ENTREGA ou OUTRO. */
  tipo: string;
  subject: string | null;
  location: string | null;
  notes: string | null;
  status: string;
  companyId: string;
  empresa: string;
  /** O produto do catálogo trabalhado no dia. */
  serviceId: string | null;
  servico: string | null;
  consultantId: string | null;
  consultor: string | null;
  /** Id da série, quando a reunião se repete. */
  seriesId: string | null;
  frequencia: string | null;
  /** Posição desta ocorrência dentro da série: "3 de 8". */
  naSerie: { posicao: number; total: number } | null;
  pauta: { id: string; titulo: string; feito: boolean }[];
  /** A reunião (pauta e ata) que nasceu deste compromisso, quando já nasceu. */
  reuniaoId: string | null;
};

/** Exame ocupacional marcado, mostrado na agenda em leitura. */
export type ExameNaAgenda = {
  id: string;
  dia: string;
  hora: string | null;
  tipo: string;
  pessoa: string;
  clinica: string | null;
  empresa: string;
  companyId: string;
  employeeId: string | null;
};

export type EmpresaOpcao = { id: string; nome: string };
export type ProdutoOpcao = { id: string; nome: string };

/** O briefing abre o processo comercial, e por isso salta à vista. */
const CHIP_BRIEFING =
  "border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200";

const STATUS_CHIP: Record<string, string> = {
  AGENDADA: "border-brand-200 bg-brand-50 text-brand-800 hover:bg-brand-100",
  REALIZADA:
    "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  CANCELADA:
    "border-slate-200 bg-slate-50 text-slate-400 line-through hover:bg-slate-100",
};

const STATUS_LABEL: Record<string, string> = {
  AGENDADA: "agendado",
  REALIZADA: "realizado",
  CANCELADA: "cancelado",
};

/** A ficha do cliente abre na primeira aba. */
function fichaDe(companyId: string) {
  return `/empresas/${companyId}/dados`;
}

// ------------------------------------------------------------- formulário

function VisitaForm({
  visita,
  diaInicial,
  horaInicial,
  fimInicial,
  empresas,
  produtos,
  consultores,
  empresaFixa,
  aoConcluir,
}: {
  visita: VisitaItem | null;
  diaInicial: string;
  /** Hora clicada na grade da semana, quando veio de lá. */
  horaInicial?: string;
  fimInicial?: string;
  empresas: EmpresaOpcao[];
  produtos: ProdutoOpcao[];
  consultores: { id: string; nome: string }[];
  empresaFixa?: string | null;
  aoConcluir: () => void;
}) {
  const editando = visita !== null;
  const [state, action] = useActionState<AgendaState, FormData>(
    editando ? atualizarVisita : criarVisita,
    {},
  );

  const [companyId, setCompanyId] = useState(
    visita?.companyId ?? empresaFixa ?? "",
  );
  const [frequencia, setFrequencia] = useState("NENHUMA");
  // O produto já gravado aparece mesmo que tenha sido desativado no catálogo.
  const opcoesDeProduto =
    visita?.serviceId && !produtos.some((p) => p.id === visita.serviceId)
      ? [...produtos, { id: visita.serviceId, nome: visita.servico ?? "produto desativado" }]
      : produtos;

  useEffect(() => {
    if (state.ok) aoConcluir();
  }, [state.ok, aoConcluir]);

  return (
    <form action={action} className="space-y-4">
      {editando ? <input type="hidden" name="id" value={visita.id} /> : null}

      {empresaFixa ? (
        <input type="hidden" name="companyId" value={empresaFixa} />
      ) : (
        <Field label="Empresa">
          <Select
            name="companyId"
            required
            value={companyId}
            onChange={(e) => setCompanyId(e.target.value)}
          >
            <option value="">Escolha o cliente…</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </Field>
      )}

      <Field label="Produto do dia" hint="O que você vai trabalhar nesse dia, do catálogo. Opcional.">
        <Select name="serviceId" defaultValue={visita?.serviceId ?? ""}>
          <option value="">Sem produto definido</option>
          {opcoesDeProduto.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data">
          <Input
            type="date"
            name="date"
            required
            defaultValue={visita?.dia ?? diaInicial}
          />
        </Field>
        <Field label="Início">
          <Input
            type="time"
            name="startTime"
            required
            defaultValue={visita?.startTime ?? horaInicial ?? "09:00"}
          />
        </Field>
        <Field label="Término" hint="Opcional.">
          <Input
            type="time"
            name="endTime"
            defaultValue={visita?.endTime ?? fimInicial ?? ""}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Assunto" hint="Quando o produto não descreve o dia.">
          <Input
            name="subject"
            defaultValue={visita?.subject ?? ""}
            placeholder="Ex.: feedback com as lideranças"
          />
        </Field>
        <Field label="Local" hint="Filial, endereço ou “online”.">
          <Input
            name="location"
            defaultValue={visita?.location ?? ""}
            placeholder="Ex.: matriz"
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Quem vai">
          <Select name="consultantId" defaultValue={visita?.consultantId ?? ""}>
            <option value="">Não definido</option>
            {consultores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Situação">
          <Select name="status" defaultValue={visita?.status ?? "AGENDADA"}>
            <option value="AGENDADA">Agendado</option>
            <option value="REALIZADA">Realizado</option>
            <option value="CANCELADA">Cancelado</option>
          </Select>
        </Field>
      </div>

      <Field label="Observações">
        <Textarea name="notes" rows={2} defaultValue={visita?.notes ?? ""} />
      </Field>

      {editando ? null : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Repetir">
              <Select
                name="frequencia"
                value={frequencia}
                onChange={(e) => setFrequencia(e.target.value)}
              >
                <option value="NENHUMA">Não repete</option>
                {FREQUENCIAS.map((f) => (
                  <option key={f.valor} value={f.valor}>
                    {f.label}
                  </option>
                ))}
              </Select>
            </Field>

            {frequencia === "NENHUMA" ? null : (
              <Field label="Quantas vezes" hint={`Até ${MAXIMO_DE_REPETICOES}.`}>
                <Input
                  name="vezes"
                  type="number"
                  min={2}
                  max={MAXIMO_DE_REPETICOES}
                  defaultValue={8}
                />
              </Field>
            )}
          </div>

          <Field
            label="Pauta"
            hint="Um assunto por linha. Vale para todas as reuniões da série, e dá para acrescentar depois."
          >
            <Textarea
              name="pauta"
              rows={3}
              placeholder={"Retorno do diagnóstico\nAndamento das contratações\nDúvidas da liderança"}
            />
          </Field>
        </>
      )}

      <FormError message={state.error} />

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Salvando…">
          {editando ? "Salvar alterações" : "Agendar"}
        </SubmitButton>
        <button
          type="button"
          onClick={aoConcluir}
          className="text-sm text-slate-500 transition hover:text-slate-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}

function Modal({
  titulo,
  aoFechar,
  children,
}: {
  titulo: string;
  aoFechar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:p-8">
      <div className="w-full max-w-2xl rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 className="text-sm font-semibold text-slate-900">{titulo}</h2>
          <button
            type="button"
            onClick={aoFechar}
            className="text-slate-400 transition hover:text-slate-700"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}


/**
 * A pauta de uma reunião.
 *
 * Os assuntos ficam combinados desde o agendamento e são marcados durante a
 * conversa.
 */
function Pauta({ visita }: { visita: VisitaItem }) {
  const [novo, setNovo] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const feitos = visita.pauta.filter((a) => a.feito).length;

  return (
    <div className={`mt-2 ${pending ? "opacity-60" : ""}`}>
      {visita.pauta.length > 0 ? (
        <p className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">
          pauta · {feitos} de {visita.pauta.length}
        </p>
      ) : null}

      <ul className="space-y-0.5">
        {visita.pauta.map((a) => (
          <li key={a.id} className="group/assunto flex items-start gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  void alternarAssunto(a.id);
                })
              }
              aria-label={`${a.feito ? "Desmarcar" : "Marcar"} "${a.titulo}"`}
              className={`mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${
                a.feito
                  ? "border-emerald-500 bg-emerald-500 text-white"
                  : "border-slate-300 hover:border-brand-500"
              }`}
            >
              {a.feito ? <Check size={9} strokeWidth={3} /> : null}
            </button>

            <span
              className={`min-w-0 flex-1 text-xs ${
                a.feito ? "text-slate-400 line-through" : "text-slate-600"
              }`}
            >
              {a.titulo}
            </span>

            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  void excluirAssunto(a.id);
                })
              }
              aria-label={`Excluir "${a.titulo}"`}
              className="shrink-0 text-slate-200 opacity-0 transition hover:text-red-600 focus:opacity-100 group-hover/assunto:opacity-100"
            >
              <X size={11} />
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const titulo = novo;
          setNovo("");
          startTransition(async () => {
            const r = await acrescentarAssunto(visita.id, titulo);
            if (r.error) setErro(r.error);
            else setErro(undefined);
          });
        }}
        className="mt-1 flex items-center gap-1.5"
      >
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="+ assunto"
          aria-label="Acrescentar assunto à pauta"
          className="w-full rounded px-1 py-0.5 text-xs outline-none transition placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-brand-300"
        />
      </form>

      {erro ? <p className="text-[11px] text-red-700">{erro}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------ chip do exame

/**
 * Exame ocupacional na agenda, em leitura.
 *
 * Ele é marcado na ficha do colaborador, e não aqui — mas ocupa o dia de
 * alguém, então precisa aparecer junto do resto. Clicar leva para onde ele é
 * editado.
 */
function ChipExame({ exame }: { exame: ExameNaAgenda }) {
  return (
    <Link
      href={
        exame.employeeId
          ? `/empresas/${exame.companyId}/equipe/${exame.employeeId}`
          : `/empresas/${exame.companyId}/equipe`
      }
      title={`${exame.hora ?? ""} Exame ${rotuloDoExame(exame.tipo).toLowerCase()} · ${
        exame.pessoa
      }${exame.clinica ? ` · ${exame.clinica}` : ""} — abrir a ficha`}
      className="block rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1 text-left text-[11px] leading-tight text-sky-800 transition hover:bg-sky-100"
    >
      <span className="block truncate font-medium">
        {exame.hora ? `${exame.hora} ` : ""}
        {exame.pessoa}
      </span>
      <span className="block truncate opacity-70">
        exame {rotuloDoExame(exame.tipo).toLowerCase()}
      </span>
    </Link>
  );
}

// ------------------------------------------------------------------ chip

function Chip({
  visita,
  aoEditar,
}: {
  visita: VisitaItem;
  aoEditar: (v: VisitaItem) => void;
}) {
  return (
    <div className="group relative">
      <Link
        href={fichaDe(visita.companyId)}
        title={`${faixaHoraria(visita.startTime, visita.endTime)} · ${
          visita.empresa
        }${visita.servico ? ` · ${visita.servico}` : ""} — abrir a ficha`}
        className={`block rounded-md border px-1.5 py-1 pr-5 text-left text-[11px] leading-tight transition ${
          visita.tipo === "BRIEFING" && visita.status === "AGENDADA"
            ? CHIP_BRIEFING
            : (STATUS_CHIP[visita.status] ?? STATUS_CHIP.AGENDADA)
        }`}
      >
        <span className="block truncate font-medium">
          {visita.startTime} {visita.empresa}
        </span>
        {visita.tipo === "BRIEFING" ? (
          <span className="block truncate text-[10px] font-medium uppercase tracking-wide opacity-80">
            briefing
          </span>
        ) : null}
        {visita.servico || visita.subject ? (
          <span className="block truncate opacity-70">
            {visita.servico ?? visita.subject}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={() => aoEditar(visita)}
        className="absolute right-0.5 top-0.5 rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
        aria-label={`Editar o agendamento de ${visita.empresa}`}
      >
        <Pencil size={11} />
      </button>
    </div>
  );
}

// ----------------------------------------------------- escolha rápida

/**
 * O que abre ao clicar numa hora da grade: a lista de empresas.
 *
 * Um clique na empresa já marca a hora cheia. O produto do dia é opcional e
 * fica escolhido no alto, antes do clique — nem todo compromisso é de um
 * produto só.
 */
function EscolhaRapida({
  dia,
  hora,
  empresas,
  produtos,
  aoConcluir,
  aoAbrirFormulario,
}: {
  dia: string;
  hora: string;
  empresas: EmpresaOpcao[];
  produtos: ProdutoOpcao[];
  aoConcluir: () => void;
  aoAbrirFormulario: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [produto, setProduto] = useState("");
  const [erro, setErro] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const fim = fimDaHora(hora);

  const agendar = (companyId: string) => {
    setErro(undefined);
    startTransition(async () => {
      const r = await agendarRapido(companyId, produto || null, dia, hora);
      if (r.error) setErro(r.error);
      else aoConcluir();
    });
  };

  const filtradas = empresas.filter((e) =>
    e.nome.toLowerCase().includes(busca.trim().toLowerCase()),
  );

  const itemClass =
    "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/60 disabled:opacity-60";

  return (
    <div className={pending ? "opacity-60" : ""}>
      <p className="mb-3 text-xs text-slate-500">
        <span className="first-letter:uppercase">{rotuloDoDia(dia)}</span> ·{" "}
        <span className="font-medium text-slate-700">
          {faixaHoraria(hora, fim)}
        </span>
      </p>

      <label className="mb-2 block text-xs text-slate-500">
        Produto do dia (opcional)
        <select
          value={produto}
          onChange={(e) => setProduto(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        >
          <option value="">Sem produto definido</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nome}
            </option>
          ))}
        </select>
      </label>

      {empresas.length > 6 ? (
        <input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar empresa…"
          aria-label="Buscar empresa"
          className="mb-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
        />
      ) : null}

      {filtradas.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">
          Nenhuma empresa encontrada.
        </p>
      ) : (
        <div className="scroll-thin max-h-72 space-y-1.5 overflow-y-auto pr-1">
          {filtradas.map((e) => (
            <button
              key={e.id}
              type="button"
              disabled={pending}
              onClick={() => agendar(e.id)}
              className={itemClass}
            >
              <span className="min-w-0 truncate">{e.nome}</span>
            </button>
          ))}
        </div>
      )}

      <FormError message={erro} />

      <button
        type="button"
        onClick={aoAbrirFormulario}
        className="mt-3 text-xs text-brand-700 transition hover:text-brand-800"
      >
        Preencher tudo (local, quem vai, observações)
      </button>
    </div>
  );
}

// ------------------------------------------------- abertura comercial

/**
 * Cliente novo entrando pela agenda.
 *
 * A primeira reunião é de briefing e fechamento, e nela a empresa ainda não é
 * cliente — então ela é criada aqui, com o mínimo que se sabe antes da
 * conversa. O resto é preenchido na ficha, durante a reunião.
 */
function BriefingForm({
  dia,
  consultores,
  aoConcluir,
}: {
  dia: string;
  consultores: { id: string; nome: string }[];
  aoConcluir: () => void;
}) {
  const [state, action] = useActionState<AgendaState, FormData>(
    agendarBriefing,
    {},
  );

  useEffect(() => {
    if (state.ok) aoConcluir();
  }, [state.ok, aoConcluir]);

  return (
    <form action={action} className="space-y-4">
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
        A empresa entra como <strong>prospecto</strong> e a ficha dela já fica
        pronta. Clicar no compromisso na agenda abre essa ficha — é lá que o
        briefing é digitado, durante a reunião.
      </p>

      <Field label="Nome da empresa *">
        <Input name="nome" required autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ramo / nicho">
          <Input name="industry" placeholder="Ex.: indústria de alimentos" />
        </Field>
        <Field label="Quantidade de funcionários">
          <Input name="employeeCount" type="number" min={1} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Quem é o contato">
          <Input name="contactName" />
        </Field>
        <Field label="Telefone">
          <Input name="contactPhone" />
        </Field>
        <Field label="E-mail">
          <Input name="contactEmail" type="email" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Data da reunião">
          <Input type="date" name="date" required defaultValue={dia} />
        </Field>
        <Field label="Início">
          <Input type="time" name="startTime" required defaultValue="09:00" />
        </Field>
        <Field label="Término" hint="Opcional.">
          <Input type="time" name="endTime" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Local" hint="Endereço, unidade ou “online”.">
          <Input name="location" />
        </Field>
        <Field label="Quem vai">
          <Select name="consultantId" defaultValue="">
            <option value="">Não definido</option>
            {consultores.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field
        label="Assunto"
        hint="Deixe em branco para “Briefing e fechamento”."
      >
        <Input name="subject" />
      </Field>

      <Field label="Observações">
        <Textarea name="notes" rows={2} />
      </Field>

      <FormError message={state.error} />

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Abrindo…">
          Abrir cliente e agendar
        </SubmitButton>
        <button
          type="button"
          onClick={aoConcluir}
          className="text-sm text-slate-500 transition hover:text-slate-800"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}


// ------------------------------------------------------------ grade do mês

function MesGrade({
  ano,
  mes,
  porDia,
  examesPorDia,
  hoje,
  abrirNovo,
  abrirEdicao,
}: {
  ano: number;
  mes: number;
  porDia: Map<string, VisitaItem[]>;
  examesPorDia: Map<string, ExameNaAgenda[]>;
  hoje: string;
  abrirNovo: (dia: string, hora?: string) => void;
  abrirEdicao: (v: VisitaItem) => void;
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400"
          >
            {d}
          </div>
        ))}
      </div>

      {gradeDoMes(ano, mes).map((semana) => (
        <div
          key={semana[0].key}
          className="grid grid-cols-7 border-b border-slate-100 last:border-b-0"
        >
          {semana.map((dia) => (
            <div
              key={dia.key}
              className={`group/dia min-h-[110px] border-r border-slate-100 p-1.5 last:border-r-0 ${
                dia.doMes ? "" : "bg-slate-50/40"
              } ${dia.fimDeSemana && dia.doMes ? "bg-slate-50/30" : ""}`}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                    dia.key === hoje
                      ? "bg-brand-600 font-semibold text-white"
                      : dia.doMes
                        ? "text-slate-600"
                        : "text-slate-300"
                  }`}
                >
                  {dia.dia}
                </span>
                <button
                  type="button"
                  onClick={() => abrirNovo(dia.key)}
                  className="rounded p-0.5 text-slate-300 opacity-0 transition hover:bg-slate-100 hover:text-slate-700 focus:opacity-100 group-hover/dia:opacity-100"
                  aria-label={`Agendar no dia ${dia.dia}`}
                >
                  <Plus size={13} />
                </button>
              </div>

              <div className="space-y-1">
                {(porDia.get(dia.key) ?? []).map((v) => (
                  <Chip key={v.id} visita={v} aoEditar={abrirEdicao} />
                ))}
                {(examesPorDia.get(dia.key) ?? []).map((e) => (
                  <ChipExame key={e.id} exame={e} />
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------- grade da semana

/** Altura de uma hora na grade, em pixels. */
const ALTURA_HORA = 52;

function BlocoSemana({
  visita,
  coluna,
  colunas,
  aoEditar,
}: {
  visita: VisitaItem;
  coluna: number;
  colunas: number;
  aoEditar: (v: VisitaItem) => void;
}) {
  const faixa = faixaNaGrade(visita.startTime, visita.endTime);
  if (!faixa) return null;

  const largura = 100 / colunas;

  return (
    <div
      className="group absolute px-0.5"
      style={{
        top: `${faixa.topo}%`,
        height: `${faixa.altura}%`,
        left: `${coluna * largura}%`,
        width: `${largura}%`,
      }}
    >
      <Link
        href={fichaDe(visita.companyId)}
        title={`${faixaHoraria(visita.startTime, visita.endTime)} · ${
          visita.empresa
        }${visita.servico ? ` · ${visita.servico}` : ""} — abrir a ficha`}
        className={`flex h-full flex-col overflow-hidden rounded-md border px-1.5 py-1 text-left text-[11px] leading-tight transition ${
          visita.tipo === "BRIEFING" && visita.status === "AGENDADA"
            ? CHIP_BRIEFING
            : (STATUS_CHIP[visita.status] ?? STATUS_CHIP.AGENDADA)
        }`}
      >
        <span className="truncate font-medium">{visita.empresa}</span>
        <span className="truncate opacity-70">
          {faixaHoraria(visita.startTime, visita.endTime)}
          {faixa.cortado ? " ⋯" : ""}
        </span>
        {visita.servico || visita.subject ? (
          <span className="truncate opacity-70">
            {visita.servico ?? visita.subject}
          </span>
        ) : null}
      </Link>
      <button
        type="button"
        onClick={() => aoEditar(visita)}
        className="absolute right-1 top-0.5 rounded p-0.5 text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
        aria-label={`Editar o agendamento de ${visita.empresa}`}
      >
        <Pencil size={11} />
      </button>
    </div>
  );
}

function SemanaGrade({
  segunda,
  porDia,
  examesPorDia,
  hoje,
  abrirHora,
  abrirEdicao,
}: {
  segunda: string;
  porDia: Map<string, VisitaItem[]>;
  examesPorDia: Map<string, ExameNaAgenda[]>;
  hoje: string;
  abrirHora: (dia: string, hora: string) => void;
  abrirEdicao: (v: VisitaItem) => void;
}) {
  const dias = diasDaSemana(segunda);
  const horas = horasDaGrade();
  // As linhas são os intervalos entre as horas: 08–09, …, 21–22.
  const intervalos = horas.slice(0, -1);
  const altura = intervalos.length * ALTURA_HORA;

  const foraDaFaixa = (v: VisitaItem) =>
    faixaNaGrade(v.startTime, v.endTime) === null;

  return (
    <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
      <div className="flex border-b border-slate-100 bg-slate-50/60">
        <div className="w-14 shrink-0" />
        {dias.map((d, i) => (
          <div
            key={d.key}
            className={`flex-1 border-l border-slate-100 px-2 py-2 text-center ${
              d.fimDeSemana ? "bg-slate-50/60" : ""
            }`}
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              {DIAS_SEMANA[i]}
            </span>{" "}
            <span
              className={`ml-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] ${
                d.key === hoje
                  ? "bg-brand-600 font-semibold text-white"
                  : "text-slate-600"
              }`}
            >
              {d.dia}
            </span>
          </div>
        ))}
      </div>

      {/* Exames marcados e visitas fora das 08h–22h: aparecem, não somem. */}
      {dias.some(
        (d) =>
          (porDia.get(d.key) ?? []).some(foraDaFaixa) ||
          (examesPorDia.get(d.key) ?? []).length > 0,
      ) ? (
        <div className="flex border-b border-amber-100 bg-amber-50/50">
          <div className="w-14 shrink-0 px-1 py-1.5 text-right text-[10px] leading-tight text-amber-700">
            exames e fora do horário
          </div>
          {dias.map((d) => (
            <div
              key={d.key}
              className="flex-1 space-y-1 border-l border-amber-100/70 p-1"
            >
              {(porDia.get(d.key) ?? []).filter(foraDaFaixa).map((v) => (
                <Chip key={v.id} visita={v} aoEditar={abrirEdicao} />
              ))}
              {(examesPorDia.get(d.key) ?? []).map((e) => (
                <ChipExame key={e.id} exame={e} />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex" style={{ height: altura }}>
        <div className="relative w-14 shrink-0">
          {horas.map((h, i) => (
            <span
              key={h}
              className="absolute right-1.5 -translate-y-1/2 text-[10px] tabular-nums text-slate-400"
              style={{ top: `${(i / intervalos.length) * 100}%` }}
            >
              {h}
            </span>
          ))}
        </div>

        {dias.map((d) => {
          const doDia = (porDia.get(d.key) ?? []).filter((v) => !foraDaFaixa(v));

          return (
            <div
              key={d.key}
              className={`relative flex-1 border-l border-slate-100 ${
                d.fimDeSemana ? "bg-slate-50/40" : ""
              } ${d.key === hoje ? "bg-brand-50/30" : ""}`}
            >
              {/* Clicar numa faixa de hora abre o formulário já naquela hora. */}
              {intervalos.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => abrirHora(d.key, h)}
                  style={{ height: ALTURA_HORA }}
                  className="block w-full border-b border-slate-100 transition last:border-b-0 hover:bg-brand-50/60"
                  aria-label={`Agendar dia ${d.dia} às ${h}`}
                />
              ))}

              {/* Os blocos ficam por cima, sem bloquear o clique nas faixas. */}
              <div className="pointer-events-none absolute inset-0">
                <div className="pointer-events-auto relative h-full">
                  {colunasDoDia(doDia).map(({ visita, coluna, colunas }) => (
                    <BlocoSemana
                      key={visita.id}
                      visita={visita}
                      coluna={coluna}
                      colunas={colunas}
                      aoEditar={abrirEdicao}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- página

export default function AgendaCalendar({
  vista,
  ano,
  mes,
  segunda,
  mesAtual,
  semanaAtual,
  hoje,
  visitas,
  empresas,
  produtos,
  consultores,
  exames,
  empresaFixa,
}: {
  vista: "mes" | "semana";
  ano: number;
  mes: number;
  segunda: string;
  mesAtual: string;
  semanaAtual: string;
  hoje: string;
  visitas: VisitaItem[];
  empresas: EmpresaOpcao[];
  produtos: ProdutoOpcao[];
  consultores: { id: string; nome: string }[];
  exames: ExameNaAgenda[];
  /** Quando preenchido, a tela é a agenda daquela empresa só. */
  empresaFixa: string | null;
}) {
  const [form, setForm] = useState<{
    visita: VisitaItem | null;
    dia: string;
    hora?: string;
    fim?: string;
  } | null>(null);
  const [rapido, setRapido] = useState<{ dia: string; hora: string } | null>(
    null,
  );
  const [briefing, setBriefing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const semanal = vista === "semana";

  const porDia = new Map<string, VisitaItem[]>();
  for (const v of visitas) {
    const lista = porDia.get(v.dia);
    if (lista) lista.push(v);
    else porDia.set(v.dia, [v]);
  }

  const examesPorDia = new Map<string, ExameNaAgenda[]>();
  for (const e of exames) {
    const lista = examesPorDia.get(e.dia);
    if (lista) lista.push(e);
    else examesPorDia.set(e.dia, [e]);
  }

  const abrirNovo = (dia: string, hora?: string) =>
    setForm({ visita: null, dia, hora });
  // Clicar na hora da grade abre a lista de empresas; o formulário completo
  // continua a um clique de distância, dentro dela.
  const abrirHora = (dia: string, hora: string) => setRapido({ dia, hora });
  const abrirEdicao = (visita: VisitaItem) =>
    setForm({ visita, dia: visita.dia });

  const mesAnterior = mesVizinho(ano, mes, -1);
  const mesSeguinte = mesVizinho(ano, mes, 1);

  // Na agenda de uma empresa, a navegação continua nela. Os links apontavam
  // sempre para a agenda geral, e a seta do mês tirava o filtro da empresa.
  const base = empresaFixa ? `/empresas/${empresaFixa}/agenda` : "/agenda";

  const linkAnterior = semanal
    ? `${base}?vista=semana&semana=${semanaVizinha(segunda, -1)}`
    : `${base}?mes=${mesKey(mesAnterior.ano, mesAnterior.mes)}`;
  const linkSeguinte = semanal
    ? `${base}?vista=semana&semana=${semanaVizinha(segunda, 1)}`
    : `${base}?mes=${mesKey(mesSeguinte.ano, mesSeguinte.mes)}`;

  const noPeriodoAtual = semanal
    ? segunda === semanaAtual
    : mesKey(ano, mes) === mesAtual;

  return (
    <div className={pending ? "opacity-60" : ""}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Agenda
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Quando você está em cada cliente e qual produto trabalha no dia.
            Clique no agendamento para abrir a ficha.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setBriefing(hoje)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-medium text-amber-900 transition hover:bg-amber-100"
          >
            <Plus size={15} /> Cliente novo · briefing
          </button>
          <button
            type="button"
            onClick={() => abrirNovo(hoje)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus size={15} /> Novo agendamento
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Link
          href={linkAnterior}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:text-slate-900"
          aria-label={semanal ? "Semana anterior" : "Mês anterior"}
        >
          <ChevronLeft size={16} />
        </Link>
        <Link
          href={linkSeguinte}
          className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-500 transition hover:text-slate-900"
          aria-label={semanal ? "Próxima semana" : "Próximo mês"}
        >
          <ChevronRight size={16} />
        </Link>

        <h2 className="ml-1 text-sm font-medium text-slate-800 first-letter:uppercase">
          {semanal ? rotuloDaSemana(segunda) : nomeDoMes(ano, mes)}
        </h2>

        {noPeriodoAtual ? null : (
          <Link
            href={semanal ? `${base}?vista=semana` : base}
            className="text-xs text-brand-700 transition hover:text-brand-800"
          >
            {semanal ? "voltar para esta semana" : "voltar para o mês atual"}
          </Link>
        )}

        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {visitas.length} agendamento(s) {semanal ? "na semana" : "no mês"}
          </span>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Link
              href={base}
              className={`px-2.5 py-1 text-xs transition ${
                semanal
                  ? "text-slate-500 hover:text-slate-900"
                  : "bg-brand-600 font-medium text-white"
              }`}
            >
              Mês
            </Link>
            <Link
              href={`${base}?vista=semana&semana=${segunda}`}
              className={`border-l border-slate-200 px-2.5 py-1 text-xs transition ${
                semanal
                  ? "bg-brand-600 font-medium text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Semana
            </Link>
          </div>
        </div>
      </div>

      {/* O calendário some no celular, onde a lista abaixo é mais legível. */}
      {semanal ? (
        <SemanaGrade
          segunda={segunda}
          porDia={porDia}
          examesPorDia={examesPorDia}
          hoje={hoje}
          abrirHora={abrirHora}
          abrirEdicao={abrirEdicao}
        />
      ) : (
        <MesGrade
          ano={ano}
          mes={mes}
          porDia={porDia}
          examesPorDia={examesPorDia}
          hoje={hoje}
          abrirNovo={abrirNovo}
          abrirEdicao={abrirEdicao}
        />
      )}

      <section className="mt-4 rounded-lg border border-slate-200 bg-white p-3.5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">
          Agendamentos {semanal ? "da semana" : "do mês"}
        </h2>

        {visitas.length === 0 ? (
          <p className="mt-4 flex flex-col items-center gap-2 rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            <CalendarDays size={20} className="text-slate-300" />
            Nenhum agendamento {semanal ? "nesta semana" : "neste mês"}.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-slate-50">
            {visitas.map((v) => (
              <li key={v.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="w-28 shrink-0 text-xs text-slate-400">
                  {v.dia.split("-").reverse().slice(0, 2).join("/")}{" "}
                  {faixaHoraria(v.startTime, v.endTime)}
                </span>

                <Link
                  href={fichaDe(v.companyId)}
                  className="min-w-0 flex-1 text-sm text-slate-800 transition hover:text-brand-700"
                >
                  <span className="font-medium">{v.empresa}</span>
                  {v.servico ? (
                    <span className="text-slate-400"> · {v.servico}</span>
                  ) : null}
                  {v.subject ? (
                    <span className="text-slate-400"> · {v.subject}</span>
                  ) : null}
                </Link>

                {v.naSerie ? (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                    title={`${rotuloDaFrequencia(v.frequencia ?? "")} · ${v.naSerie.total} reuniões`}
                  >
                    <Repeat size={10} />
                    {v.naSerie.posicao} de {v.naSerie.total}
                  </span>
                ) : null}

                {v.location ? (
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-slate-400">
                    <MapPin size={11} /> {v.location}
                  </span>
                ) : null}

                {v.consultor ? (
                  <span className="hidden shrink-0 text-[11px] text-slate-400 sm:block">
                    {v.consultor}
                  </span>
                ) : null}

                <select
                  value={v.status}
                  disabled={pending}
                  onChange={(e) => {
                    const novo = e.target.value as
                      | "AGENDADA"
                      | "REALIZADA"
                      | "CANCELADA";

                    startTransition(() => {
                      void mudarStatusVisita(v.id, novo);
                    });
                  }}
                  aria-label={`Situação do agendamento de ${v.empresa}`}
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 outline-none"
                >
                  {Object.entries(STATUS_LABEL).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>

                <BotaoDaReuniao visitaId={v.id} companyId={v.companyId} reuniaoId={v.reuniaoId} />

                <button
                  type="button"
                  onClick={() => abrirEdicao(v)}
                  className="shrink-0 text-slate-300 transition hover:text-slate-700"
                  aria-label={`Editar o agendamento de ${v.empresa}`}
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    const dia = v.dia.split("-").reverse().join("/");

                    // Numa série, apagar só esta ou desta em diante são
                    // decisões diferentes — e quem escolhe é quem marcou.
                    if (v.seriesId && v.naSerie && v.naSerie.total > 1) {
                      const serie = confirm(
                        `Esta reunião faz parte de uma série (${v.naSerie.posicao} de ${v.naSerie.total}).\n\n` +
                          "OK cancela esta e todas as seguintes.\n" +
                          "Cancelar apaga só a deste dia.",
                      );

                      if (serie) {
                        startTransition(async () => {
                          const r = await excluirSerie(v.seriesId!, v.dia);
                          if (r.error) alert(r.error);
                        });
                        return;
                      }
                    }

                    if (!confirm(`Excluir o agendamento de ${v.empresa} em ${dia}?`))
                      return;
                    startTransition(async () => {
                      const r = await excluirVisita(v.id);
                      if (r.error) alert(r.error);
                    });
                  }}
                  className="shrink-0 text-slate-300 transition hover:text-red-600"
                  aria-label={`Excluir o agendamento de ${v.empresa}`}
                >
                  <Trash2 size={14} />
                </button>
                </div>

                {v.pauta.length > 0 || v.status === "AGENDADA" ? (
                  <div className="ml-28 pl-3">
                    <Pauta visita={v} />
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      {briefing ? (
        <Modal
          titulo="Cliente novo — reunião de briefing"
          aoFechar={() => setBriefing(null)}
        >
          <BriefingForm
            dia={briefing}
            consultores={consultores}
            aoConcluir={() => setBriefing(null)}
          />
        </Modal>
      ) : null}

      {rapido ? (
        <Modal titulo="Agendar" aoFechar={() => setRapido(null)}>
          <EscolhaRapida
            dia={rapido.dia}
            hora={rapido.hora}
            empresas={empresas}
            produtos={produtos}
            aoConcluir={() => setRapido(null)}
            aoAbrirFormulario={() => {
              // Vindo de uma hora clicada, a hora cheia já vem preenchida.
              setForm({
                visita: null,
                dia: rapido.dia,
                hora: rapido.hora,
                fim: fimDaHora(rapido.hora) ?? undefined,
              });
              setRapido(null);
            }}
          />
        </Modal>
      ) : null}

      {form ? (
        <Modal
          titulo={form.visita ? "Editar agendamento" : "Novo agendamento"}
          aoFechar={() => setForm(null)}
        >
          <VisitaForm
            empresaFixa={empresaFixa}
            visita={form.visita}
            diaInicial={form.dia}
            horaInicial={form.hora}
            fimInicial={form.fim}
            empresas={empresas}
            produtos={produtos}
            consultores={consultores}
            aoConcluir={() => setForm(null)}
          />
        </Modal>
      ) : null}
    </div>
  );
}

/**
 * O compromisso vira reunião (pauta, participantes, ata) só quando se aperta
 * aqui. Já virou: o botão abre a reunião.
 */
function BotaoDaReuniao({ visitaId, companyId, reuniaoId }: { visitaId: string; companyId: string; reuniaoId: string | null }) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const classe =
    "shrink-0 rounded-md border px-2 py-0.5 text-[11px] transition disabled:opacity-50";

  if (reuniaoId) {
    return (
      <Link href={`/empresas/${companyId}/reunioes/${reuniaoId}`} className={`${classe} border-slate-200 text-slate-600 hover:border-brand-300 hover:text-brand-700`}>
        abrir reunião
      </Link>
    );
  }
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() =>
        iniciar(async () => {
          const r = await mandarParaReuniao(visitaId);
          if (r.error) alert(r.error);
          else if (r.id) router.push(`/empresas/${companyId}/reunioes/${r.id}`);
        })
      }
      className={`${classe} border-brand-300 bg-brand-50 font-medium text-brand-700 hover:bg-brand-100`}
    >
      {pendente ? "Criando…" : "Mandar para reunião"}
    </button>
  );
}
