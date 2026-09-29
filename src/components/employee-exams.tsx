"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { CalendarCheck, Check, RotateCcw, Trash2, X } from "lucide-react";
import {
  agendarExame,
  cancelarExame,
  criarExame,
  excluirExame,
  reabrirExame,
  registrarResultado,
  type ExameState,
} from "@/app/(app)/empresas/[id]/equipe/exames-actions";
import {
  ordenarComoTarefa,
  pendente,
  prazoAdmissional,
  RESULTADOS,
  rotuloDoResultado,
  rotuloDoStatus,
  rotuloDoTipo,
  textoDoPrazo,
  TIPOS,
  urgencia,
  validadeDe,
} from "@/lib/exames";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";

/**
 * Exames ocupacionais de um colaborador, dentro da ficha dele.
 *
 * Cada exame é uma tarefa: agendar, acompanhar e registrar o resultado. A
 * caixinha à esquerda é o gesto — marcar conclui, desmarcar reabre.
 */

export type ExameDaFicha = {
  id: string;
  tipo: string;
  status: string;
  /** Todos os dias em "AAAA-MM-DD". */
  prazo: string | null;
  agendadoEm: string | null;
  hora: string | null;
  clinica: string | null;
  telefone: string | null;
  realizadoEm: string | null;
  resultado: string | null;
  restricoes: string | null;
  validoAte: string | null;
  observacoes: string | null;
};

const RESULTADO_ESTILO: Record<string, string> = {
  APTO: "bg-emerald-50 text-emerald-700",
  APTO_COM_RESTRICAO: "bg-amber-50 text-amber-800",
  INAPTO: "bg-red-50 text-red-700",
};

function diaBr(dia: string | null): string | null {
  return dia ? dia.split("-").reverse().join("/") : null;
}

// -------------------------------------------------------- formulários

function FormularioAgendar({
  exame,
  aoConcluir,
}: {
  exame: ExameDaFicha;
  aoConcluir: () => void;
}) {
  const [state, action] = useActionState<ExameState, FormData>(agendarExame, {});

  useEffect(() => {
    if (state.ok) aoConcluir();
  }, [state.ok, aoConcluir]);

  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
      <input type="hidden" name="id" value={exame.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dia do exame">
          <Input
            type="date"
            name="scheduledAt"
            required
            defaultValue={exame.agendadoEm ?? exame.prazo ?? ""}
          />
        </Field>
        <Field label="Hora" hint="Opcional.">
          <Input type="time" name="scheduledTime" defaultValue={exame.hora ?? ""} />
        </Field>
        <Field label="Clínica">
          <Input name="clinic" defaultValue={exame.clinica ?? ""} />
        </Field>
        <Field label="Telefone da clínica">
          <Input name="clinicPhone" defaultValue={exame.telefone ?? ""} />
        </Field>
      </div>

      <FormError message={state.error} />

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Salvando…">Marcar exame</SubmitButton>
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

function FormularioResultado({
  exame,
  hoje,
  aoConcluir,
}: {
  exame: ExameDaFicha;
  hoje: string;
  aoConcluir: () => void;
}) {
  const [state, action] = useActionState<ExameState, FormData>(
    registrarResultado,
    {},
  );
  const [resultado, setResultado] = useState(exame.resultado ?? "APTO");
  const realizado = exame.realizadoEm ?? exame.agendadoEm ?? hoje;

  useEffect(() => {
    if (state.ok) aoConcluir();
  }, [state.ok, aoConcluir]);

  return (
    <form action={action} className="mt-3 space-y-3 rounded-xl bg-slate-50 p-3">
      <input type="hidden" name="id" value={exame.id} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Dia em que foi feito">
          <Input type="date" name="performedAt" required defaultValue={realizado} />
        </Field>
        <Field label="Resultado do ASO">
          <Select
            name="result"
            value={resultado}
            onChange={(e) => setResultado(e.target.value)}
          >
            {RESULTADOS.map((r) => (
              <option key={r.valor} value={r.valor}>
                {r.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {resultado === "APTO_COM_RESTRICAO" ? (
        <Field
          label="Restrição descrita no ASO"
          hint="Transcreva o que o médico do trabalho escreveu. Não registre diagnóstico nem CID."
        >
          <Textarea
            name="restrictions"
            rows={2}
            defaultValue={exame.restricoes ?? ""}
          />
        </Field>
      ) : null}

      {resultado === "INAPTO" ? null : (
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="ASO válido até"
            hint="Sugestão de doze meses. Quem decide o prazo é o médico do trabalho."
          >
            <Input
              type="date"
              name="validUntil"
              defaultValue={exame.validoAte ?? validadeDe(realizado)}
            />
          </Field>
        </div>
      )}

      <FormError message={state.error} />

      <div className="flex items-center gap-3">
        <SubmitButton pendingLabel="Salvando…">Concluir a tarefa</SubmitButton>
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

// -------------------------------------------------------------- tarefa

function LinhaExame({
  exame,
  hoje,
}: {
  exame: ExameDaFicha;
  hoje: string;
}) {
  const [aberto, setAberto] = useState<"agendar" | "resultado" | null>(null);
  const [pending, startTransition] = useTransition();

  const emAberto = pendente(exame.status);
  const nivel = urgencia(exame.prazo, hoje);
  const prazo = emAberto ? textoDoPrazo(exame.prazo, hoje) : null;

  return (
    <li
      className={`rounded-xl border p-3 transition ${pending ? "opacity-60" : ""} ${
        emAberto && nivel === "ATRASADO" ? "border-red-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1.5">
        <button
          type="button"
          disabled={pending || exame.status === "CANCELADO"}
          onClick={() => {
            if (emAberto) setAberto("resultado");
            else
              startTransition(() => {
                void reabrirExame(exame.id);
              });
          }}
          aria-label={
            emAberto
              ? `Concluir o exame ${rotuloDoTipo(exame.tipo)}`
              : `Reabrir o exame ${rotuloDoTipo(exame.tipo)}`
          }
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
            exame.status === "REALIZADO"
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-slate-300 hover:border-brand-500"
          }`}
        >
          {exame.status === "REALIZADO" ? <Check size={11} strokeWidth={3} /> : null}
        </button>

        <div className="min-w-0 flex-1">
          <span
            className={`text-sm font-medium ${
              exame.status === "CANCELADO"
                ? "text-slate-400 line-through"
                : "text-slate-900"
            }`}
          >
            {rotuloDoTipo(exame.tipo)}
          </span>
          <p className="mt-0.5 text-xs text-slate-400">
            {[
              rotuloDoStatus(exame.status),
              exame.agendadoEm && !exame.realizadoEm
                ? `marcado para ${diaBr(exame.agendadoEm)}${
                    exame.hora ? `, ${exame.hora}` : ""
                  }`
                : null,
              exame.clinica,
              exame.realizadoEm ? `feito em ${diaBr(exame.realizadoEm)}` : null,
              exame.validoAte ? `ASO até ${diaBr(exame.validoAte)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>

          {exame.restricoes ? (
            <p className="mt-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs leading-relaxed text-amber-800">
              Restrição: {exame.restricoes}
            </p>
          ) : null}

          {exame.observacoes ? (
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              {exame.observacoes}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {exame.resultado ? (
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                RESULTADO_ESTILO[exame.resultado] ?? ""
              }`}
            >
              {rotuloDoResultado(exame.resultado)}
            </span>
          ) : null}

          {prazo ? (
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                nivel === "ATRASADO"
                  ? "bg-red-50 text-red-700"
                  : nivel === "HOJE" || nivel === "PROXIMO"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-slate-50 text-slate-500"
              }`}
            >
              {prazo}
            </span>
          ) : null}

          {emAberto ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => setAberto(aberto === "agendar" ? null : "agendar")}
              className="flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-[11px] text-slate-700 transition hover:bg-slate-50"
            >
              <CalendarCheck size={12} />
              {exame.status === "AGENDADO" ? "remarcar" : "agendar"}
            </button>
          ) : null}

          {exame.status === "REALIZADO" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(() => {
                  void reabrirExame(exame.id);
                })
              }
              className="text-slate-300 transition hover:text-slate-700"
              aria-label={`Reabrir o exame ${rotuloDoTipo(exame.tipo)}`}
            >
              <RotateCcw size={13} />
            </button>
          ) : null}

          {emAberto ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (!confirm(`Cancelar o exame ${rotuloDoTipo(exame.tipo)}?`)) return;
                startTransition(() => {
                  void cancelarExame(exame.id);
                });
              }}
              className="text-slate-300 transition hover:text-amber-600"
              aria-label={`Cancelar o exame ${rotuloDoTipo(exame.tipo)}`}
            >
              <X size={14} />
            </button>
          ) : null}

          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Excluir o exame ${rotuloDoTipo(exame.tipo)} desta ficha?`))
                return;
              startTransition(() => {
                void excluirExame(exame.id);
              });
            }}
            className="text-slate-300 transition hover:text-red-600"
            aria-label={`Excluir o exame ${rotuloDoTipo(exame.tipo)}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {aberto === "agendar" ? (
        <FormularioAgendar exame={exame} aoConcluir={() => setAberto(null)} />
      ) : null}
      {aberto === "resultado" ? (
        <FormularioResultado
          exame={exame}
          hoje={hoje}
          aoConcluir={() => setAberto(null)}
        />
      ) : null}
    </li>
  );
}

// -------------------------------------------------------------- seção

export default function EmployeeExams({
  companyId,
  employeeId,
  cargo,
  admissao,
  exames,
  hoje,
}: {
  companyId: string;
  employeeId: string;
  cargo: string | null;
  /** Data de admissão em "AAAA-MM-DD", para sugerir o prazo do admissional. */
  admissao: string | null;
  exames: ExameDaFicha[];
  hoje: string;
}) {
  const [novo, setNovo] = useState(false);
  const [state, action] = useActionState<ExameState, FormData>(criarExame, {});
  const [tipo, setTipo] = useState("ADMISSIONAL");

  useEffect(() => {
    if (state.ok) setNovo(false);
  }, [state.ok]);

  const ordenados = ordenarComoTarefa(exames);
  const abertos = ordenados.filter((e) => pendente(e.status));
  const atrasados = abertos.filter(
    (e) => urgencia(e.prazo, hoje) === "ATRASADO",
  ).length;

  const prazoSugerido =
    tipo === "ADMISSIONAL" ? (prazoAdmissional(admissao) ?? "") : "";

  return (
    <section className="mb-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            Documentos e exames ocupacionais
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Cada exame é uma tarefa: agendar, acompanhar e registrar o
            resultado. O admissional precisa acontecer antes do primeiro dia de
            trabalho.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="shrink-0 rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
        >
          + Exame
        </button>
      </div>

      {abertos.length > 0 ? (
        <p
          className={`mb-3 rounded-lg px-3 py-2 text-xs ${
            atrasados > 0
              ? "bg-red-50 text-red-700"
              : "bg-amber-50 text-amber-800"
          }`}
        >
          {abertos.length} exame(s) por fazer
          {atrasados > 0 ? `, ${atrasados} com prazo vencido.` : "."}
        </p>
      ) : null}

      {novo ? (
        <form
          action={action}
          className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
        >
          <input type="hidden" name="companyId" value={companyId} />
          <input type="hidden" name="employeeId" value={employeeId} />

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tipo de exame *">
              <Select
                name="kind"
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                {TIPOS.map((t) => (
                  <option key={t.valor} value={t.valor}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Prazo"
              hint={
                TIPOS.find((t) => t.valor === tipo)?.quando ??
                "Até quando precisa acontecer."
              }
            >
              <Input
                type="date"
                name="dueDate"
                key={tipo}
                defaultValue={prazoSugerido}
              />
            </Field>

            <Field label="Cargo" hint="O cargo para o qual a pessoa é avaliada.">
              <Input name="jobTitle" defaultValue={cargo ?? ""} />
            </Field>
            <Field label="Clínica">
              <Input name="clinic" />
            </Field>
            <Field label="Telefone da clínica">
              <Input name="clinicPhone" />
            </Field>
          </div>

          <Field label="Observações">
            <Textarea name="notes" rows={2} />
          </Field>

          <FormError message={state.error} />

          <div className="flex items-center gap-3">
            <SubmitButton pendingLabel="Criando…">Criar tarefa</SubmitButton>
            <button
              type="button"
              onClick={() => setNovo(false)}
              className="text-sm text-slate-500 transition hover:text-slate-800"
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : null}

      {ordenados.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
          Nenhum exame registrado para esta pessoa.
        </p>
      ) : (
        <ul className="space-y-2">
          {ordenados.map((e) => (
            <LinhaExame key={e.id} exame={e} hoje={hoje} />
          ))}
        </ul>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-slate-400">
        O arquivo do ASO ainda não é guardado aqui — o sistema não tem
        armazenamento de arquivos. O que fica registrado é o que o documento
        diz: tipo, data, resultado e validade.
      </p>
    </section>
  );
}
