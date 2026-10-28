"use client";

import { excluirComPermissao } from "@/components/com-permissao";
import { useActionState, useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  addRecord,
  definirAtivo,
  deleteEmployee,
  deleteRecord,
  type EquipeState,
} from "@/app/(app)/empresas/[id]/equipe/actions";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";
import EmployeeForm, { type ColaboradorDados } from "./employee-form";
import EmployeeExams, { type ExameDaFicha } from "./employee-exams";
import { confirmar } from "@/components/avisos";
import { foraDoPdi } from "@/lib/prestadores";

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

/** O resumo do PDI na ficha; o PDI inteiro mora na aba PDI. */
export type ResumoDoPdi = {
  titulo: string;
  progresso: number | null;
  metas: number;
  atingidas: number;
  proxima: string | null;
  atrasada: boolean;
} | null;

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
            className="text-slate-500 transition hover:text-slate-700"
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

function CardRegistro({ registro }: { registro: RegistroItem }) {
  const [pending, startTransition] = useTransition();
  const tipo = TIPOS.find((t) => t.key === registro.kind);

  return (
    <li className={`relative ${pending ? "opacity-60" : ""}`}>
      <span className="absolute -left-[21px] top-4 h-2 w-2 rounded-full bg-slate-300 ring-2 ring-white" />
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded px-1.5 py-0.5 text-micro font-medium ${
              tipo?.cor ?? "bg-slate-100 text-slate-600"
            }`}
          >
            {tipo?.label ?? registro.kind}
            {registro.severity ? ` · ${GRAVIDADE[registro.severity]}` : ""}
          </span>

          {registro.justified === true ? (
            <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-micro font-medium text-emerald-700">
              justificada
            </span>
          ) : registro.justified === false ? (
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-micro font-medium text-slate-600">
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
            onClick={async () => {
              if (!(await confirmar("Excluir este registro?"))) return;
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
          <p className="mt-1.5 text-micro text-slate-500">
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
  cargos,
  treinamento,
  mapeamento,
  pessoa,
  registros,
  pdi,
  planosConcluidos,
  avaliadaEm,
  exames,
  hoje,
}: {
  companyId: string;
  unidades: { id: string; nome: string }[];
  cargos: { id: string; nome: string }[];
  /** Integração e treinamentos, montados pela página. */
  treinamento: ReactNode;
  /** Os mapeamentos de rotinas, montados pela página. */
  mapeamento?: ReactNode;
  pessoa: ColaboradorDados & { unidade: string | null; admissao: string | null };
  registros: RegistroItem[];
  pdi: ResumoDoPdi;
  planosConcluidos: number;
  avaliadaEm: string | null;
  exames: ExameDaFicha[];
  hoje: string;
}) {
  const [editando, setEditando] = useState(false);
  const [novoRegistro, setNovoRegistro] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const desativado = pessoa.status === "DESLIGADO";

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
              {pessoa.role ? (
                pessoa.cargoId ? (
                  <Link
                    href={`/empresas/${companyId}/cargos?cargo=${pessoa.cargoId}`}
                    className="text-brand-700 underline-offset-2 hover:underline"
                    title="Ver a descrição do cargo"
                  >
                    {pessoa.role}
                  </Link>
                ) : (
                  pessoa.role
                )
              ) : (
                "Sem cargo informado"
              )}
              {[pessoa.department, pessoa.unidade].filter(Boolean).map((v) => ` · ${v}`)}
            </p>
            {desativado ? (
              <p className="mt-2 inline-block rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                Desativado: fora do PDI e da autoavaliação
              </p>
            ) : null}
            <p className="mt-1 text-xs text-slate-500">
              {[
                desativado ? null : pessoa.status,
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
              disabled={pending}
              onClick={async () => {
                if (
                  !desativado &&
                  !(await confirmar(
                    `Desativar ${pessoa.name}? A pessoa sai do PDI e da autoavaliação e fica só na aba Desativados da equipe, com o histórico guardado.`,
                  ))
                )
                  return;
                startTransition(async () => {
                  await definirAtivo(pessoa.id, desativado);
                  router.refresh();
                });
              }}
              className="rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {desativado ? "Reativar" : "Desativar"}
            </button>
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
                className={`rounded-full px-2.5 py-0.5 text-micro font-medium ${t.cor}`}
              >
                {t.n} {t.label.toLowerCase()}
                {t.n > 1 && t.key !== "OBSERVACAO" ? "s" : ""}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      {treinamento}

      <EmployeeExams
        companyId={companyId}
        employeeId={pessoa.id}
        cargo={pessoa.role}
        admissao={pessoa.hiredAt || null}
        exames={exames}
        hoje={hoje}
      />

      {mapeamento ? <div className="mb-4">{mapeamento}</div> : null}

      {/* Dentistas e laboratório: sem PDI. */}
      {foraDoPdi(pessoa.role) && !pdi && planosConcluidos === 0 ? null : (
        <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Plano de Desenvolvimento Individual</h2>
              {pdi ? (
                <>
                  <p className="mt-0.5 text-sm text-slate-700">{pdi.titulo}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                        <span
                          className="block h-full rounded-full bg-emerald-500"
                          style={{ width: `${pdi.progresso ?? 0}%` }}
                        />
                      </span>
                      {pdi.progresso ?? 0}%
                    </span>
                    <span>
                      {pdi.atingidas}/{pdi.metas} metas atingidas
                    </span>
                    <span className={pdi.atrasada ? "font-medium text-red-700" : ""}>
                      {pdi.proxima
                        ? `próxima conversa ${pdi.proxima}${pdi.atrasada ? " (atrasada)" : ""}`
                        : "sem próxima conversa"}
                    </span>
                  </div>
                </>
              ) : (
                <p className="mt-0.5 text-xs text-slate-500">
                  {avaliadaEm
                    ? `Avaliada em ${avaliadaEm}, ainda sem plano em andamento.`
                    : "Nenhum PDI em andamento."}
                  {planosConcluidos > 0 ? ` ${planosConcluidos} plano(s) encerrado(s).` : ""}
                </p>
              )}
            </div>
            <Link
              href={`/empresas/${companyId}/pdi/${pessoa.id}`}
              className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              {pdi ? "Abrir PDI" : "Começar PDI"}
            </Link>
          </div>
        </section>
      )}

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
          linha do tempo, as avaliações e os PDIs. Não há como desfazer.
        </p>
        <button
          type="button"
          disabled={pending}
          onClick={async () => {
            if (
              !(await confirmar(
                `Excluir ${pessoa.name} e todo o histórico dessa pessoa? Não há como desfazer.`,
              ))
            )
              return;
            // A ficha deixa de existir: ficar nela era cair num 404.
            startTransition(async () => {
              const r = await excluirComPermissao((apagar) => deleteEmployee(pessoa.id, apagar));
              if (!r?.ok) return;
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
          cargos={cargos}
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
    </>
  );
}
