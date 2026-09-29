"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, CalendarPlus, Check, ChevronDown, ChevronRight, Copy, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import {
  adicionarEncontro,
  criarPlano,
  editarPlano,
  excluirEncontro,
  excluirPlano,
  mandarParaAgenda,
  mandarTodosParaAgenda,
  marcarRealizado,
  moverEncontro,
  mudarDataDoEncontro,
  prepararEncontro,
  mudarTema,
  remarcarPendentes,
  replicarPlano,
  tirarDaAgenda,
  type PlanoState,
} from "@/app/(app)/empresas/[id]/planejamento/actions";
import {
  andamentoDosEncontros,
  datasDoPlano,
  lerTemas,
  PERIODICIDADES,
  ROTULO_DO_ESTADO,
  rotuloDaPeriodicidade,
  type Andamento,
  type EstadoDoEncontro,
  type Periodicidade,
} from "@/lib/planos";
import { Aviso, Etiqueta, Painel, TituloDaSecao, Vazio } from "./ui";
import { Field, FormError, Input, Select, SmallSubmitButton, SubmitButton, Textarea } from "./form";

/**
 * Os planos de treinamento da empresa.
 *
 * Criar um plano: produto, nome, objetivo, periodicidade, os temas (um por
 * linha) e as filiais onde vai acontecer, cada uma com a sua primeira data. O
 * plano só planeja: cada encontro vai para a agenda pelo botão "Mandar para a
 * agenda", e na agenda vira reunião (pauta e ata) pelo "Mandar para reunião".
 */

export type EncontroNaTela = {
  id: string;
  tema: string;
  dia: string | null;
  hora: string | null;
  estado: EstadoDoEncontro;
  reuniaoId: string | null;
};

export type LocalNaTela = { chave: string; nome: string; encontros: EncontroNaTela[] };

export type PlanoNaTela = {
  id: string;
  titulo: string;
  objetivo: string;
  periodicidade: string;
  horario: string | null;
  status: string;
  produto: { id: string; nome: string } | null;
  andamento: Andamento;
  locais: LocalNaTela[];
};

type Opcao = { id: string; nome: string; ativo?: boolean };

const EMPRESA = "EMPRESA";

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";

const STATUS_DO_PLANO: Record<string, { rotulo: string; tom: "bom" | "atencao" | "neutro" | "azul" }> = {
  ATIVO: { rotulo: "em andamento", tom: "azul" },
  PAUSADO: { rotulo: "pausado", tom: "atencao" },
  CONCLUIDO: { rotulo: "concluído", tom: "bom" },
};

const TOM_DO_ESTADO: Record<EstadoDoEncontro, "neutro" | "azul" | "atencao" | "bom"> = {
  PLANEJADO: "neutro",
  NA_AGENDA: "azul",
  EM_REUNIAO: "azul",
  REALIZADO: "bom",
};

function dataCurta(dia: string) {
  const [a, m, d] = dia.split("-");
  return `${d}/${m}/${a}`;
}

// ---------------------------------------------------------------- novo plano

function NovoPlano({
  companyId,
  produtos,
  filiais,
  hoje,
  fechar,
}: {
  companyId: string;
  produtos: Opcao[];
  filiais: Opcao[];
  hoje: string;
  fechar: () => void;
}) {
  const [state, action] = useActionState<PlanoState, FormData>(criarPlano, {});
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("MENSAL");
  const [temas, setTemas] = useState("");
  // Sem filial cadastrada, o plano é da empresa toda.
  const locais = filiais.length > 0 ? filiais : [{ id: EMPRESA, nome: "Empresa toda" }];
  // Começa numa filial só: prepara os encontros nela e depois replica para as outras.
  const [marcados, setMarcados] = useState<string[]>(filiais.length > 0 ? [] : [EMPRESA]);
  const [inicios, setInicios] = useState<Record<string, string>>({});

  useEffect(() => {
    if (state.ok) fechar();
  }, [state, fechar]);

  const lista = useMemo(() => lerTemas(temas), [temas]);

  return (
    <form action={action}>
      <Painel titulo="Novo plano de treinamento" descricao="O plano só planeja. Depois, cada encontro vai para a agenda pelo botão “Mandar para a agenda”.">
        <input type="hidden" name="companyId" value={companyId} />
        <div className="grid gap-3 lg:grid-cols-[3fr_2fr]">
          <div className="space-y-2">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Produto">
                <Select name="serviceId" required defaultValue="">
                  <option value="" disabled>
                    Escolha…
                  </option>
                  {/* Plano novo só com produto ativo no catálogo. */}
                  {produtos
                    .filter((p) => p.ativo !== false)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                </Select>
              </Field>
              <Field label="Nome do plano">
                <Input name="titulo" required placeholder="Ex.: Liderança para gestores 2026" />
              </Field>
            </div>
            <Field label="Objetivo" hint="O que você prometeu entregar com este plano.">
              <Textarea name="objetivo" rows={3} required />
            </Field>
            <Field label="Periodicidade" hint={PERIODICIDADES.find((p) => p.valor === periodicidade)?.explicacao}>
              <Select name="periodicidade" value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}>
                {PERIODICIDADES.map((p) => (
                  <option key={p.valor} value={p.valor}>
                    {p.rotulo}
                  </option>
                ))}
              </Select>
            </Field>

            <div>
              <p className="mb-1 text-sm font-medium text-slate-700">Onde começa</p>
              <p className="mb-1.5 text-[11px] text-slate-500">
                Escolha uma filial, com a primeira data e o horário. Prepare as pautas nela e depois use “Replicar para outras
                filiais” no plano.
              </p>
              <div className="space-y-1.5">
                {locais.map((f) => {
                  const marcado = marcados.includes(f.id);
                  const inicio = inicios[f.id] ?? hoje;
                  const datas = marcado && periodicidade !== "LIVRE" && lista.length ? datasDoPlano(inicio, periodicidade, Math.min(lista.length, 4)) : [];
                  return (
                    <div key={f.id} className={`rounded-lg border px-2.5 py-2 ${marcado ? "border-brand-300 bg-brand-50/40" : "border-slate-200"}`}>
                      <label className="flex items-center gap-2 text-sm text-slate-800">
                        <input
                          type="radio"
                          name="filial"
                          value={f.id}
                          checked={marcado}
                          onChange={() => setMarcados([f.id])}
                          className="h-4 w-4 accent-brand-600"
                        />
                        {f.nome}
                      </label>
                      {marcado && periodicidade !== "LIVRE" ? (
                        <div className="mt-1.5 flex flex-wrap items-center gap-2 pl-6">
                          <label className="text-[11px] text-slate-500">
                            1º encontro{" "}
                            <input
                              type="date"
                              name={`inicio-${f.id}`}
                              value={inicio}
                              onChange={(e) => setInicios((a) => ({ ...a, [f.id]: e.target.value }))}
                              required
                              className="rounded border border-slate-300 px-1.5 py-0.5 text-xs"
                            />
                          </label>
                          <label className="text-[11px] text-slate-500">
                            às{" "}
                            <input type="time" name={`hora-${f.id}`} defaultValue="14:00" required className="rounded border border-slate-300 px-1.5 py-0.5 text-xs" />
                          </label>
                          {datas.length ? (
                            <span className="text-[10px] text-slate-400">
                              {datas.map((d) => dataCurta(d!)).join(", ")}
                              {lista.length > 4 ? "…" : ""}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <Field label="Temas — um por linha" hint="Cada linha é um encontro, nesta ordem.">
              <Textarea
                name="temas"
                rows={12}
                value={temas}
                onChange={(e) => setTemas(e.target.value)}
                placeholder={"Comunicação assertiva\nFeedback que funciona\nGestão do tempo"}
              />
            </Field>
            {lista.length > 0 ? (
              <p className="mt-1 text-[11px] text-slate-500">
                {lista.length} encontro(s)
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <SubmitButton pendingLabel="Criando…">Criar o plano</SubmitButton>
          <button type="button" onClick={fechar} className="text-xs text-slate-500 hover:text-slate-800">
            cancelar
          </button>
        </div>
        <div className="mt-2">
          <FormError message={state.error} />
        </div>
      </Painel>
    </form>
  );
}

// ----------------------------------------------------------- editar plano

function EditarPlano({ plano, produtos, fechar }: { plano: PlanoNaTela; produtos: Opcao[]; fechar: () => void }) {
  const [state, action] = useActionState<PlanoState, FormData>(editarPlano, {});
  useEffect(() => {
    if (state.ok) fechar();
  }, [state, fechar]);

  return (
    <form action={action} className="space-y-2 rounded-lg border border-slate-200 bg-slate-50/60 p-3">
      <input type="hidden" name="id" value={plano.id} />
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="Produto">
          <Select name="serviceId" required defaultValue={plano.produto?.id ?? ""}>
            <option value="" disabled>
              Escolha…
            </option>
            {/* Ativos, e o do próprio plano mesmo que tenha sido desativado. */}
            {produtos
              .filter((p) => p.ativo !== false || p.id === plano.produto?.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nome}
                </option>
              ))}
          </Select>
        </Field>
        <Field label="Nome do plano">
          <Input name="titulo" required defaultValue={plano.titulo} />
        </Field>
      </div>
      <Field label="Objetivo">
        <Textarea name="objetivo" rows={3} required defaultValue={plano.objetivo} />
      </Field>
      <div className="grid gap-2 sm:grid-cols-3">
        <Field label="Periodicidade" hint="Vale para os encontros acrescentados ou remarcados.">
          <Select name="periodicidade" defaultValue={plano.periodicidade}>
            {PERIODICIDADES.map((p) => (
              <option key={p.valor} value={p.valor}>
                {p.rotulo}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Horário de costume">
          <Input type="time" name="horario" defaultValue={plano.horario ?? ""} />
        </Field>
        <Field label="Situação">
          <Select name="status" defaultValue={plano.status}>
            <option value="ATIVO">Em andamento</option>
            <option value="PAUSADO">Pausado</option>
            <option value="CONCLUIDO">Concluído</option>
          </Select>
        </Field>
      </div>
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        <SmallSubmitButton>Salvar</SmallSubmitButton>
        <button type="button" onClick={fechar} className="text-[11px] text-slate-500">
          cancelar
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- encontro

function DataDoEncontro({ e, fechar }: { e: EncontroNaTela; fechar: () => void }) {
  const [state, action] = useActionState<PlanoState, FormData>(mudarDataDoEncontro, {});
  const [aAgendar, setAAgendar] = useState(!e.dia);
  useEffect(() => {
    if (state.ok) fechar();
  }, [state, fechar]);

  return (
    <form action={action} className="mt-1 flex flex-wrap items-center gap-1.5">
      <input type="hidden" name="encontroId" value={e.id} />
      <input type="date" name="dia" defaultValue={e.dia ?? ""} disabled={aAgendar} className="rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:bg-slate-100" />
      <input type="time" name="hora" defaultValue={e.hora ?? "14:00"} disabled={aAgendar} className="rounded border border-slate-300 px-1.5 py-0.5 text-xs disabled:bg-slate-100" />
      {e.estado === "PLANEJADO" ? (
        <label className="flex items-center gap-1 text-[11px] text-slate-500">
          <input type="checkbox" name="aAgendar" checked={aAgendar} onChange={(ev) => setAAgendar(ev.target.checked)} /> sem data
        </label>
      ) : null}
      <SmallSubmitButton>OK</SmallSubmitButton>
      <button type="button" onClick={fechar} className="text-[11px] text-slate-500">
        cancelar
      </button>
      {state.error ? <span className="w-full text-[11px] text-red-600">{state.error}</span> : null}
    </form>
  );
}

function LinhaDoEncontro({
  companyId,
  e,
  posicao,
  primeiro,
  ultimo,
  hoje,
}: {
  companyId: string;
  e: EncontroNaTela;
  posicao: number;
  primeiro: boolean;
  ultimo: boolean;
  hoje: string;
}) {
  const router = useRouter();
  const [pendente, iniciar] = useTransition();
  const [mudandoData, setMudandoData] = useState(false);
  const [tema, setTema] = useState(e.tema);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => setTema(e.tema), [e.tema]);

  const realizado = e.estado === "REALIZADO";
  const atrasado = !realizado && e.dia !== null && e.dia < hoje;

  const rodar = (f: () => Promise<{ error?: string }>) =>
    iniciar(async () => {
      const r = await f();
      setErro(r.error ?? null);
    });

  return (
    <li className={`flex items-start gap-2.5 border-b border-slate-100 px-3 py-2 last:border-b-0 ${realizado ? "bg-emerald-50/40" : ""}`}>
      <button
        type="button"
        disabled={pendente || e.estado === "PLANEJADO"}
        title={
          e.estado === "PLANEJADO"
            ? "Mande para a agenda antes de marcar como realizado"
            : realizado
              ? "Desmarcar realizado"
              : "Marcar como realizado"
        }
        onClick={() => rodar(() => marcarRealizado(e.id, !realizado))}
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-40 ${
          realizado ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-white text-transparent hover:border-emerald-400 hover:text-emerald-400"
        }`}
      >
        <Check size={12} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="w-5 shrink-0 text-right text-[11px] tabular-nums text-slate-400">{posicao}.</span>
          <input
            value={tema}
            onChange={(ev) => setTema(ev.target.value)}
            onBlur={() => {
              if (tema.trim() && tema.trim() !== e.tema) rodar(() => mudarTema(e.id, tema));
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") (ev.target as HTMLInputElement).blur();
            }}
            className={`min-w-0 flex-1 rounded border border-transparent bg-transparent px-1 py-0.5 text-[13px] outline-none transition hover:border-slate-200 focus:border-brand-400 focus:bg-white ${
              realizado ? "text-slate-500" : "text-slate-800"
            }`}
            aria-label="Tema do encontro"
          />
        </div>
        <div className="ml-6 flex flex-wrap items-center gap-1.5 text-[11px]">
          <button type="button" onClick={() => setMudandoData((v) => !v)} className="text-slate-500 hover:text-brand-700" title="Mudar a data">
            {e.dia ? `${dataCurta(e.dia)}${e.hora ? ` às ${e.hora}` : ""}` : "sem data"}
          </button>
          <Etiqueta tom={atrasado ? "atencao" : TOM_DO_ESTADO[e.estado]}>
            {atrasado && e.estado !== "PLANEJADO" ? "passou sem marcar" : ROTULO_DO_ESTADO[e.estado]}
          </Etiqueta>
        </div>
        {mudandoData ? (
          <div className="ml-6">
            <DataDoEncontro e={e} fechar={() => setMudandoData(false)} />
          </div>
        ) : null}
        {erro ? <p className="ml-6 text-[11px] text-red-600">{erro}</p> : null}
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-0.5">
        {/* Preparar: a mesma página de uma reunião (pauta, participantes, ata,
            apresentação), antes de o encontro ir para reunião. */}
        {e.reuniaoId ? (
          <Link
            href={`/empresas/${companyId}/reunioes/${e.reuniaoId}`}
            className={botao}
            title="Pauta, participantes, ata e apresentação"
          >
            <NotebookPen size={11} /> {e.estado === "EM_REUNIAO" || e.estado === "REALIZADO" ? "abrir reunião" : "abrir preparação"}
          </Link>
        ) : (
          <button
            type="button"
            disabled={pendente}
            className={botao}
            title="Pauta, participantes, ata e apresentação, como numa reunião"
            onClick={() =>
              iniciar(async () => {
                const r = await prepararEncontro(e.id);
                setErro(r.error ?? null);
                if (r.id) router.push(`/empresas/${companyId}/reunioes/${r.id}`);
              })
            }
          >
            <NotebookPen size={11} /> Preparar
          </button>
        )}
        {e.estado === "PLANEJADO" ? (
          <button type="button" disabled={pendente} className={`${botao} border-brand-300 text-brand-700`} onClick={() => rodar(() => mandarParaAgenda(e.id))}>
            <CalendarPlus size={11} /> Mandar para a agenda
          </button>
        ) : e.estado === "EM_REUNIAO" || (e.estado === "REALIZADO" && e.reuniaoId) ? null : (
          <>
            <Link href={`/empresas/${companyId}/agenda`} className={botao} title="Na agenda, “Mandar para reunião” cria a pauta e a ata">
              ver na agenda
            </Link>
            {!realizado ? (
              <button
                type="button"
                disabled={pendente}
                className="px-1 text-[10px] text-slate-400 hover:text-red-600"
                onClick={() => {
                  if (confirm(`Tirar "${e.tema}" da agenda? Ele continua no plano.`)) rodar(() => tirarDaAgenda(e.id));
                }}
              >
                tirar da agenda
              </button>
            ) : null}
          </>
        )}
        <button type="button" disabled={pendente || primeiro} onClick={() => rodar(() => moverEncontro(e.id, "subir"))} className="p-1 text-slate-400 hover:text-brand-700 disabled:opacity-30" aria-label="Subir">
          <ArrowUp size={13} />
        </button>
        <button type="button" disabled={pendente || ultimo} onClick={() => rodar(() => moverEncontro(e.id, "descer"))} className="p-1 text-slate-400 hover:text-brand-700 disabled:opacity-30" aria-label="Descer">
          <ArrowDown size={13} />
        </button>
        <button
          type="button"
          disabled={pendente}
          aria-label="Tirar do plano"
          onClick={() => {
            const preparando = e.reuniaoId && (e.estado === "PLANEJADO" || e.estado === "NA_AGENDA");
            const aviso = preparando
              ? `Tirar "${e.tema}" do plano? A preparação sai junto; se já tiver pauta ou ata, fica guardada como arquivada na aba Reuniões.`
              : e.reuniaoId
              ? `Tirar "${e.tema}" do plano? A reunião continua na aba Reuniões, com a ata.`
              : `Tirar "${e.tema}" do plano?${e.estado === "NA_AGENDA" ? " O compromisso da agenda sai junto." : ""}`;
            if (confirm(aviso)) rodar(() => excluirEncontro(e.id));
          }}
          className="p-1 text-slate-400 hover:text-red-600"
        >
          <Trash2 size={13} />
        </button>
      </div>
    </li>
  );
}

// ----------------------------------------------------------------- local

function Remarcar({ planoId, local, horario, hoje, fechar }: { planoId: string; local: LocalNaTela; horario: string | null; hoje: string; fechar: () => void }) {
  const [state, action] = useActionState<PlanoState, FormData>(remarcarPendentes, {});
  useEffect(() => {
    if (state.ok) fechar();
  }, [state, fechar]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
      <input type="hidden" name="planoId" value={planoId} />
      <input type="hidden" name="filial" value={local.chave} />
      <p className="w-full text-[11px] text-slate-600">
        Os encontros de {local.nome} que ainda não aconteceram vão ser remarcados em sequência, a partir do dia escolhido. Na agenda e nas
        reuniões, as datas acompanham.
      </p>
      <Field label="Próximo encontro em">
        <Input type="date" name="aPartirDe" defaultValue={hoje} required />
      </Field>
      <Field label="Horário">
        <Input type="time" name="hora" defaultValue={horario ?? "14:00"} required />
      </Field>
      <SmallSubmitButton>Remarcar</SmallSubmitButton>
      <button type="button" onClick={fechar} className="pb-2 text-[11px] text-slate-500">
        cancelar
      </button>
      {state.error ? <p className="w-full text-[11px] text-red-600">{state.error}</p> : null}
    </form>
  );
}

function NovoEncontro({ planoId, local, fechar }: { planoId: string; local: LocalNaTela; fechar: () => void }) {
  const [state, action] = useActionState<PlanoState, FormData>(adicionarEncontro, {});
  useEffect(() => {
    if (state.ok) fechar();
  }, [state, fechar]);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2 border-t border-slate-100 px-3 py-2">
      <input type="hidden" name="planoId" value={planoId} />
      <input type="hidden" name="filial" value={local.chave} />
      <div className="min-w-[14rem] flex-1">
        <Field label="Tema">
          <Input name="tema" required autoFocus />
        </Field>
      </div>
      <Field label="Dia" hint="Vazio: a próxima data do plano.">
        <Input type="date" name="dia" />
      </Field>
      <Field label="Horário">
        <Input type="time" name="hora" />
      </Field>
      <SmallSubmitButton>Acrescentar</SmallSubmitButton>
      <button type="button" onClick={fechar} className="pb-2 text-[11px] text-slate-500">
        cancelar
      </button>
      {state.error ? <p className="w-full text-[11px] text-red-600">{state.error}</p> : null}
    </form>
  );
}

function BlocoDoLocal({ companyId, plano, local, hoje }: { companyId: string; plano: PlanoNaTela; local: LocalNaTela; hoje: string }) {
  const [modo, setModo] = useState<null | "remarcar" | "acrescentar">(null);
  const [pendente, iniciar] = useTransition();
  const [erro, setErro] = useState<string | null>(null);
  const a = andamentoDosEncontros(local.encontros, hoje);
  const soNoPlano = local.encontros.filter((e) => e.estado === "PLANEJADO" && e.dia).length;
  const fechar = () => setModo(null);

  return (
    <div className="border-t border-slate-200">
      <div className="flex flex-wrap items-center gap-2 bg-slate-50 px-3 py-1.5">
        <p className="text-[12px] font-semibold text-slate-700">{local.nome}</p>
        <span className="text-[11px] text-slate-500">
          {a.realizadas} de {a.total} realizados
        </span>
        <span className="flex-1" />
        {soNoPlano > 0 ? (
          <button
            type="button"
            disabled={pendente}
            className={`${botao} border-brand-300 text-brand-700`}
            onClick={() =>
              iniciar(async () => {
                const r = await mandarTodosParaAgenda(plano.id, local.chave === EMPRESA ? null : local.chave);
                setErro(r.error ?? null);
              })
            }
          >
            <CalendarPlus size={11} /> Mandar os {soNoPlano} para a agenda
          </button>
        ) : null}
        <button type="button" className={botao} onClick={() => setModo(modo === "remarcar" ? null : "remarcar")}>
          Remarcar
        </button>
      </div>
      {erro ? <p className="px-3 text-[11px] text-red-600">{erro}</p> : null}
      {modo === "remarcar" ? <Remarcar planoId={plano.id} local={local} horario={plano.horario} hoje={hoje} fechar={fechar} /> : null}
      <ol>
        {local.encontros.map((e, i) => (
          <LinhaDoEncontro
            key={e.id}
            companyId={companyId}
            e={e}
            posicao={i + 1}
            primeiro={i === 0}
            ultimo={i === local.encontros.length - 1}
            hoje={hoje}
          />
        ))}
      </ol>
      {modo === "acrescentar" ? (
        <NovoEncontro planoId={plano.id} local={local} fechar={fechar} />
      ) : (
        <div className="border-t border-slate-100 px-3 py-1.5">
          <button type="button" className={botao} onClick={() => setModo("acrescentar")}>
            <Plus size={11} /> Acrescentar encontro em {local.nome}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- replicar

function Replicar({ plano, filiais, hoje, fechar }: { plano: PlanoNaTela; filiais: Opcao[]; hoje: string; fechar: () => void }) {
  const [state, action] = useActionState<PlanoState, FormData>(replicarPlano, {});
  const [marcados, setMarcados] = useState<string[]>([]);
  useEffect(() => {
    if (state.ok) fechar();
  }, [state, fechar]);

  const noPlano = new Set(plano.locais.map((l) => l.chave));
  const livres = filiais.filter((f) => !noPlano.has(f.id));
  const semData = plano.periodicidade === "LIVRE";

  return (
    <form action={action} className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <input type="hidden" name="planoId" value={plano.id} />
      <p className="text-[12px] font-medium text-slate-800">Replicar para outras filiais</p>
      <p className="text-[11px] text-slate-600">
        Copia os temas, na mesma ordem, com a pauta e a apresentação que já foram preparadas. Convocados e ata não vão: são de cada
        filial.
      </p>
      {plano.locais.length > 1 ? (
        <label className="block text-[11px] text-slate-600">
          Copiar de{" "}
          <select name="origem" defaultValue={plano.locais[0].chave} className="rounded border border-slate-300 bg-white px-1.5 py-0.5 text-xs">
            {plano.locais.map((l) => (
              <option key={l.chave} value={l.chave}>
                {l.nome}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="origem" value={plano.locais[0]?.chave ?? EMPRESA} />
      )}
      {livres.length === 0 ? (
        <p className="text-[11px] text-slate-500">Todas as filiais já estão no plano.</p>
      ) : (
        <div className="space-y-1.5">
          {livres.map((f) => {
            const marcado = marcados.includes(f.id);
            return (
              <div key={f.id} className={`rounded-md border bg-white px-2.5 py-1.5 ${marcado ? "border-brand-300" : "border-slate-200"}`}>
                <label className="flex items-center gap-2 text-[13px] text-slate-800">
                  <input
                    type="checkbox"
                    name="destino"
                    value={f.id}
                    checked={marcado}
                    onChange={(e) => setMarcados((a) => (e.target.checked ? [...a, f.id] : a.filter((x) => x !== f.id)))}
                    className="h-4 w-4 accent-brand-600"
                  />
                  {f.nome}
                </label>
                {marcado && !semData ? (
                  <div className="mt-1 flex flex-wrap items-center gap-2 pl-6 text-[11px] text-slate-500">
                    <label>
                      1º encontro{" "}
                      <input type="date" name={`inicio-${f.id}`} defaultValue={hoje} required className="rounded border border-slate-300 px-1.5 py-0.5 text-xs" />
                    </label>
                    <label>
                      às{" "}
                      <input type="time" name={`hora-${f.id}`} defaultValue={plano.horario ?? "14:00"} required className="rounded border border-slate-300 px-1.5 py-0.5 text-xs" />
                    </label>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <FormError message={state.error} />
      <div className="flex items-center gap-3">
        {livres.length > 0 ? <SmallSubmitButton pendingLabel="Replicando…">Replicar</SmallSubmitButton> : null}
        <button type="button" onClick={fechar} className="text-[11px] text-slate-500">
          cancelar
        </button>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------ plano

function CartaoDoPlano({
  companyId,
  plano,
  produtos,
  filiais,
  hoje,
}: {
  companyId: string;
  plano: PlanoNaTela;
  produtos: Opcao[];
  filiais: Opcao[];
  hoje: string;
}) {
  // Fechado por padrão: a lista de planos fica curta e se abre o que se vai mexer.
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [replicando, setReplicando] = useState(false);
  const [pendente, iniciar] = useTransition();
  const a = plano.andamento;
  const faltamFiliais = filiais.some((f) => !plano.locais.some((l) => l.chave === f.id));
  const status = STATUS_DO_PLANO[plano.status] ?? STATUS_DO_PLANO.ATIVO;

  return (
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <header className="space-y-2 px-4 py-3">
        <div className="flex flex-wrap items-start gap-2">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            aria-expanded={aberto}
            className="min-w-0 flex-1 text-left"
            title={aberto ? "Minimizar o plano" : "Abrir o plano"}
          >
            <div className="flex flex-wrap items-center gap-1.5">
              {aberto ? <ChevronDown size={15} className="text-slate-400" /> : <ChevronRight size={15} className="text-slate-400" />}
              <h3 className="text-sm font-semibold text-slate-900">{plano.titulo}</h3>
              <Etiqueta tom={status.tom}>{status.rotulo}</Etiqueta>
              {!aberto ? (
                <span className="text-[11px] text-slate-500">
                  {a.realizadas} de {a.total} realizados
                  {a.atrasadas ? <span className="text-amber-700"> · {a.atrasadas} sem marcar</span> : null}
                </span>
              ) : null}
            </div>
            <p className="text-[11px] text-slate-500">
              {plano.produto?.nome ?? "sem produto"} · {rotuloDaPeriodicidade(plano.periodicidade)} ·{" "}
              {plano.locais.map((l) => l.nome).join(", ")}
            </p>
          </button>
          <div className={`flex-wrap gap-1 ${aberto ? "flex" : "hidden"}`}>
            {faltamFiliais ? (
              <button type="button" className={`${botao} border-brand-300 text-brand-700`} onClick={() => setReplicando((v) => !v)}>
                <Copy size={11} /> Replicar para outras filiais
              </button>
            ) : null}
            <button type="button" className={botao} onClick={() => setEditando((v) => !v)}>
              <Pencil size={11} /> Editar
            </button>
            <button
              type="button"
              disabled={pendente}
              className={`${botao} hover:border-red-300 hover:text-red-700`}
              onClick={() => {
                if (
                  confirm(
                    `Excluir o plano "${plano.titulo}"?\n\nOs compromissos da agenda que ainda não aconteceram saem junto. As reuniões já criadas ficam na aba Reuniões, com a ata.`,
                  )
                ) {
                  iniciar(async () => void (await excluirPlano(plano.id)));
                }
              }}
            >
              <Trash2 size={11} />
            </button>
          </div>
        </div>

        {aberto ? (
          <>
        <p className="whitespace-pre-line text-xs leading-relaxed text-slate-600">
          <span className="font-medium text-slate-700">Objetivo: </span>
          {plano.objetivo}
        </p>

        <div>
          <div className="flex items-baseline justify-between text-[11px]">
            <span className="text-slate-600">
              <strong className="text-brand-800">{a.realizadas}</strong> de {a.total} encontros realizados
            </span>
            {a.aAgendar ? <span className="text-slate-400">{a.aAgendar} sem data</span> : null}
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${a.percentual}%` }} />
          </div>
        </div>
        {a.atrasadas > 0 ? (
          <Aviso tom="atencao">
            {a.atrasadas} encontro(s) já passaram da data sem ser marcados como realizados. Marque o ✓ se aconteceram, ou use “Remarcar”.
          </Aviso>
        ) : null}

        {editando ? <EditarPlano plano={plano} produtos={produtos} fechar={() => setEditando(false)} /> : null}
        {replicando ? <Replicar plano={plano} filiais={filiais} hoje={hoje} fechar={() => setReplicando(false)} /> : null}
          </>
        ) : (
          <div className="h-1 overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${a.percentual}%` }} />
          </div>
        )}
      </header>

      {aberto
        ? plano.locais.map((l) => <BlocoDoLocal key={l.chave} companyId={companyId} plano={plano} local={l} hoje={hoje} />)
        : null}
    </section>
  );
}

// ------------------------------------------------------------------- tela

export default function PlanosBoard({
  companyId,
  planos,
  produtos,
  filiais,
  hoje,
}: {
  companyId: string;
  planos: PlanoNaTela[];
  produtos: Opcao[];
  filiais: Opcao[];
  hoje: string;
}) {
  const [novo, setNovo] = useState(false);
  const fecharNovo = useMemo(() => () => setNovo(false), []);

  return (
    <main className="space-y-3.5">
      <TituloDaSecao
        antes="Planos de"
        destaque="Treinamento"
        acao={
          novo ? null : (
            <button
              type="button"
              onClick={() => setNovo(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700"
            >
              <Plus size={13} /> Novo plano
            </button>
          )
        }
      />

      {novo ? <NovoPlano companyId={companyId} produtos={produtos} filiais={filiais} hoje={hoje} fechar={fecharNovo} /> : null}

      {planos.length === 0 && !novo ? (
        <Vazio
          acao={
            <button
              type="button"
              onClick={() => setNovo(true)}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
            >
              Criar o primeiro plano
            </button>
          }
        >
          Nenhum plano de treinamento nesta empresa. Um plano é o que você promete entregar: o produto, o objetivo, a periodicidade, os
          temas e as filiais onde vai acontecer.
        </Vazio>
      ) : null}

      {planos.map((p) => (
        <CartaoDoPlano key={p.id} companyId={companyId} plano={p} produtos={produtos} filiais={filiais} hoje={hoje} />
      ))}
    </main>
  );
}
