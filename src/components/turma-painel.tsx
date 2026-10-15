"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { GraduationCap } from "lucide-react";
import {
  convocarQuemPrecisa,
  justificarTurma,
  mudarCampoDaTurma,
  type CampoDaTurma,
} from "@/app/(app)/empresas/[id]/treinamentos/actions";
import { avisar as mostrarAviso, avisarSeErro as avisar } from "@/components/avisos";

/**
 * O que a reunião tem a mais quando é uma turma de treinamento: o treinamento,
 * o instrutor, as horas, o investimento e o material — e quem a matriz diz que
 * precisa e ainda não foi convocado. Fica no alto da página da reunião; o
 * resto (convocados, presença, pauta, ata) é o da reunião.
 */

export type TurmaDaReuniao = {
  id: string;
  treinamento: string;
  categoria: string;
  /** "AAAA-MM", enquanto não tem dia. */
  mes: string | null;
  instrutor: string;
  modalidade: string;
  horas: string;
  investimento: string;
  material: string;
  justificativa: string | null;
  situacao: string;
  /** Quem precisa (pela matriz), ainda não fez e não está convocado. */
  faltaConvocar: string[];
};

const campo =
  "rounded-md border border-slate-300 bg-white px-2 py-1 text-[12px] outline-none transition focus:border-brand-500";
const rotulo = "text-[10px] font-semibold uppercase tracking-wider text-slate-500";

function Campo({
  turmaId,
  qual,
  valor,
  placeholder,
  className,
  linhas,
}: {
  turmaId: string;
  qual: CampoDaTurma;
  valor: string;
  placeholder?: string;
  className: string;
  linhas?: number;
}) {
  const [texto, setTexto] = useState(valor);
  const [, startTransition] = useTransition();
  useEffect(() => setTexto(valor), [valor]);

  const sair = () => {
    if (texto === valor) return;
    startTransition(async () => {
      const r = await mudarCampoDaTurma(turmaId, qual, texto);
      if (r.error) {
        mostrarAviso(r.error);
        setTexto(valor);
      }
    });
  };

  return linhas ? (
    <textarea
      value={texto}
      rows={linhas}
      placeholder={placeholder}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={sair}
      className={className}
    />
  ) : (
    <input
      value={texto}
      placeholder={placeholder}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={sair}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={className}
    />
  );
}

export default function TurmaPainel({ companyId, turma }: { companyId: string; turma: TurmaDaReuniao }) {
  const [pending, startTransition] = useTransition();
  const realizada = turma.situacao === "REALIZADA";

  return (
    <section className={`rounded-lg border border-violet-200 bg-violet-50/40 p-3 ${pending ? "opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-2">
        <GraduationCap size={15} className="text-violet-700" />
        <span className="text-[13px] font-semibold text-violet-900">Treinamento: {turma.treinamento}</span>
        <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-violet-700 ring-1 ring-violet-200">
          {turma.categoria}
        </span>
        <Link
          href={`/empresas/${companyId}/treinamentos`}
          className="ml-auto text-[11px] text-violet-700 transition hover:text-violet-900"
        >
          Planejamento de treinamentos ›
        </Link>
      </div>

      {turma.justificativa ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-md bg-amber-50 px-2 py-1.5 text-[12px] text-amber-900">
          <span>
            <strong>Não realizado · justificado:</strong> {turma.justificativa}
          </span>
          <button
            type="button"
            onClick={() => startTransition(async () => avisar(await justificarTurma(turma.id, null)))}
            className="ml-auto text-[11px] text-amber-800 underline hover:text-amber-950"
          >
            voltar a programar
          </button>
        </div>
      ) : null}

      <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
        {turma.mes ? (
          <label className="flex items-center gap-2">
            <span className={rotulo}>Mês previsto</span>
            <input
              type="month"
              defaultValue={turma.mes}
              onChange={(e) => {
                const v = e.target.value;
                if (v) startTransition(async () => avisar(await mudarCampoDaTurma(turma.id, "mes", v)));
              }}
              className={campo}
            />
          </label>
        ) : null}
        <label className="flex items-center gap-2">
          <span className={rotulo}>Instrutor</span>
          <Campo turmaId={turma.id} qual="instrutor" valor={turma.instrutor} placeholder="Nome ou instituição" className={`${campo} w-44`} />
        </label>
        <label className="flex items-center gap-2">
          <span className={rotulo}>Tipo</span>
          <select
            defaultValue={turma.modalidade}
            onChange={(e) => {
              const v = e.target.value;
              startTransition(async () => avisar(await mudarCampoDaTurma(turma.id, "modalidade", v)));
            }}
            className={campo}
          >
            <option value="INTERNO">Interno</option>
            <option value="EXTERNO">Externo</option>
          </select>
        </label>
        <label className="flex items-center gap-2">
          <span className={rotulo}>Horas</span>
          <Campo turmaId={turma.id} qual="horas" valor={turma.horas} placeholder="2h30" className={`${campo} w-20`} />
        </label>
        <label className="flex items-center gap-2">
          <span className={rotulo}>Investimento</span>
          <Campo turmaId={turma.id} qual="investimento" valor={turma.investimento} placeholder="R$" className={`${campo} w-28`} />
        </label>
      </div>

      <label className="mt-2 flex items-start gap-2">
        <span className={`${rotulo} pt-1.5`}>Material</span>
        <Campo
          turmaId={turma.id}
          qual="material"
          valor={turma.material}
          placeholder="Apostila, slides, exercícios entregues…"
          className={`${campo} flex-1`}
        />
      </label>

      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px]">
        {turma.faltaConvocar.length > 0 ? (
          <>
            <span className="text-orange-800">
              Pela matriz, ainda {turma.faltaConvocar.length === 1 ? "precisa" : "precisam"}:{" "}
              {turma.faltaConvocar.slice(0, 6).join(", ")}
              {turma.faltaConvocar.length > 6 ? ` e mais ${turma.faltaConvocar.length - 6}` : ""}
            </span>
            <button
              type="button"
              onClick={() => startTransition(async () => avisar(await convocarQuemPrecisa(turma.id)))}
              className="rounded-md bg-violet-700 px-2 py-1 text-[11px] font-medium text-white transition hover:bg-violet-800"
            >
              Convocar {turma.faltaConvocar.length === 1 ? "" : "todos "}
            </button>
          </>
        ) : (
          <span className="text-slate-500">Todos que a matriz pede para este treinamento já fizeram ou estão convocados.</span>
        )}
        {!realizada && !turma.justificativa ? (
          <button
            type="button"
            onClick={() => {
              const motivo = prompt("Por que este treinamento não vai acontecer?");
              if (motivo && motivo.trim()) startTransition(async () => avisar(await justificarTurma(turma.id, motivo)));
            }}
            className="ml-auto text-[11px] text-slate-500 transition hover:text-amber-700"
          >
            Não vai acontecer (justificar)
          </button>
        ) : null}
      </div>
      {realizada ? null : (
        <p className="mt-1.5 text-[11px] text-slate-500">
          Ao encerrar, quem estiver marcado como presente ganha este treinamento no histórico da ficha.
        </p>
      )}
    </section>
  );
}
