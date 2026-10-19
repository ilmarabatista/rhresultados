"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { cadastrarColaborador, criarEmpresa } from "@/app/admin/actions";
import type { Estado } from "@/app/actions";
import { DIAS_DA_SEMANA, HORARIO_PADRAO, horarioEscrito } from "@/lib/calculo";
import { BotaoEnviar } from "./formularios";
import { Campo, Erro, Ok, estiloBotaoLeve, estiloCampo } from "./ui";

export function CamposDoHorario() {
  return (
    <div className="space-y-2">
      {DIAS_DA_SEMANA.map((nome, i) => (
        <label key={nome} className="flex items-center gap-3">
          <span className="w-10 text-sm font-medium text-slate-600">{nome}</span>
          <input
            name={`horario${i}`}
            defaultValue={horarioEscrito(HORARIO_PADRAO[i]).replaceAll("–", "-")}
            placeholder="sem expediente"
            className={`${estiloCampo} py-2 text-sm tabular-nums`}
          />
        </label>
      ))}
      <p className="text-xs text-slate-500">
        Um ou mais trechos por dia, como 08:00-12:00 13:00-17:00. Em branco é dia sem expediente. O que for trabalhado fora deste horário
        conta como hora extra.
      </p>
    </div>
  );
}

export function FormNovaEmpresa({ empresas, hoje }: { empresas: { id: string; nome: string }[]; hoje: string }) {
  const [estado, acao] = useActionState<Estado, FormData>(criarEmpresa, {});
  return (
    <form action={acao} className="space-y-4">
      <Campo rotulo="Empresa" dica="A lista vem do RH Resultados.">
        <select name="rhCompanyId" required defaultValue="" className={estiloCampo}>
          <option value="" disabled>
            Escolha…
          </option>
          {empresas.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
            </option>
          ))}
        </select>
      </Campo>
      <div>
        <p className="mb-2 text-sm font-medium text-slate-700">Horário padrão da empresa</p>
        <CamposDoHorario />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Hora a mais vai para">
          <select name="regime" defaultValue="HORAS_EXTRAS" className={estiloCampo}>
            <option value="HORAS_EXTRAS">Horas extras (pagas em folha)</option>
            <option value="BANCO_DE_HORAS">Banco de horas (compensa com folga)</option>
          </select>
        </Campo>
        <Campo rotulo="O ponto conta desde">
          <input type="date" name="inicio" defaultValue={hoje} required className={estiloCampo} />
        </Campo>
      </div>
      <Erro texto={estado.erro} />
      <BotaoEnviar pendente="Criando…">Criar o ponto</BotaoEnviar>
    </form>
  );
}

export function FormNovoColaborador({ empresaId }: { empresaId: string }) {
  const [estado, acao] = useActionState<Estado, FormData>(cadastrarColaborador, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado.ok) form.current?.reset();
  }, [estado]);
  return (
    <form ref={form} action={acao} className="space-y-3">
      <input type="hidden" name="empresaId" value={empresaId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Email do colaborador">
          <input name="email" type="email" required className={estiloCampo} />
        </Campo>
        <Campo rotulo="Nome" dica="Opcional, ajuda o RH a achar a pessoa.">
          <input name="nome" className={estiloCampo} />
        </Campo>
      </div>
      <Erro texto={estado.erro} />
      <Ok texto={estado.ok} />
      <BotaoEnviar pendente="Cadastrando…">Cadastrar</BotaoEnviar>
    </form>
  );
}

/** Botão de ação simples, com confirmação quando a ação pede. */
export function Acao({ acao, children, confirmar }: { acao: () => Promise<void>; children: React.ReactNode; confirmar?: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      className={`${estiloBotaoLeve} px-2.5 py-1 text-xs`}
      onClick={() => {
        if (confirmar && !window.confirm(confirmar)) return;
        iniciar(() => acao());
      }}
    >
      {pendente ? "…" : children}
    </button>
  );
}
