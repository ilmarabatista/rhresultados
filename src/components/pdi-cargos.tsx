"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import {
  copiarCompetencias,
  excluirCompetencia,
  moverCompetencia,
  salvarCompetencia,
  salvarDescricaoDoCargo,
  type PdiState,
} from "@/app/(app)/empresas/[id]/pdi/actions";
import { criarCargo } from "@/app/(app)/empresas/[id]/treinamentos/actions";
import { NIVEIS, ROTULO_DO_NIVEL, ROTULO_DO_TIPO, TIPOS_DE_COMPETENCIA, type TipoDeCompetencia } from "@/lib/pdi";
import { Field, FormError, FormOk, Input, Select, SubmitButton, Textarea } from "./form";
import { Etiqueta } from "./ui";
import { avisar, confirmar } from "@/components/avisos";

/**
 * As descrições de cargo da empresa: missão, responsabilidades, requisitos e
 * as competências com o nível que o cargo pede. É daqui que toda avaliação de
 * PDI tira a régua.
 */

type Competencia = {
  id: string;
  nome: string;
  tipo: TipoDeCompetencia;
  descricao: string;
  nivelEsperado: number;
};

type Cargo = {
  id: string;
  nome: string;
  pessoas: number;
  missao: string;
  responsabilidades: string;
  requisitos: string;
  competencias: Competencia[];
};

/** As comportamentais que aparecem em quase todo cargo: um clique e entram no formulário. */
const SUGESTOES = [
  "Comunicação",
  "Trabalho em equipe",
  "Organização e planejamento",
  "Proatividade",
  "Foco no cliente",
  "Resolução de problemas",
  "Adaptabilidade",
  "Inteligência emocional",
  "Liderança",
  "Responsabilidade e comprometimento",
];

const botaoClaro =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function Descricao({ cargo }: { cargo: Cargo }) {
  const [state, action] = useActionState<PdiState, FormData>(salvarDescricaoDoCargo, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="cargoId" value={cargo.id} />
      <Field label="Missão do cargo" hint="Para que o cargo existe, em uma ou duas frases.">
        <Textarea name="missao" rows={2} defaultValue={cargo.missao} />
      </Field>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Responsabilidades" hint="Uma por linha.">
          <Textarea name="responsabilidades" rows={6} defaultValue={cargo.responsabilidades} />
        </Field>
        <Field label="Requisitos" hint="Formação, experiência, conhecimentos.">
          <Textarea name="requisitos" rows={6} defaultValue={cargo.requisitos} />
        </Field>
      </div>
      <FormError message={state.error} />
      {state.ok ? <FormOk message="Descrição salva." /> : null}
      <div className="flex justify-end">
        <SubmitButton>Salvar descrição</SubmitButton>
      </div>
    </form>
  );
}

function FormularioDeCompetencia({
  cargoId,
  inicial,
  onFim,
}: {
  cargoId: string;
  inicial: Partial<Competencia> | null;
  onFim: () => void;
}) {
  const [state, action] = useActionState<PdiState, FormData>(salvarCompetencia, {});
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) {
      ref.current?.reset();
      onFim();
    }
  }, [state, onFim]);

  return (
    <form
      ref={ref}
      key={inicial?.id ?? inicial?.nome ?? "nova"}
      action={action}
      className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-3"
    >
      <input type="hidden" name="cargoId" value={cargoId} />
      {inicial?.id ? <input type="hidden" name="competenciaId" value={inicial.id} /> : null}
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
        <Field label="Competência *">
          <Input name="nome" required defaultValue={inicial?.nome ?? ""} placeholder="Ex.: Atendimento ao cliente" />
        </Field>
        <Field label="Tipo">
          <Select name="tipo" defaultValue={inicial?.tipo ?? "TECNICA"}>
            {TIPOS_DE_COMPETENCIA.map((t) => (
              <option key={t} value={t}>
                {ROTULO_DO_TIPO[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Nível que o cargo pede *">
          <Select name="nivelEsperado" defaultValue={String(inicial?.nivelEsperado ?? 3)}>
            {NIVEIS.map((n) => (
              <option key={n} value={n}>
                {n} · {ROTULO_DO_NIVEL[n]}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="O que se espera ver" hint="Comportamentos e entregas de quem domina a competência neste cargo.">
        <Textarea name="descricao" rows={2} defaultValue={inicial?.descricao ?? ""} />
      </Field>
      <FormError message={state.error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onFim} className={botaoClaro}>
          Cancelar
        </button>
        <SubmitButton>{inicial?.id ? "Salvar" : "Incluir competência"}</SubmitButton>
      </div>
    </form>
  );
}

function Competencias({ cargo, outros }: { cargo: Cargo; outros: Cargo[] }) {
  const [pending, startTransition] = useTransition();
  const [editando, setEditando] = useState<Partial<Competencia> | null | false>(false);
  const [origem, setOrigem] = useState("");
  const comCompetencias = outros.filter((c) => c.competencias.length > 0);
  const jaTem = new Set(cargo.competencias.map((c) => c.nome.toLowerCase()));

  return (
    <div className={pending ? "opacity-60" : ""}>
      {cargo.competencias.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-5 text-center text-sm text-slate-500">
          Nenhuma competência ainda. Inclua as técnicas (o que o cargo precisa saber fazer) e as comportamentais (como
          precisa agir).
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {cargo.competencias.map((c, i) => (
            <li key={c.id} className="group flex items-start gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-slate-800">{c.nome}</span>
                  <Etiqueta tom={c.tipo === "TECNICA" ? "azul" : "neutro"}>{ROTULO_DO_TIPO[c.tipo]}</Etiqueta>
                </div>
                {c.descricao ? <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{c.descricao}</p> : null}
              </div>
              <div className="shrink-0 text-right">
                <div className="flex gap-0.5" aria-label={`Nível ${c.nivelEsperado}`}>
                  {NIVEIS.map((n) => (
                    <span
                      key={n}
                      className={`h-2 w-4 rounded-sm ${n <= c.nivelEsperado ? "bg-brand-600" : "bg-slate-200"}`}
                    />
                  ))}
                </div>
                <span className="text-micro text-slate-500">{ROTULO_DO_NIVEL[c.nivelEsperado]}</span>
              </div>
              <div className="flex shrink-0 items-center gap-1 text-slate-500">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => startTransition(async () => void (await moverCompetencia(c.id, -1)))}
                  className="hover:text-brand-700 disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ArrowUp size={13} />
                </button>
                <button
                  type="button"
                  disabled={i === cargo.competencias.length - 1}
                  onClick={() => startTransition(async () => void (await moverCompetencia(c.id, 1)))}
                  className="hover:text-brand-700 disabled:opacity-30"
                  aria-label="Descer"
                >
                  <ArrowDown size={13} />
                </button>
                <button type="button" onClick={() => setEditando(c)} className="hover:text-brand-700" aria-label="Editar">
                  <Pencil size={13} />
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (await confirmar(`Tirar ${c.nome} do cargo? As avaliações já feitas continuam como estão.`))
                      startTransition(async () => void (await excluirCompetencia(c.id)));
                  }}
                  className="hover:text-red-600"
                  aria-label="Excluir"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        {editando !== false ? (
          <FormularioDeCompetencia cargoId={cargo.id} inicial={editando} onFim={() => setEditando(false)} />
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setEditando(null)} className={botaoClaro}>
              + Competência
            </button>
            {comCompetencias.length > 0 ? (
              <span className="flex items-center gap-1.5">
                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
                >
                  <option value="">Copiar de outro cargo…</option>
                  {comCompetencias.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({c.competencias.length})
                    </option>
                  ))}
                </select>
                {origem ? (
                  <button
                    type="button"
                    className={botaoClaro}
                    onClick={() =>
                      startTransition(async () => {
                        const r = await copiarCompetencias(cargo.id, origem);
                        if (r.error) avisar(r.error);
                        else avisar(`${r.copiadas} competência(s) copiada(s).`);
                        setOrigem("");
                      })
                    }
                  >
                    Copiar
                  </button>
                ) : null}
              </span>
            ) : null}
          </div>
        )}
        {editando === false ? (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-micro font-medium uppercase tracking-wider text-slate-500">Sugestões</span>
            {SUGESTOES.filter((s) => !jaTem.has(s.toLowerCase())).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setEditando({ nome: s, tipo: "COMPORTAMENTAL", nivelEsperado: 3 })}
                className="rounded-full border border-slate-200 px-2 py-0.5 text-micro text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
              >
                + {s}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PdiCargos({
  companyId,
  cargos,
  selecionado,
}: {
  companyId: string;
  cargos: Cargo[];
  selecionado: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [novo, setNovo] = useState("");
  const cargo = cargos.find((c) => c.id === selecionado) ?? cargos[0] ?? null;

  return (
    <div className="grid gap-3.5 lg:grid-cols-[15rem_minmax(0,1fr)]">
      <aside className="space-y-2">
        <nav className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {cargos.map((c) => (
            <Link
              key={c.id}
              href={`?aba=cargos&cargo=${c.id}`}
              className={`flex items-center justify-between gap-2 border-l-2 px-2.5 py-1.5 text-mini transition ${
                cargo?.id === c.id
                  ? "border-brand-600 bg-brand-50/60 font-semibold text-brand-800"
                  : "border-transparent text-slate-600 hover:bg-slate-50"
              }`}
            >
              <span className="truncate">{c.nome}</span>
              <span
                className={`shrink-0 text-micro ${c.competencias.length === 0 && c.pessoas > 0 ? "text-amber-700" : "text-slate-500"}`}
                title={`${c.competencias.length} competência(s), ${c.pessoas} pessoa(s)`}
              >
                {c.competencias.length === 0 ? "sem descrição" : `${c.competencias.length} comp.`}
              </span>
            </Link>
          ))}
          {cargos.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">Nenhum cargo ainda.</p> : null}
        </nav>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            startTransition(async () => {
              const r = await criarCargo(companyId, novo);
              if (r.error) avisar(r.error);
              else {
                setNovo("");
                router.push(`?aba=cargos&cargo=${r.id}`);
              }
            });
          }}
          className="flex gap-1.5"
        >
          <input
            value={novo}
            onChange={(e) => setNovo(e.target.value)}
            placeholder="Novo cargo"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
          />
          <button type="submit" disabled={pending} className={botaoClaro}>
            +
          </button>
        </form>
      </aside>

      {cargo ? (
        <div key={cargo.id} className="space-y-3.5">
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">{cargo.nome}</h2>
              <span className="text-xs text-slate-500">{cargo.pessoas} pessoa(s) neste cargo</span>
            </div>
            <Descricao cargo={cargo} />
          </section>
          <section className="rounded-lg border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">Competências e nível esperado</h3>
            <p className="mb-3 mt-0.5 text-xs text-slate-500">
              A régua da avaliação. Escala: 1 não conhece · 2 conhece, precisa de ajuda · 3 faz sozinho · 4 faz com
              excelência · 5 ensina os outros.
            </p>
            <Competencias cargo={cargo} outros={cargos.filter((c) => c.id !== cargo.id)} />
          </section>
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Crie o primeiro cargo ao lado.
        </p>
      )}
    </div>
  );
}
