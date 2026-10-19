"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Camera, MapPin, Plus, RotateCcw, Send, Trash2, X } from "lucide-react";
import {
  anularMarcacao,
  enviarRelatorio,
  excluirLancamento,
  excluirOcorrencia,
  incluirMarcacao,
  lancarNoBanco,
  restaurarMarcacao,
  salvarColaborador,
  salvarOcorrencia,
  salvarRegras,
  type PontoState,
} from "@/app/(app)/empresas/[id]/ponto/actions";
import {
  DIAS_DA_SEMANA,
  horarioEscrito,
  horas,
  NOME_DA_OCORRENCIA,
  relogio,
  saldoEscrito,
  type Horario,
  type TipoOcorrencia,
} from "@/lib/ponto";
import type { DiaNoPonto, MarcacaoNoPonto } from "@/lib/ponto-api";
import Modal from "./modal";
import { avisar, avisarSeErro, confirmar } from "./avisos";
import { Etiqueta, Painel } from "./ui";
import { Field, FormError, FormOk, Input, Select, SmallSubmitButton, SubmitButton } from "./form";

/**
 * As peças interativas da aba Ponto. Os dados vêm do sistema de ponto (à
 * parte); a página monta tudo no servidor e passa para cá só o que cada
 * formulário precisa.
 */

const botaoLeve =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-micro text-slate-600 transition hover:border-brand-300 hover:text-brand-700";

function useFechaQuandoOk(state: PontoState, fechar?: () => void) {
  useEffect(() => {
    if (state.ok && fechar) fechar();
  }, [state, fechar]);
}

// ----------------------------------------------------------------- horário

function CamposDoHorario({ horario }: { horario: Horario }) {
  return (
    <div className="space-y-1.5">
      {DIAS_DA_SEMANA.map((nome, i) => (
        <label key={nome} className="flex items-center gap-2">
          <span className="w-9 text-micro font-medium uppercase tracking-wider text-slate-500">{nome}</span>
          <input
            name={`horario${i}`}
            defaultValue={horarioEscrito(horario[i] ?? []).replaceAll("–", "-")}
            placeholder="sem expediente"
            className="w-full max-w-sm rounded-md border border-slate-300 px-2 py-1.5 text-sm tabular-nums outline-none focus:border-brand-500"
          />
        </label>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ regras

export type RegrasDaTela = {
  regime: "BANCO_DE_HORAS" | "HORAS_EXTRAS";
  horario: Horario;
  tolerancia: number;
  intervaloMinimo: number;
  validadeBancoMeses: number;
  inicio: string;
  ativo: boolean;
};

export function ConfigForm({ companyId, config }: { companyId: string; config: RegrasDaTela }) {
  const [state, action] = useActionState<PontoState, FormData>(salvarRegras, {});
  const [regime, setRegime] = useState(config.regime);

  return (
    <form action={action}>
      <Painel titulo="Regras do ponto desta empresa" descricao="Mudar aqui recalcula os horários na hora.">
        <input type="hidden" name="companyId" value={companyId} />

        <p className="mb-1.5 text-sm font-medium text-slate-700">Horário padrão</p>
        <CamposDoHorario horario={config.horario} />
        <p className="mt-1 text-micro text-slate-500">
          Um ou mais trechos por dia, como 08:00-12:00 13:00-17:00. Em branco é dia sem expediente. O que for trabalhado fora deste horário
          é hora extra; o que dele ficar sem trabalhar é atraso ou falta. Colaborador com escala diferente ganha o próprio horário na tela
          dele.
        </p>

        <p className="mb-1.5 mt-4 text-sm font-medium text-slate-700">O que acontece com a hora a mais</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {(
            [
              ["HORAS_EXTRAS", "Horas extras", "Paga em folha: 50% em dia útil, 100% em domingo e feriado. O que falta é desconto."],
              ["BANCO_DE_HORAS", "Banco de horas", "A hora a mais vira crédito, a que falta vira débito, e o colaborador compensa com folga."],
            ] as const
          ).map(([valor, titulo, texto]) => (
            <label
              key={valor}
              className={`cursor-pointer rounded-lg border p-3 transition ${
                regime === valor ? "border-brand-500 bg-brand-50/60" : "border-slate-200 hover:border-brand-300"
              }`}
            >
              <input type="radio" name="regime" value={valor} checked={regime === valor} onChange={() => setRegime(valor)} className="sr-only" />
              <span className="block text-sm font-semibold text-slate-800">{titulo}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{texto}</span>
            </label>
          ))}
        </div>

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
          Registro de ponto ligado (desligado, os colaboradores não conseguem bater ponto)
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

// ------------------------------------------------------------- colaborador

export function HorarioDoColaborador({
  companyId,
  colaborador,
  horarioDaEmpresa,
}: {
  companyId: string;
  colaborador: { id: string; horario: Horario | null; admissao: string | null };
  horarioDaEmpresa: Horario;
}) {
  const [aberto, setAberto] = useState(false);
  const [state, action] = useActionState<PontoState, FormData>(salvarColaborador, {});
  const [proprio, setProprio] = useState(Boolean(colaborador.horario));
  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className={`${botaoLeve} no-print`}>
        Horário e admissão
      </button>
    );
  }
  return (
    <Modal titulo="Horário e admissão do colaborador" aoFechar={() => setAberto(false)} largura="xl">
      <form action={action} className="space-y-3">
        <input type="hidden" name="companyId" value={companyId} />
        <input type="hidden" name="colaboradorId" value={colaborador.id} />
        <Field label="Admissão" hint="Dias antes dela ficam de fora do espelho.">
          <Input type="date" name="admissao" defaultValue={colaborador.admissao ?? ""} />
        </Field>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="horarioProprio" checked={proprio} onChange={(e) => setProprio(e.target.checked)} />
          Horário diferente do da empresa (escala, meio período)
        </label>
        {proprio ? <CamposDoHorario horario={colaborador.horario ?? horarioDaEmpresa} /> : null}
        <FormError message={state.error} />
        <SmallSubmitButton>Salvar</SmallSubmitButton>
      </form>
    </Modal>
  );
}

// ------------------------------------------------------------------ espelho

function DetalheDaBatida({ companyId, m, fechar }: { companyId: string; m: MarcacaoNoPonto; fechar: () => void }) {
  const [pendente, iniciar] = useTransition();
  const [motivo, setMotivo] = useState("");
  const mapa =
    m.latitude !== null && m.longitude !== null
      ? `https://www.google.com/maps?q=${m.latitude.toFixed(6)},${m.longitude.toFixed(6)}`
      : null;

  return (
    <Modal titulo={`Batida das ${relogio(m.minuto)}`} aoFechar={fechar} largura="lg">
      <div className="space-y-3 text-sm text-slate-700">
        <p>
          {m.origem === "MANUAL" ? `Incluída pelo RH: ${m.motivo ?? ""}` : "Registrada pelo colaborador no aplicativo do ponto."} · NSR {m.nsr}
        </p>
        {m.temFoto ? (
          // eslint-disable-next-line @next/next/no-img-element -- a foto vem do ponto pelo próprio RH, sem otimização
          <img
            src={`/api/ponto/foto?empresa=${encodeURIComponent(companyId)}&id=${encodeURIComponent(m.id)}`}
            alt="Foto tirada na batida"
            className="max-h-80 rounded-lg border border-slate-200"
          />
        ) : null}
        {mapa ? (
          <a href={mapa} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 underline">
            <MapPin size={14} /> Ver o local no mapa{m.precisao ? ` (precisão de ${Math.round(m.precisao)} m)` : ""}
          </a>
        ) : null}
        {m.anulada ? (
          <div className="rounded-md bg-slate-50 p-2">
            <p>Anulada: {m.anuladaMotivo}</p>
            <button
              type="button"
              disabled={pendente}
              className={`${botaoLeve} mt-2`}
              onClick={() =>
                iniciar(async () => {
                  const r = await restaurarMarcacao(companyId, m.id);
                  avisarSeErro(r);
                  if (r.ok) fechar();
                })
              }
            >
              <RotateCcw size={12} /> Restaurar a batida
            </button>
          </div>
        ) : (
          <form
            className="space-y-2 border-t border-slate-100 pt-3"
            onSubmit={(e) => {
              e.preventDefault();
              iniciar(async () => {
                const r = await anularMarcacao(companyId, m.id, motivo);
                avisarSeErro(r);
                if (r.ok) fechar();
              });
            }}
          >
            <Field label="Anular esta batida" hint="Ela continua no histórico, riscada, com o motivo.">
              <Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Motivo (ex.: batida em duplicidade)" required minLength={3} />
            </Field>
            <button type="submit" disabled={pendente} className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60">
              {pendente ? "Anulando…" : "Anular"}
            </button>
          </form>
        )}
      </div>
    </Modal>
  );
}

function Batida({ companyId, m, podeMexer }: { companyId: string; m: MarcacaoNoPonto; podeMexer: boolean }) {
  const [aberto, setAberto] = useState(false);
  const titulo = [
    `NSR ${m.nsr}`,
    m.origem === "MANUAL" ? `incluída pelo RH: ${m.motivo ?? ""}` : "registrada no aplicativo",
    m.anulada ? `anulada: ${m.anuladaMotivo ?? ""}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <button
        type="button"
        title={titulo}
        disabled={!podeMexer}
        onClick={() => setAberto(true)}
        className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-mini tabular-nums ${
          m.anulada ? "bg-slate-100 text-slate-500 line-through" : m.origem === "MANUAL" ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-800"
        }`}
      >
        {relogio(m.minuto)}
        {m.minuto >= 1440 ? <sup className="text-micro">+1</sup> : null}
        {m.origem === "MANUAL" ? <span className="text-micro">*</span> : null}
        {m.temFoto ? <Camera size={10} className="no-print ml-0.5 opacity-60" aria-label="com foto" /> : null}
      </button>
      {aberto ? <DetalheDaBatida companyId={companyId} m={m} fechar={() => setAberto(false)} /> : null}
    </>
  );
}

function IncluirBatida({ companyId, colaboradorId, dia, fechar }: { companyId: string; colaboradorId: string; dia: string; fechar: () => void }) {
  const [state, action] = useActionState<PontoState, FormData>(incluirMarcacao, {});
  useFechaQuandoOk(state, fechar);
  return (
    <form action={action} className="no-print mt-1.5 flex flex-wrap items-end gap-1.5 rounded-md border border-slate-200 bg-white p-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="colaboradorId" value={colaboradorId} />
      <input type="hidden" name="dia" value={dia} />
      <input type="time" name="hora" required autoFocus className="rounded border border-slate-300 px-1.5 py-1 text-xs" />
      <label className="flex items-center gap-1 text-micro text-slate-500">
        <input type="checkbox" name="diaSeguinte" /> dia seguinte
      </label>
      <input
        name="motivo"
        required
        placeholder="Motivo (ex.: esqueceu de bater a saída)"
        className="min-w-[14rem] flex-1 rounded border border-slate-300 px-1.5 py-1 text-xs"
      />
      <SmallSubmitButton>Incluir</SmallSubmitButton>
      <button type="button" onClick={fechar} className="text-micro text-slate-500">
        cancelar
      </button>
      {state.error ? <p className="w-full text-micro text-red-600">{state.error}</p> : null}
    </form>
  );
}

function OcorrenciaDoDia({ companyId, colaboradorId, dia, fechar }: { companyId: string; colaboradorId: string; dia: string; fechar: () => void }) {
  const [state, action] = useActionState<PontoState, FormData>(salvarOcorrencia, {});
  useFechaQuandoOk(state, fechar);
  return (
    <form action={action} className="no-print mt-1.5 flex flex-wrap items-end gap-1.5 rounded-md border border-slate-200 bg-white p-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="colaboradorId" value={colaboradorId} />
      <input type="hidden" name="de" value={dia} />
      <select name="tipo" className="rounded border border-slate-300 px-1.5 py-1 text-xs" defaultValue="ABONO">
        <option value="ABONO">Abono</option>
        <option value="ATESTADO">Atestado</option>
        <option value="FOLGA">Folga</option>
        <option value="FERIAS">Férias</option>
      </select>
      <input name="descricao" placeholder="Observação" className="min-w-[12rem] flex-1 rounded border border-slate-300 px-1.5 py-1 text-xs" />
      <SmallSubmitButton>Lançar</SmallSubmitButton>
      <button type="button" onClick={fechar} className="text-micro text-slate-500">
        cancelar
      </button>
      {state.error ? <p className="w-full text-micro text-red-600">{state.error}</p> : null}
    </form>
  );
}

function TirarOcorrencia({ companyId, id }: { companyId: string; id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      aria-label="Tirar ocorrência"
      className="no-print ml-0.5 text-slate-500 hover:text-red-600"
      onClick={async () => {
        if (await confirmar("Tirar esta ocorrência do dia?")) iniciar(async () => avisarSeErro(await excluirOcorrencia(companyId, id)));
      }}
    >
      <X size={10} />
    </button>
  );
}

const NOME_CURTO_DO_MES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function Espelho({
  companyId,
  colaboradorId,
  dias,
  regime,
}: {
  companyId: string;
  colaboradorId: string;
  dias: DiaNoPonto[];
  regime: "BANCO_DE_HORAS" | "HORAS_EXTRAS";
}) {
  const [aberto, setAberto] = useState<{ dia: string; o: "batida" | "ocorrencia" } | null>(null);
  const fechar = useRef(() => setAberto(null)).current;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[820px] text-mini">
        <thead>
          <tr className="border-b border-slate-200 text-left text-micro uppercase tracking-wider text-slate-500">
            <th className="px-2 py-1.5 font-medium">Dia</th>
            <th className="px-2 py-1.5 font-medium">Horário</th>
            <th className="px-2 py-1.5 font-medium">Marcações</th>
            <th className="px-2 py-1.5 text-right font-medium">Trabalhado</th>
            <th className="px-2 py-1.5 text-right font-medium">Extra</th>
            <th className="px-2 py-1.5 text-right font-medium">Atraso/falta</th>
            {regime === "BANCO_DE_HORAS" ? <th className="px-2 py-1.5 text-right font-medium">Banco</th> : null}
            <th className="px-2 py-1.5 font-medium">Observações</th>
            <th className="no-print px-2 py-1.5" />
          </tr>
        </thead>
        <tbody>
          {dias.map((d) => {
            const [, mes, dia] = d.dia.split("-").map(Number);
            const fimDeSemana = d.semana === 0 || d.semana === 6;
            const temAlerta = d.alertas.length > 0;
            const extra = d.extras50 + d.extras100;
            const semConta = d.foraDoPeriodo || d.emAndamento;
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
                  <span className="text-slate-500">{DIAS_DA_SEMANA[d.semana]}</span>
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 tabular-nums text-slate-500">{d.foraDoPeriodo ? "" : horarioEscrito(d.horario) || "—"}</td>
                <td className="min-w-[13rem] px-2 py-1.5">
                  <div className="flex flex-wrap gap-1">
                    {d.marcacoes.map((m) => (
                      <Batida key={m.id} companyId={companyId} m={m} podeMexer={!d.foraDoPeriodo} />
                    ))}
                    {d.marcacoes.length === 0 && !d.foraDoPeriodo ? <span className="text-slate-300">—</span> : null}
                  </div>
                  {aberto?.dia === d.dia && aberto.o === "batida" ? (
                    <IncluirBatida companyId={companyId} colaboradorId={colaboradorId} dia={d.dia} fechar={fechar} />
                  ) : null}
                  {aberto?.dia === d.dia && aberto.o === "ocorrencia" ? (
                    <OcorrenciaDoDia companyId={companyId} colaboradorId={colaboradorId} dia={d.dia} fechar={fechar} />
                  ) : null}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">
                  {d.foraDoPeriodo || (!d.trabalhado && !d.marcacoes.length) ? "" : horas(d.trabalhado)}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">
                  {!semConta && extra ? horas(extra) : ""}
                  {!semConta && d.extras100 > 0 ? <span className="block text-micro">100%</span> : null}
                </td>
                <td className="px-2 py-1.5 text-right tabular-nums text-red-700">{!semConta && d.debito ? horas(d.debito) : ""}</td>
                {regime === "BANCO_DE_HORAS" ? (
                  <td className={`px-2 py-1.5 text-right font-medium tabular-nums ${d.saldo > 0 ? "text-emerald-700" : d.saldo < 0 ? "text-red-700" : "text-slate-300"}`}>
                    {semConta ? "" : saldoEscrito(d.saldo)}
                  </td>
                ) : null}
                <td className="px-2 py-1.5">
                  <div className="flex flex-wrap items-center gap-1">
                    {d.foraDoPeriodo ? <span className="text-micro">fora do período</span> : null}
                    {d.emAndamento ? <Etiqueta tom="azul">hoje</Etiqueta> : null}
                    {d.ocorrencia ? (
                      <span className="inline-flex items-center">
                        <Etiqueta tom="azul">
                          {NOME_DA_OCORRENCIA[d.ocorrencia]}
                          {d.ocorrenciaDescricao ? `: ${d.ocorrenciaDescricao}` : ""}
                        </Etiqueta>
                        {d.ocorrenciaId && d.ocorrencia !== "FERIADO" ? <TirarOcorrencia companyId={companyId} id={d.ocorrenciaId} /> : null}
                      </span>
                    ) : null}
                    {d.abonado > 0 ? <span className="text-micro text-slate-500">abonado {horas(d.abonado)}</span> : null}
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
                      <button type="button" className={botaoLeve} onClick={() => setAberto({ dia: d.dia, o: "batida" })} title="Completar horário faltante">
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

export function OcorrenciaForm({ companyId, pessoas, hoje }: { companyId: string; pessoas: { id: string; nome: string }[]; hoje: string }) {
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
          <Field label="Colaborador">
            {tipo === "FERIADO" ? (
              <Input value="Empresa toda" disabled readOnly />
            ) : (
              <Select name="colaboradorId" required defaultValue="">
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
        <p className="mt-1 text-micro text-slate-500">
          Feriado, folga e férias tiram o horário do dia. Abono e atestado mantêm o horário e dão por cumprido o que faltou.
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

export function ExcluirOcorrencia({ companyId, id }: { companyId: string; id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      aria-label="Excluir"
      className="text-slate-500 transition hover:text-red-600"
      onClick={async () => {
        if (await confirmar("Excluir esta ocorrência?")) iniciar(async () => avisarSeErro(await excluirOcorrencia(companyId, id)));
      }}
    >
      <Trash2 size={13} />
    </button>
  );
}

// ------------------------------------------------------------------- banco

export function LancamentoForm({ companyId, colaboradorId, hoje }: { companyId: string; colaboradorId: string; hoje: string }) {
  const [state, action] = useActionState<PontoState, FormData>(lancarNoBanco, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="no-print space-y-2">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="colaboradorId" value={colaboradorId} />
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

export function ExcluirLancamento({ companyId, id }: { companyId: string; id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      aria-label="Excluir lançamento"
      className="no-print text-slate-500 transition hover:text-red-600"
      onClick={async () => {
        if (await confirmar("Excluir este lançamento do banco?")) iniciar(async () => avisarSeErro(await excluirLancamento(companyId, id)));
      }}
    >
      <Trash2 size={13} />
    </button>
  );
}

// ---------------------------------------------------------------- relatório

export function EnviarRelatorio({ companyId, colaboradorId, mes, jaEnviado }: { companyId: string; colaboradorId: string; mes: string; jaEnviado: boolean }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button
      type="button"
      disabled={pendente}
      className="no-print inline-flex items-center gap-1.5 rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
      onClick={async () => {
        if (jaEnviado && !(await confirmar("Este mês já foi enviado. Enviar de novo com os ajustes de agora? O colaborador terá de conferir outra vez."))) return;
        iniciar(async () => {
          const r = await enviarRelatorio(companyId, colaboradorId, mes);
          if (r.error) avisar(r.error);
          else if (r.mensagem) avisar(r.mensagem);
        });
      }}
    >
      <Send size={12} /> {pendente ? "Enviando…" : jaEnviado ? "Reenviar ao colaborador" : "Enviar ao colaborador"}
    </button>
  );
}
