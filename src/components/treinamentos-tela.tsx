"use client";

import { excluirComPermissao } from "@/components/com-permissao";
import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Pencil, Trash2, X } from "lucide-react";
import {
  alternarTreinamentoAtivo,
  copiarCatalogo,
  criarCargo,
  excluirCargo,
  excluirTreinamento,
  marcarNaMatriz,
  programarTurma,
  renomearCargo,
  salvarModeloDeIntegracao,
  salvarTreinamento,
  type TreinoState,
} from "@/app/(app)/empresas/[id]/treinamentos/actions";
import {
  CATEGORIAS,
  escreverDinheiro,
  escreverHoras,
  MESES_CURTOS,
  ROTULO_DA_CATEGORIA,
  ROTULO_DA_TURMA,
  type Categoria,
  type SituacaoDaTurma,
  type Totais,
} from "@/lib/treinamentos";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";
import { avisar as mostrarAviso, avisarSeErro as avisar, confirmar } from "@/components/avisos";
import Modal from "@/components/modal";

/**
 * A aba Treinamentos da empresa, em quatro partes: a programação do ano (o
 * PAT, montado das turmas), o catálogo com a matriz cargo × treinamento, as
 * pendências e o checklist de integração.
 */

type Cargo = { id: string; nome: string; pessoas: number };

type Treinamento = {
  id: string;
  codigo: string | null;
  nome: string;
  categoria: Categoria;
  cargaHoraria: string;
  descricao: string;
  ativo: boolean;
  turmas: number;
  cargoIds: string[];
  precisam: number;
  fizeram: number;
  faltam: string[];
  fizeramAlgumaVez: number;
};

type Turma = {
  reuniaoId: string;
  treinamento: string;
  categoria: Categoria;
  mes: number | null;
  dia: string | null;
  hora: string | null;
  instrutor: string | null;
  modalidade: string;
  local: string | null;
  horas: number | null;
  investimento: number | null;
  convocados: number;
  presentes: number;
  situacao: SituacaoDaTurma;
  justificativa: string | null;
};

const COR_DA_SITUACAO: Record<SituacaoDaTurma, string> = {
  PROGRAMADO: "bg-sky-50 text-sky-700",
  REALIZADO: "bg-emerald-50 text-emerald-700",
  JUSTIFICADO: "bg-amber-50 text-amber-700",
};
const PONTO_DA_SITUACAO: Record<SituacaoDaTurma, string> = {
  PROGRAMADO: "bg-sky-500",
  REALIZADO: "bg-emerald-500",
  JUSTIFICADO: "bg-amber-400",
};

const botao =
  "rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700";
const botaoClaro =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50";

function nomeDe(t: { codigo: string | null; nome: string }) {
  return t.codigo ? `${t.codigo} · ${t.nome}` : t.nome;
}

// ------------------------------------------------------------ programar

function FormularioDeTurma({
  companyId,
  treinamentos,
  inicial,
  mesPadrao,
  onClose,
}: {
  companyId: string;
  treinamentos: Treinamento[];
  inicial: string | null;
  /** "AAAA-MM" que o formulário sugere. */
  mesPadrao: string;
  onClose: () => void;
}) {
  const router = useRouter();
  const [state, action] = useActionState<TreinoState, FormData>(programarTurma, {});
  const ativos = treinamentos.filter((t) => t.ativo);
  const [escolhido, setEscolhido] = useState(inicial ?? ativos[0]?.id ?? "");
  const [comDia, setComDia] = useState(false);
  const t = ativos.find((x) => x.id === escolhido);

  useEffect(() => {
    // A turma criada abre na página dela: convocados, pauta, presença.
    if (state.ok && state.id) router.push(`/empresas/${companyId}/reunioes/${state.id}`);
  }, [state, router, companyId]);

  if (ativos.length === 0) {
    return (
      <Modal largura="xl" titulo="Programar treinamento" aoFechar={onClose}>
        <p className="text-sm text-slate-600">
          Cadastre antes os treinamentos da empresa em <strong>Catálogo e matriz</strong>.
        </p>
      </Modal>
    );
  }

  return (
    <Modal largura="xl" titulo="Programar treinamento" aoFechar={onClose}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="companyId" value={companyId} />
        <Field label="Treinamento *">
          <Select name="treinamentoId" value={escolhido} onChange={(e) => setEscolhido(e.target.value)}>
            {ativos.map((x) => (
              <option key={x.id} value={x.id}>
                {nomeDe(x)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={!comDia} onChange={() => setComDia(false)} className="accent-brand-600" />
            Só o mês, por enquanto
          </label>
          <label className="flex items-center gap-1.5">
            <input type="radio" checked={comDia} onChange={() => setComDia(true)} className="accent-brand-600" />
            Já tem dia marcado
          </label>
        </div>
        {comDia ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Dia *">
              <Input name="dia" type="date" required />
            </Field>
            <Field label="Hora *">
              <Input name="hora" type="time" defaultValue="08:00" required />
            </Field>
          </div>
        ) : (
          <Field label="Mês previsto *" hint="Fica na programação; ao marcar o dia, vai para a agenda.">
            <Input name="mes" type="month" defaultValue={mesPadrao} required />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instrutor / instituição">
            <Input name="instrutor" />
          </Field>
          <Field label="Tipo">
            <Select name="modalidade" defaultValue="INTERNO">
              <option value="INTERNO">Interno</option>
              <option value="EXTERNO">Externo</option>
            </Select>
          </Field>
          <Field label="Local">
            <Input name="local" />
          </Field>
          <Field label="Horas" hint={t?.cargaHoraria ? `Vazio: ${t.cargaHoraria}, a carga do treinamento.` : undefined}>
            <Input name="horas" placeholder={t?.cargaHoraria || "2h30"} />
          </Field>
          <Field label="Investimento (R$)">
            <Input name="investimento" placeholder="0,00" />
          </Field>
        </div>

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" name="convocar" defaultChecked className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span>
            Convocar quem a matriz diz que precisa e ainda não fez
            {t ? <span className="text-slate-500"> ({t.faltam.length} pessoa{t.faltam.length === 1 ? "" : "s"})</span> : null}
          </span>
        </label>

        <FormError message={state.error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={botaoClaro}>
            Cancelar
          </button>
          <SubmitButton pendingLabel="Programando…">Programar</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function Resumo({ titulo, t, destaque }: { titulo: string; t: Totais; destaque?: boolean }) {
  return (
    <div className={`rounded-lg border p-3 ${destaque ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
      <p className="text-micro font-semibold uppercase tracking-wider text-slate-500">{titulo}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">
        {t.turmas} turma{t.turmas === 1 ? "" : "s"}
      </p>
      <p className="text-xs text-slate-500">
        {escreverHoras(t.horas)} · {t.pessoas} {t.pessoas === 1 ? "participação" : "participações"} ·{" "}
        {escreverHoras(t.horasPessoa)} pessoa
      </p>
      <p className="text-xs text-slate-500">{escreverDinheiro(t.investimento)}</p>
    </div>
  );
}

function Programacao({
  companyId,
  ano,
  turmas,
  totais,
  onProgramar,
}: {
  companyId: string;
  ano: number;
  turmas: Turma[];
  totais: { programado: Totais; realizado: Totais; justificadas: number; cumprimento: number | null };
  onProgramar: () => void;
}) {
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link href={`?aba=programacao&ano=${ano - 1}`} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Ano anterior">
            <ChevronLeft size={16} />
          </Link>
          <span className="text-sm font-semibold text-slate-900">Programação de {ano}</span>
          <Link href={`?aba=programacao&ano=${ano + 1}`} className="rounded p-1 text-slate-500 hover:bg-slate-100" aria-label="Próximo ano">
            <ChevronRight size={16} />
          </Link>
        </div>
        <button type="button" onClick={onProgramar} className={botao}>
          + Programar treinamento
        </button>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Resumo titulo="Total programado" t={totais.programado} />
        <Resumo titulo="Total realizado" t={totais.realizado} destaque />
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <p className="text-micro font-semibold uppercase tracking-wider text-slate-500">Cumprimento</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {totais.cumprimento == null ? "—" : `${totais.cumprimento}%`}
          </p>
          <p className="text-xs text-slate-500">
            do programado foi realizado
            {totais.justificadas ? ` · ${totais.justificadas} justificada${totais.justificadas > 1 ? "s" : ""} fora da conta` : ""}
          </p>
        </div>
      </div>

      {turmas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-9 text-center text-sm text-slate-500">
          Nenhum treinamento programado para {ano}.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-mini">
            <thead className="bg-slate-50 text-micro uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Ação de treinamento</th>
                <th className="px-2 py-2 font-semibold">Instrutor</th>
                {MESES_CURTOS.map((m) => (
                  <th key={m} className="w-7 px-0 py-2 text-center font-semibold">
                    {m}
                  </th>
                ))}
                <th className="px-2 py-2 text-right font-semibold">Part.</th>
                <th className="px-2 py-2 text-right font-semibold">Horas</th>
                <th className="px-2 py-2 text-right font-semibold">Invest.</th>
                <th className="px-3 py-2 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {turmas.map((t) => (
                <tr key={t.reuniaoId} className="hover:bg-slate-50/60">
                  <td className="px-3 py-1.5">
                    <Link href={`/empresas/${companyId}/reunioes/${t.reuniaoId}`} className="font-medium text-slate-800 hover:text-brand-700">
                      {t.treinamento}
                    </Link>
                    <span className="block text-micro text-slate-500">
                      {[
                        ROTULO_DA_CATEGORIA[t.categoria],
                        t.modalidade === "EXTERNO" ? "externo" : "interno",
                        t.dia ? `${t.dia.split("-").reverse().join("/")}${t.hora ? ` ${t.hora}` : ""}` : "sem dia",
                        t.local,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-slate-600">{t.instrutor ?? "—"}</td>
                  {MESES_CURTOS.map((m, i) => (
                    <td key={m} className="px-0 py-1.5 text-center">
                      {t.mes === i + 1 ? (
                        <span
                          className={`inline-block h-3 w-3 rounded-full ${PONTO_DA_SITUACAO[t.situacao]}`}
                          title={ROTULO_DA_TURMA[t.situacao]}
                        />
                      ) : null}
                    </td>
                  ))}
                  <td className="px-2 py-1.5 text-right text-slate-600">
                    {t.situacao === "REALIZADO" ? `${t.presentes}/${t.convocados}` : t.convocados}
                  </td>
                  <td className="px-2 py-1.5 text-right text-slate-600">{escreverHoras(t.horas)}</td>
                  <td className="px-2 py-1.5 text-right text-slate-600">
                    {t.investimento == null ? "—" : escreverDinheiro(t.investimento)}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className={`rounded px-1.5 py-0.5 text-micro font-medium ${COR_DA_SITUACAO[t.situacao]}`} title={t.justificativa ?? undefined}>
                      {ROTULO_DA_TURMA[t.situacao]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-micro text-slate-500">
        Part.: convocados; no realizado, presentes/convocados. Clique no treinamento para abrir a turma (convocados,
        presença, pauta e ata).
      </p>
    </>
  );
}

// ------------------------------------------------------- catálogo e matriz

function FormularioDeTreinamento({
  companyId,
  treinamento,
  onClose,
}: {
  companyId: string;
  treinamento: Treinamento | null;
  onClose: () => void;
}) {
  const [state, action] = useActionState<TreinoState, FormData>(salvarTreinamento, {});
  useEffect(() => {
    if (state.ok) onClose();
  }, [state.ok, onClose]);

  return (
    <Modal largura="xl" titulo={treinamento ? "Editar treinamento" : "Novo treinamento"} aoFechar={onClose}>
      <form action={action} className="space-y-4">
        <input type="hidden" name="companyId" value={companyId} />
        {treinamento ? <input type="hidden" name="treinamentoId" value={treinamento.id} /> : null}
        <div className="grid gap-4 sm:grid-cols-6">
          <Field label="Código" className="sm:col-span-2" hint="Ex.: DP-01">
            <Input name="codigo" defaultValue={treinamento?.codigo ?? ""} />
          </Field>
          <Field label="Nome *" className="sm:col-span-4">
            <Input name="nome" required defaultValue={treinamento?.nome ?? ""} />
          </Field>
          <Field label="Categoria" className="sm:col-span-3">
            <Select name="categoria" defaultValue={treinamento?.categoria ?? "TECNICO"}>
              {CATEGORIAS.map((c) => (
                <option key={c} value={c}>
                  {ROTULO_DA_CATEGORIA[c]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Carga horária" className="sm:col-span-3" hint="Ex.: 2, 2,5 ou 2h30">
            <Input name="cargaHoraria" defaultValue={treinamento?.cargaHoraria ?? ""} />
          </Field>
          <Field label="Descrição / conteúdo" className="sm:col-span-6">
            <Textarea name="descricao" rows={3} defaultValue={treinamento?.descricao ?? ""} />
          </Field>
        </div>
        <FormError message={state.error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={botaoClaro}>
            Cancelar
          </button>
          <SubmitButton pendingLabel="Salvando…">{treinamento ? "Salvar" : "Cadastrar"}</SubmitButton>
        </div>
      </form>
    </Modal>
  );
}

function Cargos({ companyId, cargos }: { companyId: string; cargos: Cargo[] }) {
  const [pending, startTransition] = useTransition();
  const [novo, setNovo] = useState("");
  const [editando, setEditando] = useState<string | null>(null);
  const [nome, setNome] = useState("");

  return (
    <section className={`rounded-lg border border-slate-200 bg-white p-4 ${pending ? "opacity-60" : ""}`}>
      <h2 className="text-sm font-semibold text-slate-900">Cargos da empresa</h2>
      <p className="mb-3 mt-0.5 text-xs text-slate-500">
        A lista que aparece no cadastro da equipe. Renomear para o nome de outro cargo junta os dois.
      </p>
      <ul className="mb-3 flex flex-wrap gap-1.5">
        {cargos.map((c) =>
          editando === c.id ? (
            <li key={c.id}>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  startTransition(async () => {
                    const r = await renomearCargo(c.id, nome);
                    avisar(r);
                    if (r.ok) setEditando(null);
                  });
                }}
                className="flex items-center gap-1"
              >
                <input
                  autoFocus
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-44 rounded-md border border-brand-400 px-2 py-0.5 text-mini outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
                />
                <button type="submit" className="text-emerald-700" aria-label="Salvar">
                  <Check size={14} />
                </button>
                <button type="button" onClick={() => setEditando(null)} className="text-slate-500" aria-label="Cancelar">
                  <X size={14} />
                </button>
              </form>
            </li>
          ) : (
            <li
              key={c.id}
              className="group inline-flex items-center gap-1 rounded-full bg-slate-100 py-0.5 pl-2.5 pr-1.5 text-mini text-slate-700"
            >
              {c.nome}
              <span className="text-micro text-slate-500">{c.pessoas}</span>
              <button
                type="button"
                onClick={() => {
                  setEditando(c.id);
                  setNome(c.nome);
                }}
                className="text-slate-500 opacity-0 hover:text-brand-700 group-hover:opacity-100"
                aria-label={`Renomear ${c.nome}`}
              >
                <Pencil size={11} />
              </button>
              <button
                type="button"
                onClick={async () => {
                  const aviso = c.pessoas
                    ? `Excluir o cargo ${c.nome}? ${c.pessoas} pessoa(s) ficam sem cargo.`
                    : `Excluir o cargo ${c.nome}?`;
                  if (!(await confirmar(aviso))) return;
                  startTransition(async () => {
                    const r = await excluirComPermissao((apagar) => excluirCargo(c.id, apagar));
                    if (r) avisar(r);
                  });
                }}
                className="text-slate-500 opacity-0 hover:text-red-600 group-hover:opacity-100"
                aria-label={`Excluir ${c.nome}`}
              >
                <X size={11} />
              </button>
            </li>
          ),
        )}
        {cargos.length === 0 ? <li className="text-sm text-slate-500">Nenhum cargo ainda.</li> : null}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          startTransition(async () => {
            const r = await criarCargo(companyId, novo);
            avisar(r);
            if (r.ok) setNovo("");
          });
        }}
        className="flex gap-2"
      >
        <input
          value={novo}
          onChange={(e) => setNovo(e.target.value)}
          placeholder="Novo cargo"
          className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
        />
        <button type="submit" className={botaoClaro}>
          Adicionar
        </button>
      </form>
    </section>
  );
}

function Catalogo({
  companyId,
  cargos,
  treinamentos,
  outrasEmpresas,
}: {
  companyId: string;
  cargos: Cargo[];
  treinamentos: Treinamento[];
  outrasEmpresas: { id: string; nome: string; treinamentos: number }[];
}) {
  const [pending, startTransition] = useTransition();
  const [form, setForm] = useState<Treinamento | "novo" | null>(null);
  const [origem, setOrigem] = useState(outrasEmpresas[0]?.id ?? "");
  // A marca muda na hora; o servidor confirma depois.
  const [marcas, setMarcas] = useState(() => new Set(treinamentos.flatMap((t) => t.cargoIds.map((c) => `${t.id}:${c}`))));
  useEffect(() => {
    setMarcas(new Set(treinamentos.flatMap((t) => t.cargoIds.map((c) => `${t.id}:${c}`))));
  }, [treinamentos]);

  const alternar = (tid: string, cid: string) => {
    const chave = `${tid}:${cid}`;
    const precisa = !marcas.has(chave);
    setMarcas((m) => {
      const n = new Set(m);
      if (precisa) n.add(chave);
      else n.delete(chave);
      return n;
    });
    startTransition(async () => avisar(await marcarNaMatriz(tid, cid, precisa)));
  };

  return (
    <div className="space-y-4">
      <Cargos companyId={companyId} cargos={cargos} />

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Matriz de treinamento</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Marque o que cada cargo precisa fazer. Daqui saem as pendências e os convocados de cada turma.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {outrasEmpresas.length > 0 ? (
              <span className="flex items-center gap-1">
                <select
                  value={origem}
                  onChange={(e) => setOrigem(e.target.value)}
                  className="rounded-md border border-slate-300 px-2 py-1.5 text-mini"
                >
                  {outrasEmpresas.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.nome} ({e.treinamentos})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      const r = await copiarCatalogo(companyId, origem);
                      if (r.error) mostrarAviso(r.error);
                      else mostrarAviso(`${r.copiados} treinamento(s) copiado(s).`);
                    })
                  }
                  className={botaoClaro}
                >
                  Copiar catálogo
                </button>
              </span>
            ) : null}
            <button type="button" onClick={() => setForm("novo")} className={botao}>
              + Treinamento
            </button>
          </div>
        </div>

        {treinamentos.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-300 px-6 py-9 text-center text-sm text-slate-500">
            Nenhum treinamento cadastrado. Comece pelos procedimentos de cada área (DP-01 Admissão, FISC-02 Obrigações
            fiscais…) ou copie o catálogo de outra empresa.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="text-left text-mini">
              <thead>
                <tr>
                  <th className="min-w-[16rem] px-2 py-1 align-bottom text-micro font-semibold uppercase tracking-wider text-slate-500">
                    Treinamento
                  </th>
                  {cargos.map((c) => (
                    <th key={c.id} className="h-32 w-8 px-0 align-bottom">
                      <div className="mx-auto w-5 whitespace-nowrap [writing-mode:vertical-rl] rotate-180 text-micro font-medium text-slate-600" title={`${c.pessoas} pessoa(s) ativas`}>
                        {c.nome}
                      </div>
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {treinamentos.map((t) => (
                  <tr key={t.id} className={`group ${t.ativo ? "" : "opacity-50"}`}>
                    <td className="px-2 py-1.5">
                      <span className="font-medium text-slate-800">{nomeDe(t)}</span>
                      <span className="block text-micro text-slate-500">
                        {[ROTULO_DA_CATEGORIA[t.categoria], t.cargaHoraria || null, t.ativo ? null : "fora de uso", t.turmas ? `${t.turmas} turma(s)` : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </td>
                    {cargos.map((c) => {
                      const marcado = marcas.has(`${t.id}:${c.id}`);
                      return (
                        <td key={c.id} className="px-0 py-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => alternar(t.id, c.id)}
                            className={`mx-auto flex h-5 w-5 items-center justify-center rounded border transition ${
                              marcado ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 bg-white hover:border-brand-400"
                            }`}
                            aria-label={`${c.nome} precisa de ${t.nome}`}
                            aria-pressed={marcado}
                          >
                            {marcado ? <Check size={12} /> : null}
                          </button>
                        </td>
                      );
                    })}
                    <td className="whitespace-nowrap px-2 py-1.5">
                      <span className="flex gap-2 opacity-0 transition group-hover:opacity-100">
                        <button type="button" onClick={() => setForm(t)} className="text-slate-500 hover:text-brand-700" aria-label="Editar">
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startTransition(async () => avisar(await alternarTreinamentoAtivo(t.id, !t.ativo)))}
                          className="text-micro text-slate-500 hover:text-slate-700"
                        >
                          {t.ativo ? "tirar de uso" : "voltar a usar"}
                        </button>
                        <button
                          type="button"
                          onClick={async () => {
                            if (await confirmar(`Excluir o treinamento ${nomeDe(t)}?`)) {
                              startTransition(async () => avisar(await excluirTreinamento(t.id)));
                            }
                          }}
                          className="text-slate-500 hover:text-red-600"
                          aria-label="Excluir"
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {cargos.length === 0 ? (
              <p className="mt-2 text-xs text-slate-500">Cadastre os cargos (acima) para montar a matriz.</p>
            ) : null}
          </div>
        )}
      </section>

      {form ? (
        <FormularioDeTreinamento
          companyId={companyId}
          treinamento={form === "novo" ? null : form}
          onClose={() => setForm(null)}
        />
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------ pendências

function Pendencias({
  companyId,
  treinamentos,
  pessoas,
  semCargo,
  onProgramar,
}: {
  companyId: string;
  treinamentos: Treinamento[];
  pessoas: { id: string; nome: string; pendentes: number }[];
  semCargo: number;
  onProgramar: (treinamentoId: string) => void;
}) {
  const exigidos = treinamentos.filter((t) => t.ativo && t.precisam > 0);
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Por treinamento</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">
          Quantos da equipe ativa a matriz pede, quantos já fizeram e quem falta.
        </p>
        {exigidos.length === 0 ? (
          <p className="text-sm text-slate-500">A matriz ainda não pede nenhum treinamento para quem está na equipe.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {exigidos.map((t) => {
              const pct = Math.round((t.fizeram / t.precisam) * 100);
              return (
                <li key={t.id} className="py-2">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{nomeDe(t)}</span>
                    <span className="text-xs text-slate-500">
                      {t.fizeram}/{t.precisam} · {pct}%
                    </span>
                    {t.faltam.length > 0 ? (
                      <button type="button" onClick={() => onProgramar(t.id)} className="text-micro text-brand-700 hover:text-brand-900">
                        Programar turma
                      </button>
                    ) : null}
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
                  </div>
                  {t.faltam.length > 0 ? (
                    <p className="mt-1 text-micro text-slate-500">Falta: {t.faltam.join(", ")}</p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Por pessoa</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">A lista completa de cada um fica na ficha da pessoa.</p>
        {pessoas.length === 0 ? (
          <p className="text-sm text-emerald-700">Ninguém com pendência.</p>
        ) : (
          <ul className="space-y-1">
            {pessoas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/empresas/${companyId}/equipe/${p.id}`} className="truncate text-slate-700 hover:text-brand-700">
                  {p.nome}
                </Link>
                <span className="shrink-0 rounded bg-orange-50 px-1.5 py-0.5 text-micro font-medium text-orange-700">
                  {p.pendentes}
                </span>
              </li>
            ))}
          </ul>
        )}
        {semCargo > 0 ? (
          <p className="mt-3 rounded-md bg-slate-50 px-2 py-1.5 text-micro text-slate-500">
            {semCargo} pessoa(s) ativa(s) sem cargo no cadastro: a matriz não sabe o que pedir para elas.
          </p>
        ) : null}
      </section>
    </div>
  );
}

// ------------------------------------------------------------ integração

function Integracao({
  companyId,
  modelo,
  abertas,
}: {
  companyId: string;
  modelo: string[];
  abertas: { id: string; nome: string; feitos: number; total: number }[];
}) {
  const [texto, setTexto] = useState(modelo.join("\n"));
  const [pending, startTransition] = useTransition();
  const [gravado, setGravado] = useState(false);

  return (
    <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Checklist de integração</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">
          Um item por linha. Cada pessoa nova cadastrada na Equipe recebe esta lista na ficha. Mudar aqui vale para quem
          entrar daqui em diante.
        </p>
        <textarea
          value={texto}
          rows={Math.max(8, texto.split("\n").length + 1)}
          onChange={(e) => {
            setTexto(e.target.value);
            setGravado(false);
          }}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed outline-none focus:border-brand-500"
        />
        <div className="mt-2 flex items-center gap-3">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const r = await salvarModeloDeIntegracao(companyId, texto);
                avisar(r);
                if (r.ok) setGravado(true);
              })
            }
            className={botao}
          >
            {pending ? "Gravando…" : "Salvar checklist"}
          </button>
          {gravado ? <span className="text-xs text-emerald-700">Gravado.</span> : null}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="text-sm font-semibold text-slate-900">Integrações em aberto</h2>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">Quem está na equipe com item ainda por fazer.</p>
        {abertas.length === 0 ? (
          <p className="text-sm text-emerald-700">Nenhuma integração em aberto.</p>
        ) : (
          <ul className="space-y-1.5">
            {abertas.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/empresas/${companyId}/equipe/${p.id}`} className="truncate text-slate-700 hover:text-brand-700">
                  {p.nome}
                </Link>
                <span className="shrink-0 text-xs text-slate-500">
                  {p.feitos}/{p.total}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ----------------------------------------------------------------- a tela

const ABAS = [
  { slug: "programacao", rotulo: "Programação" },
  { slug: "catalogo", rotulo: "Catálogo e matriz" },
  { slug: "pendencias", rotulo: "Pendências" },
  { slug: "integracao", rotulo: "Integração" },
] as const;

export default function TreinamentosTela({
  companyId,
  aba,
  ano,
  mesPadrao,
  cargos,
  treinamentos,
  turmas,
  totais,
  pessoasComPendencia,
  semCargo,
  modeloDeIntegracao,
  integracaoAberta,
  outrasEmpresas,
}: {
  companyId: string;
  aba: (typeof ABAS)[number]["slug"];
  ano: number;
  mesPadrao: string;
  cargos: Cargo[];
  treinamentos: Treinamento[];
  turmas: Turma[];
  totais: { programado: Totais; realizado: Totais; justificadas: number; cumprimento: number | null };
  pessoasComPendencia: { id: string; nome: string; pendentes: number }[];
  semCargo: number;
  modeloDeIntegracao: string[];
  integracaoAberta: { id: string; nome: string; feitos: number; total: number }[];
  outrasEmpresas: { id: string; nome: string; treinamentos: number }[];
}) {
  // Programar abre o formulário; vindo de Pendências, já com o treinamento escolhido.
  const [programando, setProgramando] = useState<string | null | false>(false);

  return (
    <main>
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">Treinamentos</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">
          O que cada cargo precisa aprender, o que está programado no ano, o que já foi feito e por quem. Cada turma é
          uma reunião: convocados, presença, pauta e ata ficam nela, e quem esteve presente ganha o treinamento no
          histórico da ficha.
        </p>
      </div>

      <nav className="mb-4 flex flex-wrap gap-1 border-b border-slate-200">
        {ABAS.map((a) => (
          <Link
            key={a.slug}
            href={`?aba=${a.slug}${a.slug === "programacao" ? `&ano=${ano}` : ""}`}
            className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
              aba === a.slug
                ? "border-brand-600 font-semibold text-brand-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {a.rotulo}
            {a.slug === "pendencias" && pessoasComPendencia.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-orange-100 px-1.5 text-micro font-medium text-orange-700">
                {pessoasComPendencia.length}
              </span>
            ) : null}
            {a.slug === "integracao" && integracaoAberta.length > 0 ? (
              <span className="ml-1.5 rounded-full bg-violet-100 px-1.5 text-micro font-medium text-violet-700">
                {integracaoAberta.length}
              </span>
            ) : null}
          </Link>
        ))}
      </nav>

      {aba === "programacao" ? (
        <Programacao companyId={companyId} ano={ano} turmas={turmas} totais={totais} onProgramar={() => setProgramando(null)} />
      ) : aba === "catalogo" ? (
        <Catalogo companyId={companyId} cargos={cargos} treinamentos={treinamentos} outrasEmpresas={outrasEmpresas} />
      ) : aba === "pendencias" ? (
        <Pendencias
          companyId={companyId}
          treinamentos={treinamentos}
          pessoas={pessoasComPendencia}
          semCargo={semCargo}
          onProgramar={(id) => setProgramando(id)}
        />
      ) : (
        <Integracao companyId={companyId} modelo={modeloDeIntegracao} abertas={integracaoAberta} />
      )}

      {programando !== false ? (
        <FormularioDeTurma
          companyId={companyId}
          treinamentos={treinamentos}
          inicial={programando}
          mesPadrao={mesPadrao}
          onClose={() => setProgramando(false)}
        />
      ) : null}
    </main>
  );
}
