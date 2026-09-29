"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  adicionarParticipante,
  convocarGrupo,
  marcarPresenca,
  marcarTodosPresentes,
  arquivarReuniao,
  encerrarReuniao,
  excluirItem,
  excluirReuniao,
  marcarCombinado,
  mudarCampoDaReuniao,
  mudarDataDaReuniao,
  removerParticipante,
  salvarItem,
  type CampoDaReuniao,
  type ReuniaoState,
} from "@/app/(app)/empresas/[id]/reunioes/actions";
import {
  ROTULO_DA_SITUACAO,
  situacaoDoCombinado,
  type SituacaoDaReuniao,
  type SituacaoDoCombinado,
  type TipoDeItem,
} from "@/lib/reunioes";
import type { OpcoesDaReuniao } from "@/lib/reunioes-dados";
import { SmallSubmitButton } from "./form";
import MeetingSlides, { type Apresentacao } from "./meeting-slides";

/**
 * A página de uma reunião, no jeito de uma folha: o título e quando no alto, o
 * produto, o setor e quem participa; embaixo a apresentação usada, a pauta —
 * escrita antes — e a ata, escrita depois: o conversado, o decidido e o
 * combinado.
 *
 * É a mesma página para a reunião criada à mão e para a de um plano ou do
 * calendário de cultura. Na de plano aparece também o "passar para a próxima
 * data".
 *
 * Tudo se escreve ali mesmo: os campos gravam ao sair deles, e cada parte da
 * ata tem o seu "+".
 */

export type ItemDaAta = {
  id: string;
  tipo: TipoDeItem;
  texto: string;
  porque: string | null;
  /** "AAAA-MM-DD". */
  valeDesde: string | null;
  responsavel: string | null;
  /** "AAAA-MM-DD". */
  prazo: string | null;
  feito: boolean;
};

export type ReuniaoCompleta = {
  id: string;
  codigo: string;
  titulo: string;
  /** "AAAA-MM-DD", ou nulo quando está a agendar. */
  dia: string | null;
  hora: string | null;
  situacao: SituacaoDaReuniao;
  /** O produto a que a reunião se refere. */
  produtoId: string | null;
  setor: string | null;
  unidadeId: string | null;
  tipo: string | null;
  local: string | null;
  pauta: string;
  /** Quando a reunião é de um plano ou do calendário de cultura. */
  plano: {
    nome: string;
    produto: string | null;
    entregaHref: string;
    /** Tem compromisso na agenda: só assim dá para encerrar. */
    naAgenda: boolean;
  } | null;
  apresentacoes: Apresentacao[];
  participantes: { id: string; nome: string; presente: boolean }[];
  itens: ItemDaAta[];
};

const escrito = (dia: string) => dia.split("-").reverse().join("/");

const campo =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] outline-none transition focus:border-brand-500";
const rotuloMiudo = "text-[10px] font-semibold uppercase tracking-wider text-slate-500";

function avisarSeErro(r: ReuniaoState) {
  if (r.error) alert(r.error);
}

// ----------------------------------------------------------- campo que grava

/** Um texto que grava ao sair dele, quando mudou. */
function TextoAoSair({
  valor,
  salvar,
  className,
  placeholder,
  linhas,
  list,
  id,
  mostrarSituacao = false,
}: {
  valor: string;
  salvar: (texto: string) => Promise<ReuniaoState>;
  className: string;
  placeholder?: string;
  /** Com linhas, vira caixa de texto. */
  linhas?: number;
  list?: string;
  id?: string;
  mostrarSituacao?: boolean;
}) {
  const [texto, setTexto] = useState(valor);
  const [situacao, setSituacao] = useState<"" | "gravando" | "gravado">("");
  const [, startTransition] = useTransition();

  useEffect(() => setTexto(valor), [valor]);

  const sair = () => {
    if (texto === valor) return;
    setSituacao("gravando");
    startTransition(async () => {
      const r = await salvar(texto);
      if (r.error) {
        alert(r.error);
        setTexto(valor);
        setSituacao("");
      } else {
        setSituacao("gravado");
      }
    });
  };

  return (
    <>
      {linhas ? (
        <textarea
          value={texto}
          rows={linhas}
          placeholder={placeholder}
          onChange={(e) => {
            setTexto(e.target.value);
            setSituacao("");
          }}
          onBlur={sair}
          className={className}
        />
      ) : (
        <input
          id={id}
          value={texto}
          placeholder={placeholder}
          list={list}
          onChange={(e) => {
            setTexto(e.target.value);
            setSituacao("");
          }}
          onBlur={sair}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className={className}
        />
      )}
      {mostrarSituacao && situacao ? (
        <span className="text-[10px] text-slate-400">{situacao === "gravando" ? "gravando…" : "gravado"}</span>
      ) : null}
    </>
  );
}

// --------------------------------------------------------------- quando

function Quando({ reuniao }: { reuniao: ReuniaoCompleta }) {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [aAgendar, setAAgendar] = useState(!reuniao.dia);
  const [state, action] = useActionState<ReuniaoState, FormData>(mudarDataDaReuniao, {});

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  const doPlano = reuniao.plano !== null;
  const texto = reuniao.dia
    ? `${ROTULO_DA_SITUACAO[reuniao.situacao]} · ${escrito(reuniao.dia)}${reuniao.hora ? ` às ${reuniao.hora}` : ""}`
    : `${reuniao.situacao === "AGENDADA" ? "A agendar" : ROTULO_DA_SITUACAO[reuniao.situacao]} · sem data`;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-slate-700 transition hover:text-brand-700"
      >
        {texto} <Pencil size={11} className="text-slate-400" />
      </button>

      {aberto ? (
        <div className="absolute right-0 top-full z-20 mt-1 w-64 space-y-2 rounded-lg border border-slate-200 bg-white p-3 shadow-xl">
          <form action={action} className="space-y-2">
            <input type="hidden" name="reuniaoId" value={reuniao.id} />
            {doPlano ? (
              <p className="text-[10px] leading-snug text-slate-500">
                Muda só esta data; as outras reuniões do plano ficam como estão.
              </p>
            ) : null}
            <div className="flex gap-2">
              <input
                type="date"
                name="dia"
                defaultValue={reuniao.dia ?? ""}
                disabled={aAgendar}
                className={`${campo} min-w-0 flex-1`}
              />
              <input
                type="time"
                name="hora"
                defaultValue={reuniao.hora ?? "08:00"}
                disabled={aAgendar}
                className={`${campo} w-24`}
              />
            </div>
            {doPlano ? null : (
              <label className="flex items-center gap-1.5 text-[11px] text-slate-600">
                <input
                  type="checkbox"
                  name="aAgendar"
                  checked={aAgendar}
                  onChange={(e) => setAAgendar(e.target.checked)}
                  className="h-3.5 w-3.5 accent-brand-600"
                />
                A agendar (ainda sem data)
              </label>
            )}
            {state.error ? <p className="text-[11px] text-red-600">{state.error}</p> : null}
            <div className="flex items-center gap-2">
              <SmallSubmitButton pendingLabel="Gravando…">Salvar</SmallSubmitButton>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="text-[11px] text-slate-500 transition hover:text-slate-800"
              >
                cancelar
              </button>
            </div>
          </form>

        </div>
      ) : null}
    </div>
  );
}

// -------------------------------------------------------------- participantes

function Participantes({
  reuniao,
  pessoas,
}: {
  reuniao: ReuniaoCompleta;
  pessoas: OpcoesDaReuniao["pessoas"];
}) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [pending, startTransition] = useTransition();
  const caixa = useRef<HTMLDivElement>(null);

  // Clicar fora fecha a lista.
  useEffect(() => {
    if (!aberto) return;
    const fechar = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fechar);
    return () => document.removeEventListener("mousedown", fechar);
  }, [aberto]);

  const jaEstao = new Set(reuniao.participantes.map((p) => p.nome.toLowerCase()));
  const busca = nome.trim().toLowerCase();
  const sugestoes = pessoas
    .filter((p) => !jaEstao.has(p.nome.toLowerCase()))
    .filter((p) => !busca || p.nome.toLowerCase().includes(busca) || (p.setor ?? "").toLowerCase().includes(busca))
    .slice(0, 8);

  // Os setores da equipe, com quantas pessoas cada um tem, para convocar de uma vez.
  const porSetor = new Map<string, number>();
  for (const p of pessoas) if (p.setor) porSetor.set(p.setor, (porSetor.get(p.setor) ?? 0) + 1);
  const setores = [...porSetor].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  const presentes = reuniao.participantes.filter((p) => p.presente).length;
  const todosPresentes = presentes === reuniao.participantes.length;

  const convocar = (employeeId: string | null, quem: string) =>
    startTransition(async () => {
      const r = await adicionarParticipante(reuniao.id, employeeId, quem);
      if (r.error) alert(r.error);
      else setNome("");
    });

  const convocarTodos = (setor: string | null) =>
    startTransition(async () => {
      const r = await convocarGrupo(reuniao.id, setor);
      if (r.error) alert(r.error);
      else setAberto(false);
    });

  return (
    <div>
      <div className="flex flex-wrap items-baseline gap-2">
        <p className={rotuloMiudo}>Convocados</p>
        {reuniao.participantes.length > 0 ? (
          <>
            <span className="text-[11px] text-slate-500">
              {presentes} de {reuniao.participantes.length} presente{reuniao.participantes.length === 1 ? "" : "s"}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => avisarSeErro(await marcarTodosPresentes(reuniao.id, !todosPresentes)))}
              className="text-[11px] text-brand-700 transition hover:text-brand-900"
            >
              {todosPresentes ? "desmarcar todos" : "marcar todos presentes"}
            </button>
          </>
        ) : null}
      </div>
      {reuniao.participantes.length > 0 ? (
        <p className="text-[10px] text-slate-400">Clique no nome para marcar que a pessoa estava presente.</p>
      ) : null}
      <div className={`mt-1 flex flex-wrap items-center gap-1.5 ${pending ? "opacity-60" : ""}`}>
        {reuniao.participantes.map((p) => (
          <span
            key={p.id}
            className={`inline-flex items-center gap-0.5 rounded-full py-0.5 pl-1 pr-1 text-[12px] transition ${
              p.presente ? "bg-emerald-100 text-emerald-900" : "bg-slate-100 text-slate-700"
            }`}
          >
            <button
              type="button"
              onClick={() => startTransition(async () => avisarSeErro(await marcarPresenca(p.id, !p.presente)))}
              className="inline-flex items-center gap-1 rounded-full px-1"
              title={p.presente ? "Presente — clique para desmarcar" : "Convocado — clique para marcar presente"}
            >
              <span
                className={`flex h-3.5 w-3.5 items-center justify-center rounded-full border ${
                  p.presente ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400 bg-white"
                }`}
              >
                {p.presente ? <Check size={9} /> : null}
              </span>
              {p.nome}
            </button>
            <button
              type="button"
              onClick={() => startTransition(async () => avisarSeErro(await removerParticipante(p.id)))}
              className="rounded-full p-0.5 text-slate-400 transition hover:text-red-600"
              aria-label={`Tirar ${p.nome}`}
            >
              <X size={11} />
            </button>
          </span>
        ))}

        <div ref={caixa} className="relative">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-400 text-slate-500 transition hover:border-brand-400 hover:text-brand-700"
            aria-label="Convocar participante"
          >
            <Plus size={12} />
          </button>

          {aberto ? (
            <div className="absolute left-0 top-full z-20 mt-1 w-72 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
              {pessoas.length > 0 ? (
                <div className="mb-2 border-b border-slate-100 pb-2">
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">Convocar de uma vez</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <button
                      type="button"
                      onClick={() => convocarTodos(null)}
                      className="rounded-md bg-brand-700 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-brand-800"
                    >
                      Toda a equipe ({pessoas.length})
                    </button>
                    {setores.map(([setor, n]) => (
                      <button
                        key={setor}
                        type="button"
                        onClick={() => convocarTodos(setor)}
                        className="rounded-md border border-slate-300 px-2 py-1 text-[11px] text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
                      >
                        {setor} ({n})
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (nome.trim()) convocar(null, nome.trim());
                }}
              >
                <input
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Buscar uma pessoa ou escrever o nome"
                  className={`${campo} w-full`}
                />
              </form>
              {sugestoes.length > 0 ? (
                <ul className="mt-1 max-h-48 overflow-y-auto">
                  {sugestoes.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => convocar(p.id, p.nome)}
                        className="block w-full truncate rounded px-2 py-1 text-left text-[12px] text-slate-700 transition hover:bg-brand-50"
                      >
                        {p.nome}
                        {p.setor ? <span className="text-slate-400"> · {p.setor}</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="mt-1 px-1 text-[10px] text-slate-400">Enter convoca um nome que não está na equipe.</p>
            </div>
          ) : null}
        </div>

        {reuniao.participantes.length === 0 ? (
          <span className="text-[12px] text-slate-400">ninguém convocado</span>
        ) : null}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ a ata

const PARTES: { tipo: TipoDeItem; rotulo: string; dica: string; cor: string }[] = [
  { tipo: "CONVERSADO", rotulo: "Conversado", dica: "contexto, sem responsável nem prazo", cor: "bg-slate-400" },
  { tipo: "DECIDIDO", rotulo: "Decidido", dica: "vale desde quando e por quê", cor: "bg-slate-900" },
  { tipo: "COMBINADO", rotulo: "Combinado", dica: "um responsável, uma data", cor: "bg-brand-500" },
];

const PRAZO: Record<SituacaoDoCombinado, { cor: string; texto: (prazo: string | null) => string }> = {
  FEITO: { cor: "text-emerald-600", texto: () => "feito" },
  ATRASADO: { cor: "text-red-600", texto: (p) => `atrasado · era até ${escrito(p!)}` },
  HOJE: { cor: "text-amber-700", texto: () => "é hoje" },
  NO_PRAZO: { cor: "text-slate-500", texto: (p) => `até ${escrito(p!)}` },
  SEM_DATA: { cor: "text-amber-700", texto: () => "sem data — combine um prazo" },
};

function FormularioDoItem({
  reuniaoId,
  tipo,
  item,
  hoje,
  aoFechar,
}: {
  reuniaoId: string;
  tipo: TipoDeItem;
  item?: ItemDaAta;
  hoje: string;
  aoFechar: () => void;
}) {
  const [state, action] = useActionState<ReuniaoState, FormData>(salvarItem, {});

  // Corrigindo, o formulário fecha ao gravar. Registrando, fica aberto e limpo
  // para o próximo — a ata costuma ter vários itens seguidos.
  useEffect(() => {
    if (state.ok && item) aoFechar();
  }, [state, item, aoFechar]);

  return (
    <form
      action={action}
      className="mt-1.5 space-y-1.5 rounded-lg border border-brand-200 bg-brand-50/40 p-2"
    >
      <input type="hidden" name="reuniaoId" value={reuniaoId} />
      <input type="hidden" name="tipo" value={tipo} />
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}

      <textarea
        name="texto"
        required
        rows={2}
        autoFocus
        defaultValue={item?.texto}
        placeholder={
          tipo === "CONVERSADO"
            ? "O que foi conversado"
            : tipo === "DECIDIDO"
              ? "O que foi decidido"
              : "O que ficou combinado"
        }
        className={`${campo} w-full`}
      />

      {tipo === "DECIDIDO" ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1 text-[11px] text-slate-500">
            vale desde
            <input type="date" name="valeDesde" defaultValue={item ? (item.valeDesde ?? "") : hoje} className={campo} />
          </label>
          <input
            name="porque"
            defaultValue={item?.porque ?? ""}
            placeholder="Por quê"
            className={`${campo} min-w-[12rem] flex-1`}
          />
        </div>
      ) : null}

      {tipo === "COMBINADO" ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            name="responsavel"
            list="responsaveis-da-reuniao"
            defaultValue={item?.responsavel ?? ""}
            placeholder="Responsável"
            className={`${campo} min-w-[10rem] flex-1`}
          />
          <label className="flex items-center gap-1 text-[11px] text-slate-500">
            até
            <input type="date" name="prazo" defaultValue={item?.prazo ?? ""} className={campo} />
          </label>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <SmallSubmitButton pendingLabel="Gravando…">{item ? "Salvar" : "Registrar"}</SmallSubmitButton>
        <button
          type="button"
          onClick={aoFechar}
          className="text-[11px] text-slate-500 transition hover:text-slate-800"
        >
          {item ? "cancelar" : "fechar"}
        </button>
        {state.error ? <span className="text-[11px] text-red-600">{state.error}</span> : null}
      </div>
    </form>
  );
}

function LinhaDoItem({
  reuniaoId,
  item,
  hoje,
}: {
  reuniaoId: string;
  item: ItemDaAta;
  hoje: string;
}) {
  const [editando, setEditando] = useState(false);
  const [pending, startTransition] = useTransition();

  if (editando) {
    return (
      <li>
        <FormularioDoItem
          reuniaoId={reuniaoId}
          tipo={item.tipo}
          item={item}
          hoje={hoje}
          aoFechar={() => setEditando(false)}
        />
      </li>
    );
  }

  const combinado = item.tipo === "COMBINADO";
  const prazo = combinado ? situacaoDoCombinado({ feito: item.feito, prazo: item.prazo }, hoje) : null;

  return (
    <li
      className={`group flex items-start gap-2 rounded px-1 py-1 transition hover:bg-slate-50 ${
        pending ? "opacity-60" : ""
      }`}
    >
      {combinado ? (
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => avisarSeErro(await marcarCombinado(item.id, !item.feito)))}
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
            item.feito ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-400 hover:border-emerald-500"
          }`}
          aria-label={item.feito ? "Reabrir o combinado" : "Marcar o combinado como feito"}
        >
          {item.feito ? <Check size={11} strokeWidth={3} /> : null}
        </button>
      ) : (
        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-slate-300" />
      )}

      <div className="min-w-0 flex-1">
        <p
          className={`whitespace-pre-wrap text-[13px] leading-snug ${
            item.feito ? "text-slate-400 line-through" : "text-slate-700"
          }`}
        >
          {item.texto}
        </p>

        {item.tipo === "DECIDIDO" && (item.valeDesde || item.porque) ? (
          <p className="text-[11px] text-slate-500">
            {[item.valeDesde ? `vale desde ${escrito(item.valeDesde)}` : null, item.porque ? `por quê: ${item.porque}` : null]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}

        {prazo ? (
          <p className="flex flex-wrap gap-x-2 text-[11px]">
            <span className="text-slate-600">{item.responsavel || "sem responsável"}</span>
            <span className={PRAZO[prazo].cor}>{PRAZO[prazo].texto(item.prazo)}</span>
          </p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1.5 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
        <button
          type="button"
          onClick={() => setEditando(true)}
          className="text-slate-300 transition hover:text-slate-700"
          aria-label="Corrigir"
        >
          <Pencil size={12} />
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (!confirm("Apagar este registro da ata?")) return;
            startTransition(async () => avisarSeErro(await excluirItem(item.id)));
          }}
          className="text-slate-300 transition hover:text-red-600"
          aria-label="Apagar"
        >
          <Trash2 size={12} />
        </button>
      </div>
    </li>
  );
}

function ParteDaAta({
  reuniaoId,
  parte,
  itens,
  hoje,
}: {
  reuniaoId: string;
  parte: (typeof PARTES)[number];
  itens: ItemDaAta[];
  hoje: string;
}) {
  const [registrando, setRegistrando] = useState(false);

  return (
    <div className="border-b border-slate-100 py-2.5 last:border-b-0">
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${parte.cor}`} />
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-800">{parte.rotulo}</h3>
        <span className="text-[11px] tabular-nums text-slate-400">{itens.length}</span>
        <span className="text-[11px] text-slate-400">· {parte.dica}</span>
        <button
          type="button"
          onClick={() => setRegistrando((v) => !v)}
          className="ml-auto text-slate-400 transition hover:text-brand-700"
          aria-label={registrando ? "Fechar" : `Registrar ${parte.rotulo.toLowerCase()}`}
        >
          {registrando ? <X size={15} /> : <Plus size={15} />}
        </button>
      </div>

      <div className="pl-4">
        {registrando ? (
          <FormularioDoItem
            reuniaoId={reuniaoId}
            tipo={parte.tipo}
            hoje={hoje}
            aoFechar={() => setRegistrando(false)}
          />
        ) : null}

        {itens.length === 0 && !registrando ? (
          <p className="mt-1 text-[12px] text-slate-400">Nada registrado.</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {itens.map((i) => (
              <LinhaDoItem key={i.id} reuniaoId={reuniaoId} item={i} hoje={hoje} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- a página

function CabecalhoDaParte({ titulo, dica }: { titulo: string; dica: string }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-2 border-b border-slate-300 pb-1">
      <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
      <span className="text-[10px] uppercase tracking-wider text-slate-400">{dica}</span>
    </div>
  );
}

export default function MeetingRecord({
  companyId,
  reuniao,
  opcoes,
  hoje,
}: {
  companyId: string;
  reuniao: ReuniaoCompleta;
  opcoes: OpcoesDaReuniao;
  hoje: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const mudar = (qual: CampoDaReuniao) => (valor: string) => mudarCampoDaReuniao(reuniao.id, qual, valor);
  const escolher = (qual: CampoDaReuniao, valor: string) =>
    startTransition(async () => avisarSeErro(await mudarCampoDaReuniao(reuniao.id, qual, valor)));

  const plano = reuniao.plano;
  // O encontro do plano sendo preparado: fica fora da aba Reuniões até ir para reunião.
  const emPreparacao = reuniao.situacao === "PLANEJADA";
  const produto = opcoes.produtos.find((p) => p.id === reuniao.produtoId) ?? null;
  const unidade = opcoes.unidades.find((u) => u.id === reuniao.unidadeId)?.nome ?? "Rede";
  const setorNoTitulo =
    reuniao.setor && !reuniao.titulo.toLowerCase().includes(reuniao.setor.toLowerCase());

  // Os setores cadastrados na Equipe. O setor desta reunião entra mesmo que não
  // exista mais lá: senão, abrir a reunião apagaria o que estava escrito.
  const setores = [
    ...new Set([...opcoes.setores, ...(reuniao.setor ? [reuniao.setor] : [])]),
  ].sort((a, b) => a.localeCompare(b, "pt-BR"));

  // Quem pode ser responsável: quem participa, a equipe e a consultoria, sem repetir.
  const responsaveis = [
    ...new Set([
      ...reuniao.participantes.map((p) => p.nome),
      ...opcoes.pessoas.map((p) => p.nome),
      ...opcoes.consultores,
    ]),
  ];

  return (
    <main className="space-y-5">
      <datalist id="responsaveis-da-reuniao">
        {responsaveis.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        {emPreparacao ? (
          <Link href={`/empresas/${companyId}/planejamento`} className="text-slate-500 transition hover:text-slate-900">
            ← Planejamento
          </Link>
        ) : (
          <Link href={`/empresas/${companyId}/reunioes`} className="text-slate-500 transition hover:text-slate-900">
            ← Reuniões
          </Link>
        )}
        {plano ? (
          <Link href={plano.entregaHref} className="text-brand-700 transition hover:text-brand-800">
            {plano.produto ?? "Planejamento"} · plano {plano.nome} ›
          </Link>
        ) : null}
      </div>

      {emPreparacao ? (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] text-sky-800">
          Em preparação no plano. Tudo o que escrever aqui (pauta, participantes, apresentação) segue junto quando o
          encontro for para a agenda e, lá, para reunião; só então ele aparece na aba Reuniões.
        </p>
      ) : null}

      <header className="space-y-3 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <TextoAoSair
                id="nome-da-reuniao"
                valor={reuniao.titulo}
                salvar={mudar("titulo")}
                mostrarSituacao
                className="min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 text-xl font-semibold tracking-tight text-slate-900 outline-none transition hover:border-slate-300 focus:border-brand-400 focus:bg-white"
              />
              {/* O nome já se edita clicando nele; o botão deixa isso à vista. */}
              <button
                type="button"
                onClick={() => {
                  const campo = document.getElementById("nome-da-reuniao") as HTMLInputElement | null;
                  campo?.focus();
                  campo?.select();
                }}
                className="no-print inline-flex shrink-0 items-center gap-1 self-center rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
              >
                <Pencil size={11} /> Editar nome
              </button>
              {setorNoTitulo ? (
                <span className="shrink-0 text-xl font-semibold tracking-tight text-brand-700">{reuniao.setor}</span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500">
              {[
                reuniao.codigo,
                produto?.nome,
                reuniao.setor,
                reuniao.dia ? `${escrito(reuniao.dia)}${reuniao.hora ? ` às ${reuniao.hora}` : ""}` : "a agendar",
                unidade,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <div className={`flex flex-wrap items-center gap-3 ${pending ? "opacity-60" : ""}`}>
            <Quando reuniao={reuniao} />
            {reuniao.situacao === "AGENDADA" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => avisarSeErro(await encerrarReuniao(reuniao.id, true)))}
                className="rounded-md bg-slate-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-slate-700"
              >
                Encerrar reunião
              </button>
            ) : null}
            {reuniao.situacao === "REALIZADA" ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => avisarSeErro(await encerrarReuniao(reuniao.id, false)))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
              >
                Reabrir
              </button>
            ) : null}
            {plano ? null : (
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(async () =>
                    avisarSeErro(await arquivarReuniao(reuniao.id, reuniao.situacao !== "ARQUIVADA")),
                  )
                }
                className="text-[11px] text-slate-400 transition hover:text-slate-700"
              >
                {reuniao.situacao === "ARQUIVADA" ? "Desarquivar" : "Arquivar"}
              </button>
            )}
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const pergunta = plano
                  ? `Tirar a reunião ${reuniao.codigo} do plano e da agenda, com a pauta e a ata?`
                  : `Excluir a reunião ${reuniao.codigo}, com a pauta e a ata?`;
                if (!confirm(pergunta)) return;
                startTransition(async () => {
                  const r = await excluirReuniao(reuniao.id);
                  if (r.error) alert(r.error);
                  else router.push(`/empresas/${companyId}/${emPreparacao ? "planejamento" : "reunioes"}`);
                });
              }}
              className="inline-flex items-center gap-1 text-[11px] text-slate-400 transition hover:text-red-600"
            >
              <Trash2 size={12} /> Excluir
            </button>
          </div>
        </div>

        <div className={`flex flex-wrap items-center gap-x-6 gap-y-2 ${pending ? "opacity-60" : ""}`}>
          <label className="flex items-center gap-2">
            <span className={rotuloMiudo}>Produto</span>
            <select
              value={reuniao.produtoId ?? ""}
              onChange={(e) => escolher("produto", e.target.value)}
              className={`${campo} max-w-[14rem]`}
              title={produto?.nomeCompleto}
            >
              <option value="">Sem produto</option>
              {opcoes.produtos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nomeCompleto}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className={rotuloMiudo}>Setor</span>
            <select
              value={reuniao.setor ?? ""}
              onChange={(e) => escolher("setor", e.target.value)}
              className={`${campo} w-44`}
              title={opcoes.setores.length === 0 ? "Os setores vêm da aba Equipe." : undefined}
            >
              <option value="">Sem setor</option>
              {setores.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          {opcoes.unidades.length > 0 ? (
            <div className="flex items-center gap-2">
              <span className={rotuloMiudo}>Unidade</span>
              <span className="flex flex-wrap gap-1">
                {[{ id: "", nome: "Rede" }, ...opcoes.unidades].map((u) => {
                  const ativa = (reuniao.unidadeId ?? "") === u.id;
                  return (
                    <button
                      key={u.id || "rede"}
                      type="button"
                      title={u.nome}
                      onClick={() => !ativa && escolher("unidade", u.id)}
                      className={`max-w-[8rem] truncate rounded-md border px-2 py-0.5 text-[11px] font-medium transition ${
                        ativa ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-600 hover:border-brand-300"
                      }`}
                    >
                      {u.nome}
                    </button>
                  );
                })}
              </span>
            </div>
          ) : null}

          <label className="flex items-center gap-2">
            <span className={rotuloMiudo}>Tipo</span>
            <TextoAoSair
              valor={reuniao.tipo ?? ""}
              salvar={mudar("tipo")}
              placeholder="Equipe · Gestores…"
              className={`${campo} w-36`}
            />
          </label>

          <label className="flex items-center gap-2">
            <span className={rotuloMiudo}>Local</span>
            <TextoAoSair
              valor={reuniao.local ?? ""}
              salvar={mudar("local")}
              placeholder="Sala da gestão · Zoom…"
              className={`${campo} w-40`}
            />
          </label>
        </div>

        <Participantes reuniao={reuniao} pessoas={opcoes.pessoas} />
      </header>

      <section className="space-y-1.5">
        <CabecalhoDaParte titulo="Apresentação usada" dica="o slide que você apresentou nesta reunião" />
        <div className="pt-1">
          <MeetingSlides reuniaoId={reuniao.id} arquivos={reuniao.apresentacoes} />
        </div>
      </section>

      <section className="space-y-1.5">
        <CabecalhoDaParte titulo="Pauta" dica="escrita antes · vai enchendo durante a semana" />
        <TextoAoSair
          valor={reuniao.pauta}
          salvar={mudar("pauta")}
          // Cresce com a pauta: uma pauta de mês inteiro não cabe em 4 linhas.
          linhas={Math.min(30, Math.max(4, reuniao.pauta.split("\n").length + 1))}
          placeholder="O que vai ser conversado."
          mostrarSituacao
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-slate-700 outline-none transition focus:border-brand-400"
        />
      </section>

      <section>
        <CabecalhoDaParte titulo="Ata" dica="conversado · decidido · combinado" />
        {PARTES.map((parte) => (
          <ParteDaAta
            key={parte.tipo}
            reuniaoId={reuniao.id}
            parte={parte}
            itens={reuniao.itens.filter((i) => i.tipo === parte.tipo)}
            hoje={hoje}
          />
        ))}
      </section>
    </main>
  );
}
