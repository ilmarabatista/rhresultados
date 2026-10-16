"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { mandarParaReuniao } from "@/app/(app)/empresas/[id]/reunioes/actions";
import {
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  CalendarClock,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  MapPin,
  Pencil,
  Plus,
  Repeat,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  agoraNoEscritorio,
  colunasDoDia,
  HORA_FIM,
  HORA_INICIO,
  passouSemCheck,
  type Agora,
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
  reagendarVisita,
  type AgendaState,
} from "@/app/(app)/agenda/actions";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";
import { avisar, confirmar } from "@/components/avisos";
import Modal from "@/components/modal";

export type VisitaItem = {
  id: string;
  /** "AAAA-MM-DD". */
  dia: string;
  startTime: string;
  endTime: string | null;
  /** BRIEFING, ACOMPANHAMENTO, ENTREGA ou OUTRO. */
  tipo: string;
  /** REUNIAO ou TAREFA. */
  natureza: string;
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

const ehTarefa = (v: VisitaItem) => v.natureza === "TAREFA";

/**
 * Como o compromisso aparece: cartão branco com uma faixa colorida à
 * esquerda e um rótulo pequeno em cima.
 *
 * A faixa e o rótulo dizem se é reunião (azul), tarefa (roxo) ou briefing
 * (âmbar). O fundo diz em que pé está: feito fica verde, o que passou sem
 * check fica vermelho, cancelado fica apagado e riscado.
 */
function visualDoCompromisso(v: VisitaItem, atrasado: boolean) {
  const natureza =
    v.natureza === "TAREFA"
      ? { faixa: "border-l-violet-500", rotulo: "text-violet-700" }
      : v.tipo === "BRIEFING"
        ? { faixa: "border-l-amber-500", rotulo: "text-amber-700" }
        : { faixa: "border-l-brand-500", rotulo: "text-brand-700" };

  if (v.status === "CANCELADA")
    return {
      caixa: "border-slate-200 border-l-slate-300 bg-slate-50 text-slate-500 line-through opacity-70",
      rotulo: "text-slate-500",
    };
  if (v.status === "REALIZADA")
    return {
      caixa: `border-emerald-200 ${natureza.faixa} bg-emerald-50 text-slate-700 hover:bg-emerald-100/70`,
      rotulo: natureza.rotulo,
    };
  if (atrasado)
    return {
      caixa: "border-red-300 border-l-red-600 bg-red-50 text-red-900 ring-1 ring-red-200 hover:bg-red-100",
      rotulo: "text-red-700",
    };
  return {
    caixa: `border-slate-200 ${natureza.faixa} bg-white text-slate-800 shadow-sm hover:shadow-md`,
    rotulo: natureza.rotulo,
  };
}

/** "REUNIÃO · Recrutamento", "TAREFA", "BRIEFING"… */
function rotuloDoCompromisso(v: VisitaItem): string {
  const tipo = ehTarefa(v) ? "tarefa" : v.tipo === "BRIEFING" ? "briefing" : "reunião";
  const extra = v.servico ?? v.subject;
  return extra ? `${tipo} · ${extra}` : tipo;
}

/** O que cada cor quer dizer, no alto da agenda. */
function Legenda() {
  const item = (cor: string, texto: string) => (
    <span className="flex items-center gap-1">
      <span className={`h-2.5 w-2.5 rounded-sm ${cor}`} />
      {texto}
    </span>
  );
  return (
    <span className="hidden items-center gap-2.5 text-micro text-slate-500 xl:flex">
      {item("bg-brand-500", "reunião")}
      {item("bg-violet-500", "tarefa")}
      {item("bg-emerald-500", "feito")}
      {item("bg-red-600", "passou sem check")}
    </span>
  );
}

const STATUS_LABEL: Record<string, string> = {
  AGENDADA: "agendado",
  REALIZADA: "realizado",
  CANCELADA: "cancelado",
};


function IconeNatureza({ visita, size = 11 }: { visita: VisitaItem; size?: number }) {
  return ehTarefa(visita) ? (
    <ClipboardList size={size} className="shrink-0" aria-label="Tarefa" />
  ) : (
    <Users size={size} className="shrink-0" aria-label="Reunião" />
  );
}

/**
 * A hora de agora, no fuso do escritório, atualizada a cada meio minuto.
 *
 * Começa vazia de propósito: o servidor não sabe a hora em que a tela vai
 * ser vista, e nada fica vermelho antes de o navegador conferir.
 */
function useAgora(): Agora | null {
  const [agora, setAgora] = useState<Agora | null>(null);
  useEffect(() => {
    const atualizar = () => setAgora(agoraNoEscritorio());
    atualizar();
    const id = setInterval(atualizar, 30_000);
    return () => clearInterval(id);
  }, []);
  return agora;
}

/** O que cada compromisso na grade sabe fazer, vindo da tela. */
type Interacao = {
  agora: Agora | null;
  aoEditar: (v: VisitaItem) => void;
  aoReagendar: (v: VisitaItem) => void;
  aoPassar: (v: VisitaItem, el: HTMLElement) => void;
  aoSair: () => void;
};

// ------------------------------------------------------------- o check

/**
 * Marca o compromisso como feito — ou desfaz. A marca aparece na hora; o
 * servidor confirma em seguida.
 */
function BotaoCheck({
  visita,
  className = "",
}: {
  visita: VisitaItem;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [feito, setFeito] = useState(visita.status === "REALIZADA");

  useEffect(() => setFeito(visita.status === "REALIZADA"), [visita.status]);

  if (visita.status === "CANCELADA") return null;

  return (
    <button
      type="button"
      disabled={pending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const novo = !feito;
        setFeito(novo);
        startTransition(async () => {
          await mudarStatusVisita(visita.id, novo ? "REALIZADA" : "AGENDADA");
        });
      }}
      title={feito ? "Feito — clique para desmarcar" : "Marcar como feito"}
      aria-label={`${feito ? "Desmarcar" : "Marcar como feito"}: ${visita.empresa}`}
      aria-pressed={feito}
      className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border transition ${
        feito
          ? "border-emerald-500 bg-emerald-500 text-white"
          : "border-slate-400 bg-white hover:border-emerald-500 hover:bg-emerald-50"
      } ${className}`}
    >
      {feito ? <Check size={10} strokeWidth={3} /> : null}
    </button>
  );
}

// ------------------------------------------------- detalhes ao passar o mouse

/**
 * Os detalhes do compromisso, ao passar o mouse.
 *
 * Fica fixo na tela, e não dentro do bloco, para não ser cortado pela grade
 * — e abre do lado que tiver espaço.
 */
function CartaoDeDetalhes({
  visita,
  ancora,
  agora,
}: {
  visita: VisitaItem;
  ancora: DOMRect;
  agora: Agora | null;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const LARGURA = 288;
  const [topo, setTopo] = useState(ancora.top);

  const cabeAdireita = ancora.right + 8 + LARGURA <= window.innerWidth - 8;
  const esquerda = cabeAdireita
    ? ancora.right + 8
    : Math.max(8, ancora.left - 8 - LARGURA);

  useLayoutEffect(() => {
    const altura = ref.current?.offsetHeight ?? 0;
    setTopo(Math.max(8, Math.min(ancora.top, window.innerHeight - altura - 8)));
  }, [ancora]);

  const atrasado = passouSemCheck(visita, agora);
  const situacao = atrasado
    ? { texto: "Passou sem check", cor: "bg-red-100 text-red-800" }
    : visita.status === "REALIZADA"
      ? { texto: "Feito", cor: "bg-emerald-100 text-emerald-800" }
      : visita.status === "CANCELADA"
        ? { texto: "Cancelado", cor: "bg-slate-100 text-slate-500" }
        : { texto: "Agendado", cor: "bg-slate-100 text-slate-600" };

  const linha = (rotulo: string, valor: string | null | undefined) =>
    valor ? (
      <div className="flex gap-2">
        <dt className="w-20 shrink-0 text-slate-500">{rotulo}</dt>
        <dd className="min-w-0 flex-1 text-slate-700">{valor}</dd>
      </div>
    ) : null;

  return (
    <div
      ref={ref}
      role="tooltip"
      style={{ top: topo, left: esquerda, width: LARGURA }}
      className="pointer-events-none fixed z-[60] rounded-lg border border-slate-200 bg-white p-3 text-xs shadow-xl"
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <span
          className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide ${
            ehTarefa(visita) ? "bg-violet-100 text-violet-800" : "bg-brand-100 text-brand-800"
          }`}
        >
          <IconeNatureza visita={visita} size={10} />
          {ehTarefa(visita) ? "Tarefa" : "Reunião"}
        </span>
        {visita.tipo === "BRIEFING" ? (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wide text-amber-800">
            briefing
          </span>
        ) : null}
        <span className={`rounded px-1.5 py-0.5 text-micro font-medium ${situacao.cor}`}>
          {situacao.texto}
        </span>
      </div>

      <p className="text-sm font-semibold text-slate-900">{visita.empresa}</p>
      <p className="mb-2 text-slate-500">
        <span className="first-letter:uppercase">{rotuloDoDia(visita.dia)}</span> ·{" "}
        <span className="font-medium text-slate-700">
          {faixaHoraria(visita.startTime, visita.endTime)}
        </span>
      </p>

      <dl className="space-y-1">
        {linha("Produto", visita.servico)}
        {linha("Assunto", visita.subject)}
        {linha("Local", visita.location)}
        {linha(ehTarefa(visita) ? "Responsável" : "Quem vai", visita.consultor)}
        {linha(
          "Repetição",
          visita.naSerie
            ? `${rotuloDaFrequencia(visita.frequencia ?? "")} · ${visita.naSerie.posicao} de ${visita.naSerie.total}`
            : null,
        )}
      </dl>

      {visita.pauta.length > 0 ? (
        <div className="mt-2 border-t border-slate-100 pt-2">
          <p className="mb-1 text-micro uppercase tracking-wide text-slate-500">
            {ehTarefa(visita) ? "itens" : "pauta"} ·{" "}
            {visita.pauta.filter((a) => a.feito).length} de {visita.pauta.length}
          </p>
          <ul className="space-y-0.5">
            {visita.pauta.slice(0, 8).map((a) => (
              <li
                key={a.id}
                className={`flex items-start gap-1.5 ${a.feito ? "text-slate-500 line-through" : "text-slate-600"}`}
              >
                <span
                  className={`mt-px flex h-3 w-3 shrink-0 items-center justify-center rounded-sm border ${
                    a.feito ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                  }`}
                >
                  {a.feito ? <Check size={8} strokeWidth={3} /> : null}
                </span>
                <span className="min-w-0 flex-1">{a.titulo}</span>
              </li>
            ))}
            {visita.pauta.length > 8 ? (
              <li className="text-slate-500">+ {visita.pauta.length - 8} assunto(s)</li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {visita.notes ? (
        <p className="mt-2 line-clamp-4 whitespace-pre-line border-t border-slate-100 pt-2 text-slate-600">
          {visita.notes}
        </p>
      ) : null}

      <p className="mt-2 border-t border-slate-100 pt-2 text-micro text-slate-500">
        Clique para abrir a ficha da empresa.
        {atrasado ? " Use o relógio para reagendar." : ""}
      </p>
    </div>
  );
}

// ------------------------------------------------------------- reagendar

/** Leva o compromisso que passou para um novo dia e horário. */
function ReagendarForm({
  visita,
  hoje,
  aoConcluir,
}: {
  visita: VisitaItem;
  hoje: string;
  aoConcluir: () => void;
}) {
  const [dia, setDia] = useState(visita.dia < hoje ? hoje : visita.dia);
  const [inicio, setInicio] = useState(visita.startTime);
  const [termino, setTermino] = useState(visita.endTime ?? "");
  const [erro, setErro] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const campo =
    "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErro(undefined);
        startTransition(async () => {
          const r = await reagendarVisita(visita.id, dia, inicio, termino || null);
          if (r.error) setErro(r.error);
          else aoConcluir();
        });
      }}
      className={pending ? "opacity-60" : ""}
    >
      <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs leading-relaxed text-red-800">
        <strong>{visita.empresa}</strong>
        {visita.servico || visita.subject ? ` · ${visita.servico ?? visita.subject}` : ""} estava
        para <span className="first-letter:lowercase">{rotuloDoDia(visita.dia)}</span>,{" "}
        {faixaHoraria(visita.startTime, visita.endTime)}, e não foi marcado como feito.
        {visita.naSerie ? " Só este dia muda; o resto da série fica onde está." : ""}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block text-xs text-slate-500">
          Novo dia
          <input
            type="date"
            required
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            className={campo}
            autoFocus
          />
        </label>
        <label className="block text-xs text-slate-500">
          Início
          <input
            type="time"
            required
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className={campo}
          />
        </label>
        <label className="block text-xs text-slate-500">
          Término
          <input
            type="time"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            className={campo}
          />
        </label>
      </div>

      <FormError message={erro} />

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
        >
          <CalendarClock size={15} /> {pending ? "Reagendando…" : "Reagendar"}
        </button>
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

/** Reunião ou tarefa, nos formulários de agendar. */
function SeletorNatureza({
  valor,
  aoMudar,
}: {
  valor: string;
  aoMudar: (v: "REUNIAO" | "TAREFA") => void;
}) {
  const opcao = (v: "REUNIAO" | "TAREFA", rotulo: string, icone: React.ReactNode, cor: string) => (
    <button
      type="button"
      onClick={() => aoMudar(v)}
      aria-pressed={valor === v}
      className={`flex flex-1 items-center justify-center gap-1.5 px-3 py-2 text-sm transition ${
        valor === v ? `${cor} font-medium` : "bg-white text-slate-500 hover:text-slate-800"
      }`}
    >
      {icone} {rotulo}
    </button>
  );

  return (
    <div className="flex overflow-hidden rounded-lg border border-slate-300 divide-x divide-slate-300">
      {opcao("REUNIAO", "Reunião", <Users size={14} />, "bg-brand-50 text-brand-800")}
      {opcao("TAREFA", "Tarefa", <ClipboardList size={14} />, "bg-violet-50 text-violet-800")}
    </div>
  );
}

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
  const [natureza, setNatureza] = useState(visita?.natureza ?? "REUNIAO");
  const tarefa = natureza === "TAREFA";
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

      <input type="hidden" name="natureza" value={natureza} />
      <SeletorNatureza valor={natureza} aoMudar={setNatureza} />

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
        <Field label={tarefa ? "Responsável" : "Quem vai"}>
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
            label={tarefa ? "Itens da tarefa" : "Pauta"}
            hint={
              tarefa
                ? "Um item por linha, para ir marcando. Dá para acrescentar depois."
                : "Um assunto por linha. Vale para todas as reuniões da série, e dá para acrescentar depois."
            }
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
        <p className="mb-1 text-micro uppercase tracking-wide text-slate-500">
          {ehTarefa(visita) ? "itens" : "pauta"} · {feitos} de {visita.pauta.length}
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
                a.feito ? "text-slate-500 line-through" : "text-slate-600"
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
          placeholder={ehTarefa(visita) ? "+ item" : "+ assunto"}
          aria-label={ehTarefa(visita) ? "Acrescentar item à tarefa" : "Acrescentar assunto à pauta"}
          className="w-full rounded px-1 py-0.5 text-xs outline-none transition placeholder:text-slate-300 hover:bg-slate-50 focus:bg-white focus:ring-1 focus:ring-brand-300"
        />
      </form>

      {erro ? <p className="text-micro text-red-700">{erro}</p> : null}
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
      className="block rounded-md border border-sky-200 bg-sky-50 px-1.5 py-1 text-left text-micro leading-tight text-sky-800 transition hover:bg-sky-100"
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

/**
 * Os botões do canto do compromisso: reagendar (sempre à vista quando passou
 * sem check) e editar (ao passar o mouse).
 */
function BotoesDoCanto({
  visita,
  atrasado,
  interacao,
  className,
}: {
  visita: VisitaItem;
  atrasado: boolean;
  interacao: Interacao;
  className: string;
}) {
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      {atrasado ? (
        <button
          type="button"
          onClick={() => interacao.aoReagendar(visita)}
          className="rounded bg-white/80 p-0.5 text-red-700 transition hover:bg-white hover:text-red-900"
          aria-label={`Reagendar ${visita.empresa}`}
          title="Reagendar"
        >
          <CalendarClock size={11} />
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => interacao.aoEditar(visita)}
        className="rounded p-0.5 text-slate-500 opacity-0 transition hover:bg-white hover:text-slate-700 focus:opacity-100 group-hover:opacity-100"
        aria-label={`Editar o agendamento de ${visita.empresa}`}
      >
        <Pencil size={11} />
      </button>
    </div>
  );
}

function Chip({
  visita,
  interacao,
}: {
  visita: VisitaItem;
  interacao: Interacao;
}) {
  const atrasado = passouSemCheck(visita, interacao.agora);
  const visual = visualDoCompromisso(visita, atrasado);

  return (
    <div
      className="group relative"
      onMouseEnter={(e) => interacao.aoPassar(visita, e.currentTarget)}
      onMouseLeave={interacao.aoSair}
    >
      <Link
        href={fichaDe(visita.companyId)}
        className={`block rounded-md border border-l-[3px] py-1 pl-1.5 pr-5 text-left leading-tight transition ${visual.caixa}`}
      >
        <span
          className={`flex items-center gap-1 text-micro font-semibold uppercase tracking-wide ${visual.rotulo}`}
        >
          <IconeNatureza visita={visita} size={9} />
          <span className="truncate">{rotuloDoCompromisso(visita)}</span>
        </span>
        <span className="block truncate text-micro font-semibold">
          <span className="font-normal opacity-70">{visita.startTime}</span> {visita.empresa}
        </span>
      </Link>
      <BotaoCheck visita={visita} className="absolute right-1 top-1" />
      <BotoesDoCanto
        visita={visita}
        atrasado={atrasado}
        interacao={interacao}
        className="absolute right-5 top-0.5"
      />
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
  const [natureza, setNatureza] = useState<"REUNIAO" | "TAREFA">("REUNIAO");
  const [produto, setProduto] = useState("");
  const [inicio, setInicio] = useState(hora);
  const [termino, setTermino] = useState(fimDaHora(hora) ?? "");
  const [erro, setErro] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const agendar = (companyId: string) => {
    setErro(undefined);
    startTransition(async () => {
      const r = await agendarRapido(
        companyId,
        produto || null,
        dia,
        inicio,
        termino || null,
        natureza,
      );
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
          {faixaHoraria(inicio, termino || null)}
        </span>
      </p>

      <div className="mb-2">
        <SeletorNatureza valor={natureza} aoMudar={setNatureza} />
      </div>

      <div className="mb-2 grid grid-cols-2 gap-2">
        <label className="block text-xs text-slate-500">
          Início
          <input
            type="time"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
        <label className="block text-xs text-slate-500">
          Término
          <input
            type="time"
            value={termino}
            onChange={(e) => setTermino(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
        </label>
      </div>

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
        Preencher tudo (assunto, local, quem vai, repetir)
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
  interacao,
}: {
  ano: number;
  mes: number;
  porDia: Map<string, VisitaItem[]>;
  examesPorDia: Map<string, ExameNaAgenda[]>;
  hoje: string;
  abrirNovo: (dia: string, hora?: string) => void;
  interacao: Interacao;
}) {
  return (
    <div className="hidden overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:block">
      <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/60">
        {DIAS_SEMANA.map((d) => (
          <div
            key={d}
            className="px-2 py-2 text-center text-micro font-medium uppercase tracking-wide text-slate-500"
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
                  className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-micro ${
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
                  <Chip key={v.id} visita={v} interacao={interacao} />
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

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

function BlocoSemana({
  visita,
  coluna,
  colunas,
  interacao,
}: {
  visita: VisitaItem;
  coluna: number;
  colunas: number;
  interacao: Interacao;
}) {
  const faixa = faixaNaGrade(visita.startTime, visita.endTime);
  if (!faixa) return null;

  const largura = 100 / colunas;
  const atrasado = passouSemCheck(visita, interacao.agora);
  const visual = visualDoCompromisso(visita, atrasado);

  return (
    <div
      className="group pointer-events-auto absolute px-0.5 py-px"
      style={{
        top: `${faixa.topo}%`,
        height: `${faixa.altura}%`,
        left: `${coluna * largura}%`,
        width: `${largura}%`,
      }}
      onMouseEnter={(e) => interacao.aoPassar(visita, e.currentTarget)}
      onMouseLeave={interacao.aoSair}
    >
      <Link
        href={fichaDe(visita.companyId)}
        className={`flex h-full flex-col overflow-hidden rounded-md border border-l-[3px] py-px pl-1.5 pr-5 text-left leading-tight transition ${visual.caixa}`}
      >
        <span
          className={`flex shrink-0 items-center gap-1 text-micro font-semibold uppercase tracking-wide ${visual.rotulo}`}
        >
          <IconeNatureza visita={visita} size={9} />
          <span className="truncate">{rotuloDoCompromisso(visita)}</span>
        </span>
        <span className="shrink-0 truncate text-micro font-semibold">{visita.empresa}</span>
        <span className="shrink-0 truncate text-micro opacity-70">
          {faixaHoraria(visita.startTime, visita.endTime)}
          {faixa.cortado ? " ⋯" : ""}
          {atrasado ? " · sem check" : visita.status === "REALIZADA" ? " · feito" : ""}
        </span>
      </Link>
      <BotaoCheck visita={visita} className="absolute right-1.5 top-[3px]" />
      <BotoesDoCanto
        visita={visita}
        atrasado={atrasado}
        interacao={interacao}
        className="absolute right-5 top-px"
      />
    </div>
  );
}

/**
 * A altura que sobra na janela abaixo da grade, para a semana inteira caber
 * sem rolar a tela. Antes de medir, vale a estimativa do CSS.
 */
function useAlturaQueCabe<T extends HTMLElement>(minimo: number) {
  const ref = useRef<T>(null);
  const [altura, setAltura] = useState<number | null>(null);

  useLayoutEffect(() => {
    const medir = () => {
      const el = ref.current;
      if (!el) return;
      const topo = el.getBoundingClientRect().top + window.scrollY;
      setAltura(Math.max(minimo, Math.floor(window.innerHeight - topo - 12)));
    };
    medir();
    window.addEventListener("resize", medir);
    return () => window.removeEventListener("resize", medir);
  }, [minimo]);

  return { ref, altura };
}

function SemanaGrade({
  segunda,
  porDia,
  examesPorDia,
  hoje,
  abrirHora,
  interacao,
}: {
  segunda: string;
  porDia: Map<string, VisitaItem[]>;
  examesPorDia: Map<string, ExameNaAgenda[]>;
  hoje: string;
  abrirHora: (dia: string, hora: string) => void;
  interacao: Interacao;
}) {
  const dias = diasDaSemana(segunda);
  const horas = horasDaGrade();
  // As linhas são os intervalos entre as horas: 08–09, …, 21–22.
  const intervalos = horas.slice(0, -1);
  const { ref, altura } = useAlturaQueCabe<HTMLDivElement>(420);

  const foraDaFaixa = (v: VisitaItem) =>
    faixaNaGrade(v.startTime, v.endTime) === null;

  // A linha de "agora", no dia de hoje.
  const { agora } = interacao;
  const agoraNaGrade =
    agora &&
    agora.minutos >= HORA_INICIO * 60 &&
    agora.minutos <= HORA_FIM * 60
      ? ((agora.minutos - HORA_INICIO * 60) / ((HORA_FIM - HORA_INICIO) * 60)) * 100
      : null;

  return (
    <div
      ref={ref}
      style={altura ? { height: altura } : undefined}
      className="hidden h-[calc(100vh-6rem)] min-h-[420px] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm md:flex"
    >
      <div className="flex shrink-0 bg-slate-800 text-white">
        <div className="w-11 shrink-0" />
        {dias.map((d, i) => {
          const total =
            (porDia.get(d.key) ?? []).filter((v) => v.status !== "CANCELADA").length +
            (examesPorDia.get(d.key) ?? []).length;
          const feitos = (porDia.get(d.key) ?? []).filter((v) => v.status === "REALIZADA").length;
          return (
            <div
              key={d.key}
              className={`min-w-0 flex-1 border-l border-slate-700 px-1 py-1 text-center leading-none ${
                d.key === hoje ? "bg-brand-600" : ""
              }`}
            >
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-micro font-semibold uppercase tracking-wide text-slate-300">
                  {DIAS_SEMANA[i]}
                </span>
                <span className="text-lg font-semibold tabular-nums">{d.dia}</span>
                <span className="text-micro uppercase text-slate-300">
                  {MESES_CURTOS[Number(d.key.slice(5, 7)) - 1]}
                </span>
              </div>
              <div className="mt-0.5 truncate text-micro text-slate-300">
                {total === 0
                  ? "—"
                  : `${total} agendamento${total > 1 ? "s" : ""}${feitos ? ` · ${feitos} feito${feitos > 1 ? "s" : ""}` : ""}`}
              </div>
            </div>
          );
        })}
      </div>

      {/* Exames marcados e visitas fora das 08h–22h: aparecem, não somem. */}
      {dias.some(
        (d) =>
          (porDia.get(d.key) ?? []).some(foraDaFaixa) ||
          (examesPorDia.get(d.key) ?? []).length > 0,
      ) ? (
        <div className="scroll-thin flex max-h-24 shrink-0 overflow-y-auto border-b border-amber-100 bg-amber-50/50">
          <div className="w-11 shrink-0 px-1 py-1 text-right text-micro leading-tight text-amber-700">
            exames e fora do horário
          </div>
          {dias.map((d) => (
            <div
              key={d.key}
              className="min-w-0 flex-1 space-y-1 border-l border-amber-100/70 p-1"
            >
              {(porDia.get(d.key) ?? []).filter(foraDaFaixa).map((v) => (
                <Chip key={v.id} visita={v} interacao={interacao} />
              ))}
              {(examesPorDia.get(d.key) ?? []).map((e) => (
                <ChipExame key={e.id} exame={e} />
              ))}
            </div>
          ))}
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 pt-1.5 pb-1.5">
        <div className="relative w-11 shrink-0">
          {horas.map((h, i) => (
            <span
              key={h}
              className="absolute right-1.5 -translate-y-1/2 text-micro font-semibold tabular-nums text-slate-500"
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
              className={`relative flex min-w-0 flex-1 flex-col border-l border-t border-slate-100 ${
                d.fimDeSemana ? "bg-slate-50/40" : ""
              } ${d.key === hoje ? "bg-brand-50/30" : ""}`}
            >
              {/* Clicar numa faixa de hora abre o formulário já naquela hora. */}
              {intervalos.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => abrirHora(d.key, h)}
                  className="relative block min-h-0 w-full flex-1 border-b border-slate-200 transition hover:bg-brand-50/60"
                  aria-label={`Agendar dia ${d.dia} às ${h}`}
                >
                  {/* A meia hora, pontilhada. */}
                  <span className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-slate-100" />
                </button>
              ))}

              {/* Os blocos ficam por cima; o espaço vazio entre eles deixa o clique chegar às faixas. */}
              <div className="pointer-events-none absolute inset-0">
                {colunasDoDia(doDia).map(({ visita, coluna, colunas }) => (
                  <BlocoSemana
                    key={visita.id}
                    visita={visita}
                    coluna={coluna}
                    colunas={colunas}
                    interacao={interacao}
                  />
                ))}

                {d.key === agora?.dia && agoraNaGrade !== null ? (
                  <div
                    className="absolute inset-x-0 z-10 border-t-2 border-red-500"
                    style={{ top: `${agoraNaGrade}%` }}
                    aria-hidden
                  >
                    <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                  </div>
                ) : null}
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

  const agora = useAgora();
  const [reagendar, setReagendar] = useState<VisitaItem | null>(null);
  const [detalhe, setDetalhe] = useState<{ visita: VisitaItem; ancora: DOMRect } | null>(null);

  // Os detalhes abrem com uma pequena espera, para não piscar enquanto o
  // mouse só atravessa a grade.
  const espera = useRef<ReturnType<typeof setTimeout> | null>(null);
  const aoPassar = useCallback((visita: VisitaItem, el: HTMLElement) => {
    if (espera.current) clearTimeout(espera.current);
    espera.current = setTimeout(
      () => setDetalhe({ visita, ancora: el.getBoundingClientRect() }),
      250,
    );
  }, []);
  const aoSair = useCallback(() => {
    if (espera.current) clearTimeout(espera.current);
    setDetalhe(null);
  }, []);

  // Rolar a tela deixaria o cartão longe do compromisso.
  useEffect(() => {
    window.addEventListener("scroll", aoSair, true);
    return () => window.removeEventListener("scroll", aoSair, true);
  }, [aoSair]);

  const interacao: Interacao = {
    agora,
    aoEditar: (v) => {
      aoSair();
      abrirEdicao(v);
    },
    aoReagendar: (v) => {
      aoSair();
      setReagendar(v);
    },
    aoPassar,
    aoSair,
  };

  const atrasados = visitas.filter((v) => passouSemCheck(v, agora)).length;

  const mesAnterior = mesVizinho(ano, mes, -1);
  const mesSeguinte = mesVizinho(ano, mes, 1);

  // Na agenda de uma empresa, a navegação continua nela. Os links apontavam
  // sempre para a agenda geral, e a seta do mês tirava o filtro da empresa.
  const base = empresaFixa ? `/empresas/${empresaFixa}/agenda` : "/agenda";

  const linkAnterior = semanal
    ? `${base}?vista=semana&semana=${semanaVizinha(segunda, -1)}`
    : `${base}?vista=mes&mes=${mesKey(mesAnterior.ano, mesAnterior.mes)}`;
  const linkSeguinte = semanal
    ? `${base}?vista=semana&semana=${semanaVizinha(segunda, 1)}`
    : `${base}?vista=mes&mes=${mesKey(mesSeguinte.ano, mesSeguinte.mes)}`;

  const noPeriodoAtual = semanal
    ? segunda === semanaAtual
    : mesKey(ano, mes) === mesAtual;

  return (
    <div className={pending ? "opacity-60" : ""}>
      {/* Tudo numa linha só, para sobrar altura e a semana caber na tela. */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-semibold tracking-tight text-slate-900">
          Agenda
        </h1>
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
            href={semanal ? base : `${base}?vista=mes`}
            className="text-xs text-brand-700 transition hover:text-brand-800"
          >
            {semanal ? "voltar para esta semana" : "voltar para o mês atual"}
          </Link>
        )}

        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-2">
          <Legenda />
          <span className="text-xs text-slate-500">
            {visitas.length} {semanal ? "na semana" : "no mês"}
            {atrasados > 0 ? (
              <span className="font-medium text-red-700"> · {atrasados} sem check</span>
            ) : null}
          </span>
          <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
            <Link
              href={`${base}?vista=semana&semana=${segunda}`}
              className={`px-2.5 py-1 text-xs transition ${
                semanal
                  ? "bg-brand-600 font-medium text-white"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              Semana
            </Link>
            <Link
              href={`${base}?vista=mes`}
              className={`border-l border-slate-200 px-2.5 py-1 text-xs transition ${
                semanal
                  ? "text-slate-500 hover:text-slate-900"
                  : "bg-brand-600 font-medium text-white"
              }`}
            >
              Mês
            </Link>
          </div>
          <button
            type="button"
            onClick={() => setBriefing(hoje)}
            className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-900 transition hover:bg-amber-100"
          >
            <Plus size={13} /> Cliente novo · briefing
          </button>
          <button
            type="button"
            onClick={() => abrirNovo(hoje)}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700"
          >
            <Plus size={13} /> Novo agendamento
          </button>
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
          interacao={interacao}
        />
      ) : (
        <MesGrade
          ano={ano}
          mes={mes}
          porDia={porDia}
          examesPorDia={examesPorDia}
          hoje={hoje}
          abrirNovo={abrirNovo}
          interacao={interacao}
        />
      )}

      {detalhe ? (
        <CartaoDeDetalhes visita={detalhe.visita} ancora={detalhe.ancora} agora={agora} />
      ) : null}

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
            {visitas.map((v) => {
              const atrasado = passouSemCheck(v, agora);
              return (
              <li
                key={v.id}
                className={`py-2.5 ${atrasado ? "-mx-2 rounded-md bg-red-50 px-2" : ""}`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <BotaoCheck visita={v} />
                <span
                  className={`w-24 shrink-0 text-xs ${atrasado ? "font-medium text-red-700" : "text-slate-500"}`}
                >
                  {v.dia.split("-").reverse().slice(0, 2).join("/")}{" "}
                  {faixaHoraria(v.startTime, v.endTime)}
                </span>

                <span
                  className={`flex w-20 shrink-0 items-center gap-1 text-micro font-medium ${
                    ehTarefa(v) ? "text-violet-700" : "text-brand-700"
                  }`}
                >
                  <IconeNatureza visita={v} />
                  {ehTarefa(v) ? "tarefa" : "reunião"}
                </span>

                <Link
                  href={fichaDe(v.companyId)}
                  className={`min-w-0 flex-1 text-sm transition hover:text-brand-700 ${
                    v.status === "CANCELADA" ? "text-slate-500 line-through" : "text-slate-800"
                  }`}
                >
                  <span className="font-medium">{v.empresa}</span>
                  {v.servico ? (
                    <span className="text-slate-500"> · {v.servico}</span>
                  ) : null}
                  {v.subject ? (
                    <span className="text-slate-500"> · {v.subject}</span>
                  ) : null}
                </Link>

                {v.naSerie ? (
                  <span
                    className="flex shrink-0 items-center gap-1 rounded bg-slate-100 px-1.5 py-0.5 text-micro text-slate-500"
                    title={`${rotuloDaFrequencia(v.frequencia ?? "")} · ${v.naSerie.total} reuniões`}
                  >
                    <Repeat size={10} />
                    {v.naSerie.posicao} de {v.naSerie.total}
                  </span>
                ) : null}

                {v.location ? (
                  <span className="flex shrink-0 items-center gap-1 text-micro text-slate-500">
                    <MapPin size={11} /> {v.location}
                  </span>
                ) : null}

                {v.consultor ? (
                  <span className="hidden shrink-0 text-micro text-slate-500 sm:block">
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
                  className="shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-micro text-slate-600 outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                >
                  {Object.entries(STATUS_LABEL).map(([valor, rotulo]) => (
                    <option key={valor} value={valor}>
                      {rotulo}
                    </option>
                  ))}
                </select>

                {atrasado ? (
                  <button
                    type="button"
                    onClick={() => setReagendar(v)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-md border border-red-300 bg-white px-2 py-0.5 text-micro font-medium text-red-700 transition hover:bg-red-100"
                  >
                    <CalendarClock size={12} /> reagendar
                  </button>
                ) : null}

                {ehTarefa(v) ? null : (
                  <BotaoDaReuniao visitaId={v.id} companyId={v.companyId} reuniaoId={v.reuniaoId} />
                )}

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
                  onClick={async () => {
                    const dia = v.dia.split("-").reverse().join("/");

                    // Numa série, apagar só esta ou desta em diante são
                    // decisões diferentes — e quem escolhe é quem marcou.
                    if (v.seriesId && v.naSerie && v.naSerie.total > 1) {
                      const serie = await confirmar(
                        `Esta reunião faz parte de uma série (${v.naSerie.posicao} de ${v.naSerie.total}). Excluir só a deste dia, ou esta e todas as seguintes?`,
                        { sim: "Esta e as seguintes", nao: "Só este dia" },
                      );

                      if (serie) {
                        startTransition(async () => {
                          const r = await excluirSerie(v.seriesId!, v.dia);
                          if (r.error) avisar(r.error);
                        });
                        return;
                      }
                    }

                    if (!(await confirmar(`Excluir o agendamento de ${v.empresa} em ${dia}?`)))
                      return;
                    startTransition(async () => {
                      const r = await excluirVisita(v.id);
                      if (r.error) avisar(r.error);
                    });
                  }}
                  className="shrink-0 text-slate-300 transition hover:text-red-600"
                  aria-label={`Excluir o agendamento de ${v.empresa}`}
                >
                  <Trash2 size={14} />
                </button>
                </div>

                {v.pauta.length > 0 || v.status === "AGENDADA" ? (
                  <div className="ml-6 sm:ml-[226px]">
                    <Pauta visita={v} />
                  </div>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
      </section>

      {reagendar ? (
        <Modal titulo="Reagendar" aoFechar={() => setReagendar(null)}>
          <ReagendarForm
            visita={reagendar}
            hoje={hoje}
            aoConcluir={() => setReagendar(null)}
          />
        </Modal>
      ) : null}

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
    "shrink-0 rounded-md border px-2 py-0.5 text-micro transition disabled:opacity-50";

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
          if (r.error) avisar(r.error);
          else if (r.id) router.push(`/empresas/${companyId}/reunioes/${r.id}`);
        })
      }
      className={`${classe} border-brand-300 bg-brand-50 font-medium text-brand-700 hover:bg-brand-100`}
    >
      {pendente ? "Criando…" : "Mandar para reunião"}
    </button>
  );
}
