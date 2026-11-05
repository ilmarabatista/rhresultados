"use client";

import Link from "next/link";
import { useActionState, useMemo, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, Copy, Eraser, MessageCircle, Printer, Sparkles, Trash2 } from "lucide-react";
import {
  alertasDaPessoa,
  buracos,
  coberturaDoDia,
  CORES_DE_TURNO,
  DIAS_CURTOS,
  diaDaSemana,
  diaMes,
  diasDaSemana,
  duracao,
  LIMITE_SEMANAL,
  minutosDoDia,
  minutosDoTurno,
  relogio,
  somarDias,
  textoDaSemana,
  type Alerta,
  type DiaDaPessoa,
  type Funcionamento,
  type TipoDoDia,
  type Turno,
} from "@/lib/escala";
import {
  copiarSemanaAnterior,
  criarTurnosSugeridos,
  excluirTurno,
  limparSemana,
  marcarDia,
  montarSemana,
  salvarFuncionamento,
  salvarTurno,
  type EscalaState,
} from "@/app/(app)/empresas/[id]/escala/actions";
import { Aviso, Painel, Vazio } from "@/components/ui";

/**
 * A grade da semana: uma linha por pessoa, uma coluna por dia. Cada célula é
 * uma escolha (turno, folga, férias, atestado) e grava na hora. Embaixo, a
 * cobertura hora a hora e os avisos da CLT.
 */

type Pessoa = { id: string; nome: string; cargo: string | null; unidade: string | null; afastado: boolean };

const COR: Record<string, string> = {
  azul: "bg-sky-100 text-sky-900 border-sky-200",
  verde: "bg-emerald-100 text-emerald-900 border-emerald-200",
  roxo: "bg-violet-100 text-violet-900 border-violet-200",
  laranja: "bg-orange-100 text-orange-900 border-orange-200",
  rosa: "bg-pink-100 text-pink-900 border-pink-200",
  cinza: "bg-slate-200 text-slate-800 border-slate-300",
};
const COR_DO_TIPO: Record<Exclude<TipoDoDia, "TRABALHO">, string> = {
  FOLGA: "bg-white text-slate-500 border-dashed border-slate-300",
  FERIAS: "bg-teal-50 text-teal-800 border-teal-200",
  ATESTADO: "bg-red-50 text-red-700 border-red-200",
};
const NOME_DA_COR: Record<string, string> = {
  azul: "Azul",
  verde: "Verde",
  roxo: "Roxo",
  laranja: "Laranja",
  rosa: "Rosa",
  cinza: "Cinza",
};

const botao =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";
const botaoAzul =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60";
const campo = "rounded-md border border-slate-300 px-2 py-1 text-xs";

export default function EscalaTela({
  companyId,
  empresa,
  unidade,
  segunda,
  hoje,
  funcionamento,
  temRegras,
  minimo,
  turnos,
  pessoas,
  dias: diasIniciais,
}: {
  companyId: string;
  empresa: string;
  unidade: string | null;
  segunda: string;
  hoje: string;
  funcionamento: Funcionamento;
  temRegras: boolean;
  minimo: number;
  turnos: Turno[];
  pessoas: Pessoa[];
  dias: DiaDaPessoa[];
}) {
  const router = useRouter();
  const busca = useSearchParams();
  const [pendente, comecar] = useTransition();
  const [aviso, setAviso] = useState<EscalaState | null>(null);
  // As células editadas ficam aqui até a página recarregar com o que foi gravado.
  const [editados, setEditados] = useState<Map<string, DiaDaPessoa | null>>(() => new Map());
  const [base, setBase] = useState({ segunda, dias: diasIniciais });
  if (base.dias !== diasIniciais) {
    setBase({ segunda, dias: diasIniciais });
    setEditados(new Map());
  }

  const semana = diasDaSemana(segunda);
  const turnoPorId = useMemo(() => new Map(turnos.map((t) => [t.id, t])), [turnos]);
  const ids = pessoas.map((p) => p.id);

  const dias = useMemo(() => {
    const mapa = new Map(diasIniciais.map((d) => [`${d.employeeId}|${d.dia}`, d]));
    for (const [k, v] of editados) {
      if (v) mapa.set(k, v);
      else mapa.delete(k);
    }
    return [...mapa.values()];
  }, [diasIniciais, editados]);
  const doDia = useMemo(() => new Map(dias.map((d) => [`${d.employeeId}|${d.dia}`, d])), [dias]);

  const alertas = useMemo(() => pessoas.flatMap((p) => alertasDaPessoa(p.id, segunda, dias)), [pessoas, segunda, dias]);
  const alertaNaCelula = useMemo(() => {
    const m = new Map<string, Alerta[]>();
    for (const a of alertas) {
      const k = `${a.employeeId}|${a.dia ?? "semana"}`;
      m.set(k, [...(m.get(k) ?? []), a]);
    }
    return m;
  }, [alertas]);

  const marcar = (employeeId: string, dia: string, valor: string) => {
    const k = `${employeeId}|${dia}`;
    let novo: DiaDaPessoa | null = null;
    if (valor === "FOLGA" || valor === "FERIAS" || valor === "ATESTADO") {
      novo = { employeeId, dia, tipo: valor, turnoId: null, inicio: null, fim: null, intervalo: 0 };
    } else if (valor) {
      const t = turnoPorId.get(valor);
      if (!t) return;
      novo = { employeeId, dia, tipo: "TRABALHO", turnoId: t.id, inicio: t.inicio, fim: t.fim, intervalo: t.intervalo };
    }
    const antes = doDia.get(k) ?? null;
    setEditados((m) => new Map(m).set(k, novo));
    marcarDia({ companyId, employeeId, dia, valor }).then((r) => {
      if (r.error) {
        setAviso(r);
        setEditados((m) => new Map(m).set(k, antes));
      }
    });
  };

  const naSemana = (acao: typeof montarSemana, confirmar?: string) => {
    if (confirmar && !window.confirm(confirmar)) return;
    setAviso(null);
    comecar(async () => {
      const r = await acao({ companyId, segunda, employeeIds: ids });
      setAviso(r);
      router.refresh();
    });
  };

  const copiarTexto = async () => {
    const texto = textoDaSemana({
      empresa: unidade ? `${empresa} — ${unidade}` : empresa,
      segunda,
      pessoas,
      dias: dias.filter((d) => semana.includes(d.dia)),
      turnos,
    });
    try {
      await navigator.clipboard.writeText(texto);
      setAviso({ ok: true, mensagem: "Escala copiada. Cole no grupo do WhatsApp." });
    } catch {
      setAviso({ error: "Não deu para copiar. Tente pelo botão Imprimir." });
    }
  };

  const irPara = (s: string) => {
    const q = new URLSearchParams(busca.toString());
    q.set("semana", s);
    return `?${q}`;
  };

  const vazia = !dias.some((d) => semana.includes(d.dia));

  return (
    <div className="space-y-3">
      {/* -------------------------------------------------- semana e ações */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <Link href={irPara(somarDias(segunda, -7))} className={botao} aria-label="Semana anterior">
            <ChevronLeft size={14} />
          </Link>
          <span className="min-w-[11rem] text-center text-sm font-semibold text-slate-800">
            {diaMes(semana[0])} a {diaMes(semana[6])}/{semana[6].slice(0, 4)}
          </span>
          <Link href={irPara(somarDias(segunda, 7))} className={botao} aria-label="Próxima semana">
            <ChevronRight size={14} />
          </Link>
          {!semana.includes(hoje) ? (
            <Link href={irPara(hoje)} className={`${botao} no-print`}>
              Esta semana
            </Link>
          ) : null}
        </div>

        <div className="no-print ml-auto flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            className={botaoAzul}
            disabled={pendente || turnos.length === 0 || pessoas.length === 0}
            onClick={() => naSemana(montarSemana)}
            title="Preenche os dias vazios no 6×1: cada um no seu turno, uma folga espalhada"
          >
            <Sparkles size={13} /> Montar a semana
          </button>
          <button type="button" className={botao} disabled={pendente} onClick={() => naSemana(copiarSemanaAnterior)}>
            <Copy size={13} /> Copiar a semana anterior
          </button>
          <button type="button" className={botao} disabled={vazia} onClick={copiarTexto}>
            <MessageCircle size={13} /> Texto para o WhatsApp
          </button>
          <button type="button" className={botao} onClick={() => window.print()}>
            <Printer size={13} /> Imprimir
          </button>
          <button
            type="button"
            className={botao}
            disabled={pendente || vazia}
            onClick={() => naSemana(limparSemana, "Limpar a escala desta semana de todas as pessoas da lista?")}
          >
            <Eraser size={13} /> Limpar
          </button>
        </div>
      </div>

      {aviso?.error ? <Aviso tom="ruim">{aviso.error}</Aviso> : null}
      {aviso?.ok && aviso.mensagem ? <Aviso tom="bom">{aviso.mensagem}</Aviso> : null}

      {turnos.length === 0 ? (
        <Aviso tom="informacao" rotulo="Primeiro passo">
          Cadastre os turnos da empresa (lá embaixo, em Turnos) ou use os sugeridos para o horário de funcionamento
          ({resumoDoFuncionamento(funcionamento)}).{" "}
          <button
            type="button"
            className="font-semibold underline"
            disabled={pendente}
            onClick={() =>
              comecar(async () => {
                setAviso(await criarTurnosSugeridos(companyId));
                router.refresh();
              })
            }
          >
            Criar Abertura, Intermediário e Fechamento
          </button>
        </Aviso>
      ) : null}

      {/* ------------------------------------------------------------ grade */}
      {pessoas.length === 0 ? (
        <Vazio>Ninguém ativo na equipe {unidade ? "desta unidade" : "da empresa"}. Cadastre as pessoas na aba Equipe.</Vazio>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[860px] border-collapse text-xs">
            <thead>
              <tr className="bg-brand-900 text-white">
                <th className="sticky left-0 z-10 bg-brand-900 px-2 py-1.5 text-left text-micro font-semibold uppercase tracking-wider">
                  Pessoa
                </th>
                {semana.map((dia) => {
                  const fechado = funcionamento[diaDaSemana(dia)] === null;
                  return (
                    <th
                      key={dia}
                      className={`px-1 py-1.5 text-center text-micro font-semibold uppercase tracking-wider ${dia === hoje ? "bg-brand-700" : ""}`}
                    >
                      {DIAS_CURTOS[diaDaSemana(dia)]} {diaMes(dia)}
                      {fechado ? <span className="block font-normal normal-case text-brand-200">fechado</span> : null}
                    </th>
                  );
                })}
                <th className="px-2 py-1.5 text-right text-micro font-semibold uppercase tracking-wider">Horas</th>
              </tr>
            </thead>
            <tbody>
              {pessoas.map((p) => {
                const total = semana.reduce((s, dia) => s + minutosDoDia(doDia.get(`${p.id}|${dia}`) ?? vazioDoDia), 0);
                const daSemana = alertaNaCelula.get(`${p.id}|semana`);
                return (
                  <tr key={p.id} className="border-t border-slate-100">
                    <td className="sticky left-0 z-10 max-w-[13rem] bg-white px-2 py-1">
                      <p className="truncate font-medium text-slate-800">{p.nome}</p>
                      <p className="truncate text-micro text-slate-500">
                        {[p.cargo, p.unidade, p.afastado ? "afastado" : null].filter(Boolean).join(" · ") || "—"}
                      </p>
                    </td>
                    {semana.map((dia) => {
                      const d = doDia.get(`${p.id}|${dia}`);
                      const avisos = alertaNaCelula.get(`${p.id}|${dia}`);
                      return (
                        <td key={dia} className={`px-0.5 py-1 align-top ${dia === hoje ? "bg-brand-50/50" : ""}`}>
                          <Celula
                            dia={d}
                            turnos={turnos}
                            turno={d?.turnoId ? turnoPorId.get(d.turnoId) : undefined}
                            avisos={avisos}
                            onChange={(v) => marcar(p.id, dia, v)}
                          />
                        </td>
                      );
                    })}
                    <td
                      className={`whitespace-nowrap px-2 py-1 text-right tabular-nums ${
                        total > LIMITE_SEMANAL ? "font-semibold text-red-700" : "text-slate-700"
                      }`}
                      title={daSemana?.map((a) => a.texto).join("\n")}
                    >
                      {total ? duracao(total) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* -------------------------------------------------------- avisos */}
      {alertas.length > 0 ? (
        <Aviso rotulo={`${alertas.length} ${alertas.length === 1 ? "ponto de atenção" : "pontos de atenção"} (CLT)`}>
          <ul className="list-disc space-y-0.5 pl-4">
            {alertas.map((a, i) => (
              <li key={i}>
                <strong>{pessoas.find((p) => p.id === a.employeeId)?.nome.split(" ")[0]}</strong>
                {a.dia ? ` (${DIAS_CURTOS[diaDaSemana(a.dia)]} ${diaMes(a.dia)})` : ""}: {a.texto}
              </li>
            ))}
          </ul>
        </Aviso>
      ) : null}

      {/* ------------------------------------------------------ cobertura */}
      {pessoas.length > 0 && !vazia ? (
        <Cobertura semana={semana} dias={dias} funcionamento={funcionamento} minimo={minimo} />
      ) : null}

      <div className="no-print grid gap-3 xl:grid-cols-2">
        <Turnos companyId={companyId} turnos={turnos} />
        <FuncionamentoForm companyId={companyId} funcionamento={funcionamento} minimo={minimo} temRegras={temRegras} />
      </div>
    </div>
  );
}

const vazioDoDia: DiaDaPessoa = { employeeId: "", dia: "", tipo: "FOLGA", turnoId: null, inicio: null, fim: null, intervalo: 0 };

function resumoDoFuncionamento(f: Funcionamento): string {
  const abertos = f.filter((d): d is [number, number] => d !== null);
  if (abertos.length === 0) return "fechada todos os dias";
  const iguais = abertos.every((d) => d[0] === abertos[0][0] && d[1] === abertos[0][1]);
  const fechados = f.map((d, i) => (d === null ? DIAS_CURTOS[i] : null)).filter(Boolean);
  const horario = iguais ? `${relogio(abertos[0][0])} às ${relogio(abertos[0][1])}` : "horário que muda por dia";
  return fechados.length ? `${horario}, fechada ${fechados.join(", ")}` : `${horario}, todos os dias`;
}

// --------------------------------------------------------------- célula

function Celula({
  dia,
  turno,
  turnos,
  avisos,
  onChange,
}: {
  dia: DiaDaPessoa | undefined;
  turno: Turno | undefined;
  turnos: Turno[];
  avisos: Alerta[] | undefined;
  onChange: (valor: string) => void;
}) {
  const valor = !dia ? "" : dia.tipo === "TRABALHO" ? (dia.turnoId ?? "SEM_TURNO") : dia.tipo;
  const cor = !dia
    ? "bg-white text-slate-400 border-slate-200"
    : dia.tipo === "TRABALHO"
      ? COR[turno?.cor ?? "cinza"]
      : COR_DO_TIPO[dia.tipo];
  const horas =
    dia?.tipo === "TRABALHO" && dia.inicio != null && dia.fim != null ? `${relogio(dia.inicio)}–${relogio(dia.fim)}` : null;

  return (
    <div
      className={`relative rounded-md border ${cor} ${avisos ? "ring-2 ring-amber-400" : ""}`}
      title={avisos?.map((a) => a.texto).join("\n")}
    >
      <select
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="w-full cursor-pointer appearance-none bg-transparent px-1.5 pt-1 text-xs font-medium focus:outline-none"
        style={{ paddingBottom: horas ? 0 : 4 }}
        aria-label="Escala do dia"
      >
        <option value="">—</option>
        {turnos.map((t) => (
          <option key={t.id} value={t.id}>
            {t.nome}
          </option>
        ))}
        {valor === "SEM_TURNO" ? <option value="SEM_TURNO">Turno excluído</option> : null}
        <option value="FOLGA">Folga</option>
        <option value="FERIAS">Férias</option>
        <option value="ATESTADO">Atestado</option>
      </select>
      {horas ? <p className="pointer-events-none px-1.5 pb-1 text-micro tabular-nums opacity-80">{horas}</p> : null}
    </div>
  );
}

// ------------------------------------------------------------ cobertura

function Cobertura({
  semana,
  dias,
  funcionamento,
  minimo,
}: {
  semana: string[];
  dias: DiaDaPessoa[];
  funcionamento: Funcionamento;
  minimo: number;
}) {
  const porDia = semana.map((dia) => {
    const aberto = funcionamento[diaDaSemana(dia)];
    const faixas = coberturaDoDia(
      dias.filter((d) => d.dia === dia),
      aberto,
    );
    return { dia, aberto, faixas, buracos: buracos(faixas, Math.max(1, minimo)) };
  });
  const horas = [...new Set(porDia.flatMap((d) => d.faixas.map((f) => f.inicio)))].sort((a, b) => a - b);
  const descobertos = porDia.filter((d) => d.buracos.length > 0);

  return (
    <Painel
      titulo="Cobertura hora a hora"
      descricao={`Quantas pessoas estão no turno em cada hora aberta. Vermelho é abaixo do mínimo (${Math.max(1, minimo)}). O intervalo não entra na conta: reveze o almoço para a loja não ficar vazia.`}
    >
      {descobertos.length > 0 ? (
        <div className="mb-2">
          <Aviso tom="ruim" rotulo="Horário descoberto">
            {descobertos.map((d) => (
              <span key={d.dia} className="mr-3 inline-block">
                <strong>
                  {DIAS_CURTOS[diaDaSemana(d.dia)]} {diaMes(d.dia)}
                </strong>{" "}
                {d.buracos
                  .map((b) => `${relogio(b.inicio)}–${relogio(b.fim)} (${b.pessoas === 0 ? "ninguém" : `${b.pessoas}`})`)
                  .join(", ")}
              </span>
            ))}
          </Aviso>
        </div>
      ) : (
        <div className="mb-2">
          <Aviso tom="bom">Todas as horas abertas da semana têm gente.</Aviso>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-micro tabular-nums">
          <thead>
            <tr className="text-slate-500">
              <th className="px-1 py-0.5 text-left font-medium">Hora</th>
              {porDia.map((d) => (
                <th key={d.dia} className="px-1 py-0.5 text-center font-medium">
                  {DIAS_CURTOS[diaDaSemana(d.dia)]} {diaMes(d.dia)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {horas.map((h) => (
              <tr key={h}>
                <td className="whitespace-nowrap px-1 py-px text-slate-500">{relogio(h)}</td>
                {porDia.map((d) => {
                  const f = d.faixas.find((x) => x.inicio === h);
                  if (!f) return <td key={d.dia} className="px-0.5 py-px" />;
                  const baixo = f.pessoas < Math.max(1, minimo);
                  return (
                    <td key={d.dia} className="px-0.5 py-px">
                      <div
                        className={`rounded px-1 py-0.5 text-center ${
                          baixo ? "bg-red-100 font-semibold text-red-800" : "bg-emerald-50 text-emerald-800"
                        }`}
                      >
                        {f.pessoas}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Painel>
  );
}

// --------------------------------------------------------------- turnos

function Turnos({ companyId, turnos }: { companyId: string; turnos: Turno[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [state, action, salvando] = useActionState(async (s: EscalaState, f: FormData) => {
    const r = await salvarTurno(s, f);
    if (r.ok) setEditando(null);
    return r;
  }, {});
  const [, comecar] = useTransition();

  return (
    <Painel titulo="Turnos" descricao="Os horários que podem ser escolhidos na grade. 6 dias de 7h20 fecham as 44h da semana.">
      <ul className="divide-y divide-slate-100">
        {turnos.map((t) =>
          editando === t.id ? (
            <li key={t.id} className="py-1.5">
              <TurnoForm companyId={companyId} turno={t} action={action} salvando={salvando} onCancel={() => setEditando(null)} />
            </li>
          ) : (
            <li key={t.id} className="flex items-center gap-2 py-1.5 text-xs">
              <span className={`rounded border px-1.5 py-0.5 font-medium ${COR[t.cor] ?? COR.cinza}`}>{t.nome}</span>
              <span className="tabular-nums text-slate-700">
                {relogio(t.inicio)}–{relogio(t.fim)}
              </span>
              <span className="text-slate-500">
                {t.intervalo ? `${duracao(t.intervalo)} de intervalo · ` : ""}
                {duracao(minutosDoTurno(t))} de trabalho
              </span>
              <span className="ml-auto flex gap-1">
                <button type="button" className="text-brand-700 hover:underline" onClick={() => setEditando(t.id)}>
                  editar
                </button>
                <button
                  type="button"
                  className="text-slate-400 hover:text-red-700"
                  aria-label={`Excluir ${t.nome}`}
                  onClick={() => {
                    if (!window.confirm(`Excluir o turno ${t.nome}? Os dias já marcados continuam com o horário.`)) return;
                    comecar(async () => {
                      await excluirTurno(companyId, t.id);
                      router.refresh();
                    });
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </li>
          ),
        )}
      </ul>
      {editando === "novo" ? (
        <div className="mt-2">
          <TurnoForm companyId={companyId} action={action} salvando={salvando} onCancel={() => setEditando(null)} />
        </div>
      ) : (
        <button type="button" className={`${botao} mt-2`} onClick={() => setEditando("novo")}>
          + Novo turno
        </button>
      )}
      {state.error ? <p className="mt-1.5 text-xs text-red-700">{state.error}</p> : null}
      {state.ok && state.mensagem ? <p className="mt-1.5 text-xs text-emerald-700">{state.mensagem}</p> : null}
    </Painel>
  );
}

function TurnoForm({
  companyId,
  turno,
  action,
  salvando,
  onCancel,
}: {
  companyId: string;
  turno?: Turno;
  action: (f: FormData) => void;
  salvando: boolean;
  onCancel: () => void;
}) {
  return (
    <form action={action} className="flex flex-wrap items-end gap-2 text-xs">
      <input type="hidden" name="companyId" value={companyId} />
      {turno ? <input type="hidden" name="turnoId" value={turno.id} /> : null}
      <label className="flex flex-col gap-0.5">
        <span className="text-micro text-slate-500">Nome</span>
        <input name="nome" defaultValue={turno?.nome} required placeholder="Abertura" className={`${campo} w-28`} />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-micro text-slate-500">Entra</span>
        <input name="inicio" defaultValue={turno ? relogio(turno.inicio) : ""} required placeholder="08:00" className={`${campo} w-16`} />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-micro text-slate-500">Sai</span>
        <input name="fim" defaultValue={turno ? relogio(turno.fim) : ""} required placeholder="16:20" className={`${campo} w-16`} />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-micro text-slate-500">Intervalo (min)</span>
        <input
          name="intervalo"
          type="number"
          min={0}
          max={240}
          defaultValue={turno?.intervalo ?? 60}
          className={`${campo} w-20`}
        />
      </label>
      <label className="flex flex-col gap-0.5">
        <span className="text-micro text-slate-500">Cor</span>
        <select name="cor" defaultValue={turno?.cor ?? "azul"} className={campo}>
          {CORES_DE_TURNO.map((c) => (
            <option key={c} value={c}>
              {NOME_DA_COR[c]}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className={botaoAzul} disabled={salvando}>
        {salvando ? "Salvando…" : "Salvar"}
      </button>
      <button type="button" className={botao} onClick={onCancel}>
        Cancelar
      </button>
    </form>
  );
}

// -------------------------------------------------------- funcionamento

function FuncionamentoForm({
  companyId,
  funcionamento,
  minimo,
  temRegras,
}: {
  companyId: string;
  funcionamento: Funcionamento;
  minimo: number;
  temRegras: boolean;
}) {
  const [state, action, salvando] = useActionState(salvarFuncionamento, {});
  // Segunda primeiro, como na grade.
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  return (
    <Painel
      titulo="Horário de funcionamento"
      descricao={
        temRegras
          ? "A cobertura é conferida dentro deste horário."
          : "Ainda no padrão: das 08:00 às 22:00 todos os dias. Ajuste e salve."
      }
    >
      <form action={action} className="space-y-1.5 text-xs">
        <input type="hidden" name="companyId" value={companyId} />
        {ordem.map((i) => {
          const d = funcionamento[i];
          return (
            <div key={i} className="flex items-center gap-2">
              <span className="w-8 font-medium text-slate-700">{DIAS_CURTOS[i]}</span>
              <input name={`abre${i}`} defaultValue={relogio(d?.[0] ?? 480)} className={`${campo} w-16`} aria-label={`${DIAS_CURTOS[i]} abre`} />
              <span className="text-slate-500">às</span>
              <input name={`fecha${i}`} defaultValue={relogio(d?.[1] ?? 1320)} className={`${campo} w-16`} aria-label={`${DIAS_CURTOS[i]} fecha`} />
              <label className="ml-2 flex items-center gap-1 text-slate-600">
                <input type="checkbox" name={`fechado${i}`} defaultChecked={d === null} /> fechado
              </label>
            </div>
          );
        })}
        <label className="flex items-center gap-2 pt-1">
          <span className="text-slate-700">Mínimo de pessoas em cada hora</span>
          <input name="minimo" type="number" min={0} max={50} defaultValue={minimo} className={`${campo} w-16`} />
        </label>
        <div className="flex items-center gap-2 pt-1">
          <button type="submit" className={botaoAzul} disabled={salvando}>
            {salvando ? "Salvando…" : "Salvar horário"}
          </button>
          {state.error ? <span className="text-red-700">{state.error}</span> : null}
          {state.ok ? <span className="text-emerald-700">{state.mensagem}</span> : null}
        </div>
      </form>
    </Painel>
  );
}
