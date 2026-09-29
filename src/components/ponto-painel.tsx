"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Copy, Link2, Plus, RotateCcw, Trash2, Upload, X } from "lucide-react";
import {
  anularMarcacao,
  ativarPonto,
  excluirLancamento,
  excluirOcorrencia,
  importarAfd,
  incluirMarcacao,
  lancarNoBanco,
  restaurarMarcacao,
  salvarConfig,
  salvarOcorrencia,
  salvarPessoa,
  trocarLink,
  type PontoState,
} from "@/app/(app)/empresas/[id]/ponto/actions";
import {
  DIAS_DA_SEMANA,
  horas,
  NOME_DA_OCORRENCIA,
  relogio,
  saldoEscrito,
  type TipoOcorrencia,
} from "@/lib/ponto";
import { Etiqueta, Painel } from "./ui";
import { Field, FormError, FormOk, Input, Select, SmallSubmitButton, SubmitButton } from "./form";

/**
 * As peças interativas da aba Ponto. A página monta os dados no servidor e
 * passa para cá só o que cada formulário precisa.
 */

const botaoLeve =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:text-brand-700";

function useFechaQuandoOk(state: PontoState, fechar?: () => void) {
  useEffect(() => {
    if (state.ok && fechar) fechar();
  }, [state, fechar]);
}

// -------------------------------------------------------------- ativar

export function AtivarPonto({ companyId }: { companyId: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      onClick={() => iniciar(async () => void (await ativarPonto(companyId)))}
      className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
    >
      {pendente ? "Ativando…" : "Ativar o ponto desta empresa"}
    </button>
  );
}

// ------------------------------------------------------------------ link

export function LinkDoPonto({ companyId, caminho }: { companyId: string; caminho: string }) {
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();
  const [url, setUrl] = useState(caminho);

  useEffect(() => setUrl(`${window.location.origin}${caminho}`), [caminho]);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <code className="max-w-full truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">{url}</code>
      <button
        type="button"
        className={botaoLeve}
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 2000);
        }}
      >
        <Copy size={12} /> {copiado ? "Copiado" : "Copiar"}
      </button>
      <a href={caminho} target="_blank" rel="noreferrer" className={botaoLeve}>
        <Link2 size={12} /> Abrir
      </a>
      <button
        type="button"
        disabled={pendente}
        className={botaoLeve}
        onClick={() => {
          if (confirm("Trocar o link? O endereço atual para de funcionar na hora — o tablet e os celulares vão precisar do novo.")) {
            iniciar(async () => void (await trocarLink(companyId)));
          }
        }}
      >
        <RotateCcw size={12} /> Trocar link
      </button>
    </div>
  );
}

// ----------------------------------------------------------------- jornada

function CamposDaJornada({ jornada, prefixo = "jornada" }: { jornada: number[]; prefixo?: string }) {
  return (
    <div className="grid grid-cols-7 gap-1.5">
      {DIAS_DA_SEMANA.map((nome, i) => (
        <label key={nome} className="block text-center">
          <span className="mb-0.5 block text-[10px] font-medium uppercase tracking-wider text-slate-400">{nome}</span>
          <input
            name={`${prefixo}${i}`}
            defaultValue={jornada[i] ? horas(jornada[i]) : ""}
            placeholder="—"
            className="w-full rounded-md border border-slate-300 px-1 py-1.5 text-center text-sm tabular-nums outline-none focus:border-brand-500"
          />
        </label>
      ))}
    </div>
  );
}

// ------------------------------------------------------------ configuração

export type ConfigDaTela = {
  regime: "BANCO_DE_HORAS" | "HORAS_EXTRAS";
  jornada: number[];
  tolerancia: number;
  intervaloMinimo: number;
  validadeBancoMeses: number;
  inicio: string;
  ativo: boolean;
};

export function ConfigForm({ companyId, config }: { companyId: string; config: ConfigDaTela }) {
  const [state, action] = useActionState<PontoState, FormData>(salvarConfig, {});
  const [regime, setRegime] = useState(config.regime);

  return (
    <form action={action}>
      <Painel titulo="Regras do ponto desta empresa" descricao="Cada empresa tem as suas. Mudar aqui recalcula os espelhos na hora.">
        <input type="hidden" name="companyId" value={companyId} />

        <p className="mb-1.5 text-sm font-medium text-slate-700">O que acontece com a hora a mais</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["BANCO_DE_HORAS", "Banco de horas", "O que passa da jornada vira crédito, o que falta vira débito, e a pessoa compensa com folga."],
              ["HORAS_EXTRAS", "Horas extras", "O que passa da jornada é pago em folha: 50% em dia útil, 100% em domingo e feriado. O que falta é desconto."],
            ] as const
          ).map(([valor, titulo, texto]) => (
            <label
              key={valor}
              className={`cursor-pointer rounded-lg border p-3 transition ${
                regime === valor ? "border-brand-500 bg-brand-50/60" : "border-slate-200 hover:border-brand-300"
              }`}
            >
              <input
                type="radio"
                name="regime"
                value={valor}
                checked={regime === valor}
                onChange={() => setRegime(valor)}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-slate-800">{titulo}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{texto}</span>
            </label>
          ))}
        </div>

        <p className="mb-1.5 mt-4 text-sm font-medium text-slate-700">Jornada de cada dia</p>
        <CamposDaJornada jornada={config.jornada} />
        <p className="mt-1 text-[11px] text-slate-400">
          Horas por dia (8:00, 8:48, 4). Em branco é dia sem jornada. Pessoa com escala diferente ganha a própria em “Pessoas e PIN”.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-4">
          <Field label="Tolerância diária (min)" hint="CLT: até 10 min no dia não contam.">
            <Input type="number" name="tolerancia" min={0} max={30} defaultValue={config.tolerancia} />
          </Field>
          <Field label="Intervalo mínimo (min)" hint="Para quem passa de 6h.">
            <Input type="number" name="intervaloMinimo" min={0} max={240} defaultValue={config.intervaloMinimo} />
          </Field>
          {regime === "BANCO_DE_HORAS" ? (
            <Field label="Prazo do banco (meses)" hint="Acordo individual: até 6.">
              <Input type="number" name="validadeBancoMeses" min={1} max={24} defaultValue={config.validadeBancoMeses} />
            </Field>
          ) : (
            <input type="hidden" name="validadeBancoMeses" value={config.validadeBancoMeses} />
          )}
          <Field label="O ponto conta desde" hint="Dias antes disso ficam de fora.">
            <Input type="date" name="inicio" defaultValue={config.inicio} required />
          </Field>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="ativo" defaultChecked={config.ativo} />
          Registro de ponto ligado (desligado, o link mostra “ponto desativado”)
        </label>

        <div className="mt-3 space-y-2">
          <FormError message={state.error} />
          <FormOk message={state.mensagem} />
          <SubmitButton>Salvar regras</SubmitButton>
        </div>
      </Painel>
    </form>
  );
}

// ------------------------------------------------------------------ pessoa

export type PessoaDaTela = {
  id: string;
  nome: string;
  cargo: string | null;
  documento: string | null;
  status: string;
  temPin: boolean;
  jornada: number[] | null;
};

export function PessoaPonto({ pessoa, jornadaDaEmpresa }: { pessoa: PessoaDaTela; jornadaDaEmpresa: number[] }) {
  const [aberto, setAberto] = useState(false);
  const [state, action] = useActionState<PontoState, FormData>(salvarPessoa, {});
  const [propria, setPropria] = useState(Boolean(pessoa.jornada));

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  return (
    <div className="border-b border-slate-100 px-3 py-2 last:border-b-0 even:bg-slate-50/60">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="min-w-0 flex-1">
          <p className="text-[13px] font-medium text-slate-800">
            {pessoa.nome}
            {pessoa.status !== "ATIVO" ? (
              <span className="ml-1.5">
                <Etiqueta tom={pessoa.status === "DESLIGADO" ? "neutro" : "atencao"}>{pessoa.status.toLowerCase()}</Etiqueta>
              </span>
            ) : null}
          </p>
          <p className="text-[11px] text-slate-400">
            {[pessoa.cargo, pessoa.documento ? `CPF ${pessoa.documento}` : "sem CPF"].filter(Boolean).join(" · ")}
            {pessoa.jornada ? ` · jornada própria de ${horas(pessoa.jornada.reduce((s, m) => s + m, 0))}/semana` : ""}
          </p>
        </div>
        <Etiqueta tom={pessoa.temPin ? "bom" : "atencao"}>{pessoa.temPin ? "PIN ativo" : "sem PIN"}</Etiqueta>
        <button type="button" onClick={() => setAberto((v) => !v)} className={botaoLeve}>
          {aberto ? "Fechar" : pessoa.temPin ? "Ajustar" : "Liberar ponto"}
        </button>
      </div>
      {!aberto && state.mensagem ? <p className="mt-1 text-[11px] text-emerald-700">{state.mensagem}</p> : null}

      {aberto ? (
        <form action={action} className="mt-2 space-y-2 rounded-lg border border-slate-200 bg-white p-3">
          <input type="hidden" name="employeeId" value={pessoa.id} />
          <div className="grid gap-2 sm:grid-cols-3">
            <Field label="CPF" hint={pessoa.documento ? "Deixe em branco para manter." : "É com ele que a pessoa se identifica."}>
              <Input name="cpf" inputMode="numeric" placeholder={pessoa.documento ?? "000.000.000-00"} />
            </Field>
            <Field label={pessoa.temPin ? "Novo PIN" : "PIN"} hint="4 a 6 números. Combine com a pessoa.">
              <Input name="pin" inputMode="numeric" maxLength={6} autoComplete="off" placeholder={pessoa.temPin ? "manter o atual" : "ex.: 4821"} />
            </Field>
            {pessoa.temPin ? (
              <label className="flex items-end gap-2 pb-2 text-xs text-slate-600">
                <input type="checkbox" name="removerPin" /> Tirar o PIN (bloqueia o ponto)
              </label>
            ) : null}
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input type="checkbox" name="jornadaPropria" checked={propria} onChange={(e) => setPropria(e.target.checked)} />
            Jornada diferente da empresa (escala, meio período)
          </label>
          {propria ? <CamposDaJornada jornada={pessoa.jornada ?? jornadaDaEmpresa} /> : null}

          <FormError message={state.error} />
          <SmallSubmitButton>Salvar</SmallSubmitButton>
        </form>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ espelho

export type MarcacaoDaTela = {
  id: string;
  minuto: number;
  origem: "RELOGIO" | "MANUAL" | "IMPORTADA";
  motivo: string | null;
  anulada: boolean;
  anuladaMotivo: string | null;
  nsr: number;
};

export type DiaDaTela = {
  dia: string;
  semana: number;
  marcacoes: MarcacaoDaTela[];
  ocorrencia: TipoOcorrencia | null;
  ocorrenciaId: string | null;
  ocorrenciaDescricao: string | null;
  previsto: number;
  trabalhado: number;
  abonado: number;
  saldo: number;
  extras50: number;
  extras100: number;
  alertas: string[];
  emAndamento: boolean;
  foraDoPeriodo: boolean;
};

function Batida({ m, podeMexer }: { m: MarcacaoDaTela; podeMexer: boolean }) {
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);

  const titulo = [
    `NSR ${m.nsr}`,
    m.origem === "MANUAL" ? `incluída pelo RH: ${m.motivo ?? ""}` : m.origem === "IMPORTADA" ? "importada do AFD" : "registrada no ponto",
    m.anulada ? `anulada: ${m.anuladaMotivo ?? ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <span
      title={titulo}
      className={`group inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[12px] tabular-nums ${
        m.anulada
          ? "bg-slate-100 text-slate-400 line-through"
          : m.origem === "MANUAL"
            ? "bg-amber-50 text-amber-800"
            : "bg-brand-50 text-brand-800"
      }`}
    >
      {relogio(m.minuto)}
      {m.minuto >= 1440 ? <sup className="text-[8px]">+1</sup> : null}
      {m.origem === "MANUAL" ? <span className="text-[9px]">*</span> : null}
      {podeMexer ? (
        <button
          type="button"
          disabled={pendente}
          aria-label={m.anulada ? "Restaurar batida" : "Anular batida"}
          className="no-print ml-0.5 hidden text-slate-400 hover:text-red-600 group-hover:inline"
          onClick={() => {
            if (m.anulada) {
              iniciar(async () => void (await restaurarMarcacao(m.id)));
              return;
            }
            const motivo = prompt(`Anular a batida das ${relogio(m.minuto)}? Diga o motivo:`);
            if (motivo === null) return;
            iniciar(async () => {
              const r = await anularMarcacao(m.id, motivo);
              setErro(r.error ?? null);
            });
          }}
        >
          {m.anulada ? <RotateCcw size={10} /> : <X size={10} />}
        </button>
      ) : null}
      {erro ? <span className="ml-1 text-[10px] text-red-600 no-underline">{erro}</span> : null}
    </span>
  );
}

function IncluirBatida({ employeeId, dia, fechar }: { employeeId: string; dia: string; fechar: () => void }) {
  const [state, action] = useActionState<PontoState, FormData>(incluirMarcacao, {});
  useFechaQuandoOk(state, fechar);
  return (
    <form action={action} className="no-print mt-1.5 flex flex-wrap items-end gap-1.5 rounded-md border border-slate-200 bg-white p-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="dia" value={dia} />
      <input type="time" name="hora" required autoFocus className="rounded border border-slate-300 px-1.5 py-1 text-xs" />
      <label className="flex items-center gap-1 text-[11px] text-slate-500">
        <input type="checkbox" name="diaSeguinte" /> dia seguinte
      </label>
      <input
        name="motivo"
        required
        placeholder="Motivo (ex.: esqueceu de bater a saída)"
        className="min-w-[14rem] flex-1 rounded border border-slate-300 px-1.5 py-1 text-xs"
      />
      <SmallSubmitButton>Incluir</SmallSubmitButton>
      <button type="button" onClick={fechar} className="text-[11px] text-slate-500">
        cancelar
      </button>
      {state.error ? <p className="w-full text-[11px] text-red-600">{state.error}</p> : null}
    </form>
  );
}

function OcorrenciaDoDia({ companyId, employeeId, dia, fechar }: { companyId: string; employeeId: string; dia: string; fechar: () => void }) {
  const [state, action] = useActionState<PontoState, FormData>(salvarOcorrencia, {});
  useFechaQuandoOk(state, fechar);
  return (
    <form action={action} className="no-print mt-1.5 flex flex-wrap items-end gap-1.5 rounded-md border border-slate-200 bg-white p-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="de" value={dia} />
      <select name="tipo" className="rounded border border-slate-300 px-1.5 py-1 text-xs" defaultValue="ABONO">
        <option value="ABONO">Abono</option>
        <option value="ATESTADO">Atestado</option>
        <option value="FOLGA">Folga</option>
        <option value="FERIAS">Férias</option>
      </select>
      <input name="descricao" placeholder="Observação" className="min-w-[12rem] flex-1 rounded border border-slate-300 px-1.5 py-1 text-xs" />
      <SmallSubmitButton>Lançar</SmallSubmitButton>
      <button type="button" onClick={fechar} className="text-[11px] text-slate-500">
        cancelar
      </button>
      {state.error ? <p className="w-full text-[11px] text-red-600">{state.error}</p> : null}
    </form>
  );
}

function TirarOcorrencia({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      aria-label="Tirar ocorrência"
      className="no-print ml-0.5 text-slate-400 hover:text-red-600"
      onClick={() => {
        if (confirm("Tirar esta ocorrência do dia?")) iniciar(async () => void (await excluirOcorrencia(id)));
      }}
    >
      <X size={10} />
    </button>
  );
}

const NOME_CURTO_DO_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function Espelho({
  companyId,
  employeeId,
  dias,
  regime,
}: {
  companyId: string;
  employeeId: string;
  dias: DiaDaTela[];
  regime: "BANCO_DE_HORAS" | "HORAS_EXTRAS";
}) {
  const [aberto, setAberto] = useState<{ dia: string; o: "batida" | "ocorrencia" } | null>(null);
  const fechar = useRef(() => setAberto(null)).current;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] text-[12px]">
        <thead>
          <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
            <th className="px-2 py-1.5 font-medium">Dia</th>
            <th className="px-2 py-1.5 font-medium">Marcações</th>
            <th className="px-2 py-1.5 text-right font-medium">Previsto</th>
            <th className="px-2 py-1.5 text-right font-medium">Trabalhado</th>
            <th className="px-2 py-1.5 text-right font-medium">{regime === "BANCO_DE_HORAS" ? "Banco" : "Extra / falta"}</th>
            <th className="px-2 py-1.5 font-medium">Observações</th>
            <th className="no-print px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => {
            const [, mes, dia] = d.dia.split("-").map(Number);
            const fimDeSemana = d.semana === 0 || d.semana === 6;
            const temAlerta = d.alertas.length > 0;
            return (
              <tr
                key={d.dia}
                className={`border-b border-slate-100 align-top ${d.foraDoPeriodo ? "text-slate-300" : ""} ${
                  temAlerta ? "bg-amber-50/40" : fimDeSemana ? "bg-slate-50/70" : ""
                }`}
              >
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums">
                  <span className="font-medium text-slate-700">
                    {String(dia).padStart(2, "0")}/{NOME_CURTO_DO_MES[mes - 1]}
                  </span>{" "}
                  <span className="text-slate-400">{DIAS_DA_SEMANA[d.semana]}</span>
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {d.marcacoes.map((m) => (
                      <Batida key={m.id} m={m} podeMexer={!d.foraDoPeriodo} />
                    ))}
                    {d.marcacoes.length === 0 && !d.foraDoPeriodo ? <span className="text-slate-300">—</span> : null}
                  </div>
                  {aberto?.dia === d.dia && aberto.o === "batida" ? (
                    <IncluirBatida employeeId={employeeId} dia={d.dia} fechar={fechar} />
                  ) : null}
                  {aberto?.dia === d.dia && aberto.o === "ocorrencia" ? (
                    <OcorrenciaDoDia companyId={companyId} employeeId={employeeId} dia={d.dia} fechar={fechar} />
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">
                  {d.foraDoPeriodo ? "" : d.previsto ? horas(d.previsto) : "—"}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                  {d.foraDoPeriodo || (!d.trabalhado && !d.marcacoes.length) ? "" : horas(d.trabalhado)}
                </td>
                <td
                  className={`px-2 py-1.5 text-right font-medium tabular-nums ${
                    d.saldo > 0 ? "text-emerald-700" : d.saldo < 0 ? "text-red-700" : "text-slate-300"
                  }`}
                >
                  {d.foraDoPeriodo || d.emAndamento ? "" : d.saldo ? saldoEscrito(d.saldo) : "0:00"}
                  {regime === "HORAS_EXTRAS" && d.extras100 > 0 ? <span className="block text-[10px] font-normal">100%</span> : null}
                </td>
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {d.foraDoPeriodo ? <span className="text-[11px]">fora do período</span> : null}
                    {d.emAndamento ? <Etiqueta tom="azul">hoje</Etiqueta> : null}
                    {d.ocorrencia ? (
                      <span className="inline-flex items-center">
                        <Etiqueta tom="azul">
                          {NOME_DA_OCORRENCIA[d.ocorrencia]}
                          {d.ocorrenciaDescricao ? `: ${d.ocorrenciaDescricao}` : ""}
                        </Etiqueta>
                        {d.ocorrenciaId && d.ocorrencia !== "FERIADO" ? <TirarOcorrencia id={d.ocorrenciaId} /> : null}
                      </span>
                    ) : null}
                    {d.abonado > 0 ? <span className="text-[10px] text-slate-500">abonado {horas(d.abonado)}</span> : null}
                    {d.alertas.map((a) => (
                      <Etiqueta key={a} tom={a === "Falta" ? "ruim" : "atencao"}>
                        {a}
                      </Etiqueta>
                    ))}
                  </div>
                </td>
                <td className="no-print whitespace-nowrap px-2 py-1.5 text-right">
                  {d.foraDoPeriodo ? null : (
                    <div className="flex justify-end gap-1">
                      <button type="button" className={botaoLeve} onClick={() => setAberto({ dia: d.dia, o: "batida" })} title="Incluir batida">
                        <Plus size={11} /> batida
                      </button>
                      <button type="button" className={botaoLeve} onClick={() => setAberto({ dia: d.dia, o: "ocorrencia" })} title="Abono, atestado, folga, férias">
                        <Plus size={11} /> ocorrência
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------- ocorrências

export function OcorrenciaForm({
  companyId,
  pessoas,
  hoje,
}: {
  companyId: string;
  pessoas: { id: string; nome: string }[];
  hoje: string;
}) {
  const [state, action] = useActionState<PontoState, FormData>(salvarOcorrencia, {});
  const [tipo, setTipo] = useState<TipoOcorrencia>("FERIADO");
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action}>
      <Painel titulo="Lançar feriado, férias, folga ou abono">
        <input type="hidden" name="companyId" value={companyId} />
        <div className="grid gap-2 sm:grid-cols-5">
          <Field label="Tipo">
            <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoOcorrencia)}>
              {(Object.keys(NOME_DA_OCORRENCIA) as TipoOcorrencia[]).map((t) => (
                <option key={t} value={t}>
                  {NOME_DA_OCORRENCIA[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pessoa">
            {tipo === "FERIADO" ? (
              <Input value="Empresa toda" disabled readOnly />
            ) : (
              <Select name="employeeId" required defaultValue="">
                <option value="" disabled>
                  Escolha…
                </option>
                {pessoas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="De">
            <Input type="date" name="de" defaultValue={hoje} required />
          </Field>
          <Field label="Até" hint="Vazio: um dia só.">
            <Input type="date" name="ate" />
          </Field>
          <Field label="Descrição">
            <Input name="descricao" placeholder={tipo === "FERIADO" ? "Ex.: Independência" : "Opcional"} />
          </Field>
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Feriado, folga e férias tiram a jornada do dia. Abono e atestado mantêm a jornada e dão por cumprido o que faltou.
        </p>
        <div className="mt-2 space-y-2">
          <FormError message={state.error} />
          {state.ok ? <FormOk message="Lançado." /> : null}
          <SubmitButton>Lançar</SubmitButton>
        </div>
      </Painel>
    </form>
  );
}

export function ExcluirOcorrencia({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      aria-label="Excluir"
      className="text-slate-400 transition hover:text-red-600"
      onClick={() => {
        if (confirm("Excluir esta ocorrência?")) iniciar(async () => void (await excluirOcorrencia(id)));
      }}
    >
      <Trash2 size={13} />
    </button>
  );
}

// ------------------------------------------------------------------- banco

export function LancamentoForm({ employeeId, hoje }: { employeeId: string; hoje: string }) {
  const [state, action] = useActionState<PontoState, FormData>(lancarNoBanco, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="no-print space-y-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <div className="grid gap-2 sm:grid-cols-4">
        <Field label="Movimento">
          <Select name="sentido" defaultValue="DEBITO">
            <option value="DEBITO">Tirar do banco (pagas em folha, folga)</option>
            <option value="CREDITO">Pôr no banco (saldo anterior, ajuste)</option>
          </Select>
        </Field>
        <Field label="Horas">
          <Input name="horas" placeholder="2:30" required />
        </Field>
        <Field label="Dia">
          <Input type="date" name="dia" defaultValue={hoje} required />
        </Field>
        <Field label="Descrição">
          <Input name="descricao" placeholder="Ex.: pagas na folha de setembro" required />
        </Field>
      </div>
      <FormError message={state.error} />
      <SmallSubmitButton>Lançar no banco</SmallSubmitButton>
    </form>
  );
}

export function ExcluirLancamento({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      aria-label="Excluir lançamento"
      className="no-print text-slate-400 transition hover:text-red-600"
      onClick={() => {
        if (confirm("Excluir este lançamento do banco?")) iniciar(async () => void (await excluirLancamento(id)));
      }}
    >
      <Trash2 size={13} />
    </button>
  );
}

// ------------------------------------------------------------------ importar

export function ImportarAfd({ companyId }: { companyId: string }) {
  const [state, action] = useActionState<PontoState, FormData>(importarAfd, {});
  return (
    <form action={action}>
      <Painel
        titulo="Trazer batidas do relógio próprio da empresa"
        descricao="Para a empresa que já tem ponto eletrônico de outro fornecedor: o sistema dela exporta o AFD e ele é lido aqui. Ninguém precisa entregar senha."
      >
        <input type="hidden" name="companyId" value={companyId} />
        <ol className="mb-3 list-decimal space-y-1 pl-5 text-xs leading-relaxed text-slate-600">
          <li>No sistema de ponto da empresa, procure “AFD” ou “Arquivo Fonte de Dados” (fica em relatórios fiscais ou exportações).</li>
          <li>Exporte o período desejado. O arquivo é um .txt.</li>
          <li>Confira se o CPF de cada pessoa está cadastrado na Equipe — é por ele que a batida acha a pessoa.</li>
          <li>Envie aqui. Pode mandar o mesmo arquivo de novo depois: batida repetida é pulada.</li>
        </ol>
        <input
          type="file"
          name="arquivo"
          accept=".txt,.afd,text/plain"
          required
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-brand-700"
        />
        <div className="mt-3 space-y-2">
          <FormError message={state.error} />
          <FormOk message={state.mensagem} />
          <SubmitButton pendingLabel="Importando…">
            <span className="inline-flex items-center gap-1.5">
              <Upload size={14} /> Importar AFD
            </span>
          </SubmitButton>
        </div>
      </Painel>
    </form>
  );
}

