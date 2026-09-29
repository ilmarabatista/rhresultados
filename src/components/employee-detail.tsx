"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  addRecord,
  createPlan,
  deleteEmployee,
  deletePlan,
  deleteRecord,
  togglePlanAction,
  type EquipeState,
} from "@/app/(app)/empresas/[id]/equipe/actions";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";
import EmployeeForm, { type ColaboradorDados } from "./employee-form";
import EmployeeExams, { type ExameDaFicha } from "./employee-exams";
import SkillAssessment from "./skill-assessment";

export type RegistroItem = {
  id: string;
  kind: string;
  data: string;
  fim: string | null;
  dias: number | null;
  description: string;
  severity: string | null;
  justified: boolean | null;
  autor: string | null;
};

export type PlanoItem = {
  id: string;
  titulo: string;
  objetivo: string | null;
  status: string;
  inicio: string | null;
  fim: string | null;
  acoes: { id: string; title: string; done: boolean }[];
};

const TIPOS = [
  { key: "OBSERVACAO", label: "Observação", cor: "bg-slate-100 text-slate-600" },
  { key: "ADVERTENCIA", label: "Advertência", cor: "bg-red-50 text-red-700" },
  { key: "FALTA", label: "Falta", cor: "bg-amber-50 text-amber-700" },
  { key: "ATESTADO", label: "Atestado", cor: "bg-sky-50 text-sky-700" },
];

const GRAVIDADE: Record<string, string> = {
  VERBAL: "verbal",
  ESCRITA: "escrita",
  SUSPENSAO: "suspensão",
};

function FormularioRegistro({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<EquipeState, FormData>(
    addRecord,
    {},
  );
  const [tipo, setTipo] = useState("OBSERVACAO");

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            Novo registro
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo *">
              <Select
                name="kind"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                {TIPOS.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={tipo === "ATESTADO" ? "Início *" : "Data *"}>
              <Input name="date" type="date" required />
            </Field>
          </div>

          {tipo === "ATESTADO" ? (
            <Field
              label="Fim do afastamento"
              hint="Deixe em branco se for de um dia só."
            >
              <Input name="endDate" type="date" />
            </Field>
          ) : null}

          {tipo === "ADVERTENCIA" ? (
            <Field label="Gravidade">
              <Select name="severity" defaultValue="VERBAL">
                <option value="VERBAL">Verbal</option>
                <option value="ESCRITA">Escrita</option>
                <option value="SUSPENSAO">Suspensão</option>
              </Select>
            </Field>
          ) : null}

          {tipo === "FALTA" ? (
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="justified"
                className="h-4 w-4 rounded border-slate-300 accent-brand-600"
              />
              Falta justificada / abonada
            </label>
          ) : null}

          <Field
            label="Descrição *"
            hint={
              tipo === "ATESTADO"
                ? "Registre o período e o encaminhamento. Não inclua diagnóstico nem CID."
                : undefined
            }
          >
            <Textarea name="description" rows={4} required />
          </Field>

          {tipo === "ATESTADO" ? (
            <p className="rounded-lg bg-sky-50 px-3 py-2.5 text-xs leading-relaxed text-sky-900">
              Atestado é dado de saúde. O sistema guarda período e afastamento —
              não guarde diagnóstico, CID ou detalhe clínico aqui.
            </p>
          ) : null}

          <FormError message={state.error} />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <SubmitButton pendingLabel="Registrando…">Registrar</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormularioPlano({
  employeeId,
  onClose,
}: {
  employeeId: string;
  onClose: () => void;
}) {
  const [state, formAction] = useActionState<EquipeState, FormData>(
    createPlan,
    {},
  );

  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Novo PDI</h3>
            <p className="text-xs text-slate-500">
              Plano de Desenvolvimento Individual.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 transition hover:text-slate-700"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        <form action={formAction} className="space-y-4">
          <input type="hidden" name="employeeId" value={employeeId} />

          <Field label="Nome do plano *">
            <Input
              name="title"
              required
              placeholder="Ex.: Desenvolvimento em atendimento ao cliente"
            />
          </Field>

          <Field label="Objetivo">
            <Textarea
              name="objective"
              rows={3}
              placeholder="O que se espera que a pessoa alcance ao fim do plano."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Início">
              <Input name="startDate" type="date" />
            </Field>
            <Field label="Prazo">
              <Input name="endDate" type="date" />
            </Field>
          </div>

          <Field label="Ações *" hint="Uma por linha, na ordem de execução.">
            <Textarea
              name="acoes"
              rows={7}
              required
              placeholder={
                "Participar do treinamento de atendimento\nAcompanhar um colega experiente por duas semanas\nApresentar o que aprendeu para a equipe"
              }
            />
          </Field>

          <FormError message={state.error} />

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </button>
            <SubmitButton pendingLabel="Criando…">Criar PDI</SubmitButton>
          </div>
        </form>
      </div>
    </div>
  );
}

function CardPlano({ plano }: { plano: PlanoItem }) {
  const [pending, startTransition] = useTransition();
  const [acoes, setAcoes] = useState(plano.acoes);

  const feitas = acoes.filter((a) => a.done).length;
  const pct = acoes.length ? Math.round((feitas / acoes.length) * 100) : 0;

  return (
    <section
      className={`overflow-hidden rounded-xl border border-slate-200 ${
        pending ? "opacity-60" : ""
      }`}
    >
      <div className="border-b border-slate-100 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-medium text-slate-800">
              {plano.titulo}
            </h4>
            {plano.objetivo ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {plano.objetivo}
              </p>
            ) : null}
            {plano.inicio || plano.fim ? (
              <p className="mt-1 text-[11px] text-slate-400">
                {plano.inicio ?? "—"} a {plano.fim ?? "—"}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-xs text-slate-500">
              {feitas}/{acoes.length}
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Excluir o PDI "${plano.titulo}"?`)) return;
                startTransition(() => {
                  void deletePlan(plano.id);
                });
              }}
              className="text-slate-300 transition hover:text-red-600"
              aria-label="Excluir PDI"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-emerald-500 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <ul className="divide-y divide-slate-50">
        {acoes.map((a) => (
          <li key={a.id} className="flex items-start gap-3 px-4 py-2">
            <input
              type="checkbox"
              checked={a.done}
              disabled={pending}
              onChange={() => {
                const novo = !a.done;
                setAcoes((atual) =>
                  atual.map((x) => (x.id === a.id ? { ...x, done: novo } : x)),
                );
                startTransition(() => {
                  void togglePlanAction(a.id, novo);
                });
              }}
              className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded border-slate-300 accent-brand-600"
              aria-label={a.title}
            />
            <span
              className={`text-sm leading-snug ${
                a.done ? "text-slate-400 line-through" : "text-slate-700"
              }`}
            >
              {a.title}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CardRegistro({ registro }: { registro: RegistroItem }) {
  const [pending, startTransition] = useTransition();
  const tipo = TIPOS.find((t) => t.key === registro.kind);

  return (
    <li className={`relative ${pending ? "opacity-60" : ""}`}>
      <span className="absolute -left-[21px] top-4 h-2 w-2 rounded-full bg-slate-300 ring-2 ring-white" />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
              tipo?.cor ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {tipo?.label ?? registro.kind}
            {registro.severity ? ` · ${GRAVIDADE[registro.severity]}` : ""}
          </span>

          {registro.justified === true ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
              justificada
            </span>
          ) : registro.justified === false ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
              não justificada
            </span>
          ) : null}

          <span className="text-xs text-slate-500">
            {registro.data}
            {registro.fim ? ` a ${registro.fim}` : ""}
            {registro.dias && registro.dias > 1 ? ` · ${registro.dias} dias` : ""}
          </span>

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm("Excluir este registro?")) return;
              startTransition(() => {
                void deleteRecord(registro.id);
              });
            }}
            className="ml-auto text-slate-300 transition hover:text-red-600"
            aria-label="Excluir registro"
          >
            <Trash2 size={14} />
          </button>
        </div>

        <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
          {registro.description}
        </p>

        {registro.autor ? (
          <p className="mt-1.5 text-[11px] text-slate-400">
            registrado por {registro.autor}
          </p>
        ) : null}
      </div>
    </li>
  );
}

export default function EmployeeDetail({
  companyId,
  unidades,
  pessoa,
  registros,
  planos,
  avaliacoes,
  exames,
  hoje,
}: {
  companyId: string;
  unidades: { id: string; nome: string }[];
  pessoa: ColaboradorDados & { unidade: string | null; admissao: string | null };
  registros: RegistroItem[];
  planos: PlanoItem[];
  avaliacoes: { id: string; data: string; temPlano: boolean }[];
  exames: ExameDaFicha[];
  hoje: string;
}) {
  const [editando, setEditando] = useState(false);
  const [novoRegistro, setNovoRegistro] = useState(false);
  const [novoPlano, setNovoPlano] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const contagem = TIPOS.map((t) => ({
    ...t,
    n: registros.filter((r) => r.kind === t.key).length,
  })).filter((t) => t.n > 0);

  return (
    <>
      <header className="mb-4 mt-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">
              {pessoa.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              {[pessoa.role, pessoa.department, pessoa.unidade]
                .filter(Boolean)
                .join(" · ") || "Sem cargo informado"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {[
                pessoa.status,
                pessoa.admissao ? `admitido em ${pessoa.admissao}` : null,
                pessoa.document,
                pessoa.email,
                pessoa.phone,
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              Editar cadastro
            </button>
          </div>
        </div>

        {pessoa.notes ? (
          <p className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-600">
            {pessoa.notes}
          </p>
        ) : null}

        {contagem.length > 0 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {contagem.map((t) => (
              <span
                key={t.key}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium ${t.cor}`}
              >
                {t.n} {t.label.toLowerCase()}
                {t.n > 1 && t.key !== "OBSERVACAO" ? "s" : ""}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <EmployeeExams
        companyId={companyId}
        employeeId={pessoa.id}
        cargo={pessoa.role}
        admissao={pessoa.hiredAt || null}
        exames={exames}
        hoje={hoje}
      />

      <SkillAssessment employeeId={pessoa.id} avaliacoes={avaliacoes} />

      <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Plano de Desenvolvimento Individual
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              O que a pessoa vai desenvolver, e o que já foi cumprido.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNovoPlano(true)}
            className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
          >
            + PDI
          </button>
        </div>

        {planos.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Nenhum PDI para esta pessoa.
          </p>
        ) : (
          <div className="space-y-3">
            {planos.map((p) => (
              <CardPlano key={p.id} plano={p} />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Linha do tempo
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Observações, advertências, faltas e atestados, do mais recente ao
              mais antigo.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setNovoRegistro(true)}
            className="shrink-0 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            + Registro
          </button>
        </div>

        {registros.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
            Nada registrado ainda.
          </p>
        ) : (
          <ul className="space-y-2 border-l-2 border-slate-200 pl-4">
            {registros.map((r) => (
              <CardRegistro key={r.id} registro={r} />
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8 rounded-lg border border-red-200 bg-red-50/40 p-4">
        <h2 className="text-sm font-semibold text-red-900">Zona de risco</h2>
        <p className="mt-1 max-w-2xl text-xs leading-relaxed text-red-800/80">
          Excluir o colaborador apaga junto os {registros.length} registro(s) da
          linha do tempo e {planos.length} PDI(s). Não há como desfazer.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !confirm(
                `Excluir ${pessoa.name} e todo o histórico dessa pessoa? Não há como desfazer.`,
              )
            )
              return;
            // A ficha deixa de existir: ficar nela era cair num 404.
            startTransition(async () => {
              await deleteEmployee(pessoa.id);
              router.push(`/empresas/${companyId}/equipe`);
            });
          }}
          className="mt-4 rounded-lg border border-red-300 bg-white px-4 py-2.5 text-sm font-medium text-red-700 transition hover:bg-red-50"
        >
          Excluir colaborador
        </button>
      </section>

      {editando ? (
        <EmployeeForm
          companyId={companyId}
          unidades={unidades}
          colaborador={pessoa}
          onClose={() => setEditando(false)}
        />
      ) : null}
      {novoRegistro ? (
        <FormularioRegistro
          employeeId={pessoa.id}
          onClose={() => setNovoRegistro(false)}
        />
      ) : null}
      {novoPlano ? (
        <FormularioPlano
          employeeId={pessoa.id}
          onClose={() => setNovoPlano(false)}
        />
      ) : null}
    </>
  );
}
