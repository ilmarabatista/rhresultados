"use client";

import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowRight, Bell, Check, ClipboardCheck, Copy, MessageCircle, Plus, Trash2 } from "lucide-react";
import { enviarTesteAoCandidato } from "@/app/(app)/testes/actions";
import {
  adicionarCandidato,
  adicionarEtapa,
  anotarNaEtapa,
  aprovarCandidato,
  editarEtapa,
  encerrarCandidato,
  excluirEtapa,
  marcarAvisado,
  marcarCobrado,
  moverCandidato,
  moverEtapa,
  reabrirCandidato,
  type SelecaoState,
} from "@/app/(app)/selecao/actions";
import {
  PENDENCIAS,
  TIPOS_DE_ETAPA,
  linkDoWhatsapp,
  recadoDeAprovacao,
  recadoDeCobranca,
  recadoDeReprovacao,
  rotuloDoTipo,
  type EtapaTipo,
  type Pendencia,
} from "@/lib/selecao";
import { Etiqueta, Painel, Vazio } from "./ui";
import { Field, FormError, Input, Select, SubmitButton } from "./form";

/**
 * O quadro da vaga: uma coluna por etapa, com quem está em cada uma.
 *
 * O quadro mostra o que exige ação — quem está esperando resposta, quem passou
 * do prazo, quem saiu sem receber retorno. Quem saiu do processo não some: vai
 * para a lista de encerrados, onde o retorno ainda pode ser dado.
 */

export type CandidatoNaTela = {
  id: string;
  nome: string;
  telefone: string | null;
  email: string | null;
  etapaId: string | null;
  situacao: string;
  diasNaEtapa: number;
  pendencias: Pendencia[];
  anotacao: string;
  avisado: boolean;
  cobradoEm: string | null;
  /** O último motivo registrado — o que foi escrito ao reprovar ou aprovar. */
  ultimoMotivo: string | null;
  /** Os testes mandados a ele pelo quadro, com o resultado quando voltou. */
  testes: { id: string; token: string; nome: string; respondido: boolean }[];
};

export type TesteDisponivel = { id: string; nome: string };

export type EtapaNaTela = {
  id: string;
  nome: string;
  tipo: EtapaTipo;
  prazoDias: number | null;
  ordem: number;
};

export type FunilNaTela = { id: string; nome: string; agora: number; passaram: number; pararam: number }[];

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";

const TOM_DA_PENDENCIA: Record<Pendencia, "atencao" | "ruim"> = {
  ESPERANDO_RESPOSTA: "atencao",
  PARADO: "ruim",
  SEM_RETORNO: "ruim",
};

/** O link público do teste, montado no navegador com o endereço de onde o sistema está aberto. */
function linkDoTeste(token: string) {
  return `${window.location.origin}/teste/${token}`;
}

/**
 * Os testes do candidato: os que já foram (com o resultado quando voltou) e o
 * envio de um novo, que gera o link e abre o WhatsApp com a mensagem pronta.
 */
function TestesDoCandidato({
  c,
  disponiveis,
}: {
  c: CandidatoNaTela;
  disponiveis: TesteDisponivel[];
}) {
  const [teste, setTeste] = useState(disponiveis[0]?.id ?? "");
  const [copiado, setCopiado] = useState<string | null>(null);
  const [pendente, iniciar] = useTransition();

  const mensagem = (nome: string, token: string) =>
    `Olá, ${c.nome.split(" ")[0]}! Segue o link para responder o teste "${nome}": ${linkDoTeste(token)}`;

  return (
    <div className="space-y-1 rounded-md bg-slate-50 p-1.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Testes</p>
      {c.testes.map((t) => (
        <div key={t.id} className="flex flex-wrap items-center gap-1 text-[11px] text-slate-600">
          <span className="min-w-0 flex-1 truncate">{t.nome}</span>
          {t.respondido ? (
            <Link href={`/testes/resultado/${t.id}`} className="text-emerald-700 hover:underline">
              ver resultado
            </Link>
          ) : (
            <>
              <span className="text-amber-700">esperando</span>
              <button
                type="button"
                className={botao}
                title="Copiar a mensagem com o link"
                onClick={async () => {
                  await navigator.clipboard.writeText(mensagem(t.nome, t.token));
                  setCopiado(t.id);
                  setTimeout(() => setCopiado(null), 2000);
                }}
              >
                <Copy className="h-3 w-3" /> {copiado === t.id ? "copiado" : "link"}
              </button>
              {/* Montado no clique: o endereço do navegador não existe no servidor. */}
              <button
                type="button"
                className={botao}
                title="Mandar pelo WhatsApp"
                onClick={() => window.open(linkDoWhatsapp(c.telefone, mensagem(t.nome, t.token)), "_blank", "noreferrer")}
              >
                <MessageCircle className="h-3 w-3" />
              </button>
            </>
          )}
        </div>
      ))}
      {disponiveis.length > 0 ? (
        <div className="flex gap-1">
          <select
            value={teste}
            onChange={(e) => setTeste(e.target.value)}
            aria-label="Teste para enviar"
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-1.5 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-400"
          >
            {disponiveis.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pendente || !teste}
            className={botao}
            onClick={() =>
              iniciar(async () => {
                const r = await enviarTesteAoCandidato(c.id, teste);
                if (r.error || !r.token) {
                  alert(r.error ?? "Não foi possível gerar o link.");
                  return;
                }
                const nome = disponiveis.find((d) => d.id === teste)?.nome ?? "teste";
                // Abre o WhatsApp já com a mensagem; sem telefone, copia o link.
                if (c.telefone) window.open(linkDoWhatsapp(c.telefone, mensagem(nome, r.token)), "_blank");
                else {
                  await navigator.clipboard.writeText(mensagem(nome, r.token)).catch(() => undefined);
                  alert("Link gerado e copiado. Cole na conversa com o candidato.");
                }
              })
            }
          >
            <ClipboardCheck className="h-3 w-3" /> {pendente ? "Gerando…" : "Enviar teste"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** O que a etapa cobra, em palavras de recado. */
function oQueSeCobra(tipo: EtapaTipo): string {
  if (tipo === "FICHA") return "a ficha de solicitação de emprego preenchida";
  if (tipo === "TESTE") return "a resposta do teste enviado";
  return "o seu retorno";
}

// ------------------------------------------------------------------ candidato

function Candidato({
  c,
  etapa,
  vaga,
  empresa,
  etapas,
  testesDisponiveis,
}: {
  c: CandidatoNaTela;
  etapa: EtapaNaTela | null;
  vaga: string;
  empresa: string | null;
  etapas: EtapaNaTela[];
  testesDisponiveis: TesteDisponivel[];
}) {
  const [aberto, setAberto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [anotacao, setAnotacao] = useState(c.anotacao);
  const [, startTransition] = useTransition();

  useEffect(() => setAnotacao(c.anotacao), [c.anotacao]);

  const rodar = (fn: () => Promise<SelecaoState>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) alert(r.error);
      else setMotivo("");
    });

  const encerrado = c.situacao !== "EM_ANDAMENTO";
  const recado = encerrado
    ? c.situacao === "APROVADO"
      ? recadoDeAprovacao(c.nome, vaga)
      : recadoDeReprovacao(c.nome, vaga, empresa)
    : recadoDeCobranca(c.nome, oQueSeCobra(etapa?.tipo ?? "LIVRE"), null);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <div className="flex items-start justify-between gap-2">
        <button type="button" className="text-left" onClick={() => setAberto((v) => !v)}>
          <p className="text-[13px] font-medium text-slate-800">{c.nome}</p>
          <p className="text-[11px] text-slate-500">
            {c.telefone ?? c.email ?? "sem contato"}
            {!encerrado && c.diasNaEtapa > 0 ? ` · há ${c.diasNaEtapa} dia(s) aqui` : ""}
          </p>
        </button>
        <div className="flex flex-wrap justify-end gap-1">
          {c.pendencias.map((p) => (
            <Etiqueta key={p} tom={TOM_DA_PENDENCIA[p]}>
              {PENDENCIAS[p].rotulo}
            </Etiqueta>
          ))}
        </div>
      </div>

      {aberto ? (
        <div className="mt-2 space-y-2 border-t border-slate-100 pt-2">
          {!encerrado || c.testes.length > 0 ? (
            <TestesDoCandidato c={c} disponiveis={encerrado ? [] : testesDisponiveis} />
          ) : null}
          {encerrado ? (
            <>
              {c.ultimoMotivo ? <p className="text-[11px] text-slate-600">Motivo: {c.ultimoMotivo}</p> : null}
              <div className="flex flex-wrap gap-1">
                <a className={botao} href={linkDoWhatsapp(c.telefone, recado)} target="_blank" rel="noreferrer">
                  <MessageCircle className="h-3 w-3" /> Dar retorno
                </a>
                <button type="button" className={botao} onClick={() => rodar(() => marcarAvisado(c.id, !c.avisado))}>
                  <Check className="h-3 w-3" /> {c.avisado ? "Desmarcar avisado" : "Marcar como avisado"}
                </button>
                <button type="button" className={botao} onClick={() => rodar(() => reabrirCandidato(c.id))}>
                  Reabrir
                </button>
              </div>
            </>
          ) : (
            <>
              <textarea
                value={anotacao}
                onChange={(e) => setAnotacao(e.target.value)}
                onBlur={() => {
                  if (anotacao !== c.anotacao) rodar(() => anotarNaEtapa(c.id, anotacao));
                }}
                rows={2}
                placeholder="O que aconteceu nesta etapa."
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-brand-400"
              />
              <input
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                placeholder="Motivo (obrigatório para reprovar)"
                className="w-full rounded-md border border-slate-200 px-2 py-1 text-[12px] text-slate-700 outline-none focus:border-brand-400"
              />
              <div className="flex flex-wrap gap-1">
                <button type="button" className={botao} onClick={() => rodar(() => aprovarCandidato(c.id, motivo))}>
                  <ArrowRight className="h-3 w-3" /> Passar de etapa
                </button>
                <button type="button" className={botao} onClick={() => rodar(() => encerrarCandidato(c.id, "REPROVADO", motivo))}>
                  Reprovar
                </button>
                <button type="button" className={botao} onClick={() => rodar(() => encerrarCandidato(c.id, "DESISTIU", motivo))}>
                  Desistiu
                </button>
                <a className={botao} href={linkDoWhatsapp(c.telefone, recado)} target="_blank" rel="noreferrer">
                  <Bell className="h-3 w-3" /> Cobrar
                </a>
                <button type="button" className={botao} onClick={() => rodar(() => marcarCobrado(c.id))}>
                  {c.cobradoEm ? `Cobrado em ${c.cobradoEm}` : "Marcar cobrado"}
                </button>
              </div>
              {etapas.length > 1 ? (
                <select
                  value={c.etapaId ?? ""}
                  onChange={(e) => rodar(() => moverCandidato(c.id, e.target.value))}
                  className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-400"
                >
                  {etapas.map((e) => (
                    <option key={e.id} value={e.id}>
                      Mover para: {e.nome}
                    </option>
                  ))}
                </select>
              ) : null}
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------- etapas

function ColunaDaEtapa({
  etapa,
  candidatos,
  etapas,
  vaga,
  empresa,
  primeira,
  ultima,
  testesDisponiveis,
}: {
  etapa: EtapaNaTela;
  candidatos: CandidatoNaTela[];
  etapas: EtapaNaTela[];
  vaga: string;
  empresa: string | null;
  primeira: boolean;
  ultima: boolean;
  testesDisponiveis: TesteDisponivel[];
}) {
  const [editando, setEditando] = useState(false);
  const [nome, setNome] = useState(etapa.nome);
  const [, startTransition] = useTransition();

  const rodar = (fn: () => Promise<SelecaoState>) =>
    startTransition(async () => {
      const r = await fn();
      if (r.error) alert(r.error);
    });

  return (
    <div className="w-64 shrink-0 rounded-lg border border-slate-200 bg-slate-50/60 p-2">
      <div className="mb-2">
        {editando ? (
          <div className="space-y-1">
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              onBlur={() => {
                if (nome !== etapa.nome) rodar(() => editarEtapa(etapa.id, { nome }));
                setEditando(false);
              }}
              autoFocus
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-[12px] outline-none focus:border-brand-400"
            />
            <select
              value={etapa.tipo}
              onChange={(e) => rodar(() => editarEtapa(etapa.id, { tipo: e.target.value }))}
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] text-slate-600 outline-none focus:border-brand-400"
            >
              {TIPOS_DE_ETAPA.map((t) => (
                <option key={t.valor} value={t.valor}>
                  {t.rotulo} — {t.dica}
                </option>
              ))}
            </select>
            <input
              defaultValue={etapa.prazoDias ?? ""}
              onBlur={(e) => {
                const n = Number(e.target.value);
                rodar(() => editarEtapa(etapa.id, { prazoDias: Number.isFinite(n) && n > 0 ? Math.floor(n) : null }));
              }}
              placeholder="Prazo em dias"
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-[11px] outline-none focus:border-brand-400"
            />
          </div>
        ) : (
          <button type="button" className="text-left" onClick={() => setEditando(true)} title="Clique para editar a etapa">
            <p className="text-[12px] font-semibold text-slate-700">
              {etapa.nome} <span className="font-normal text-slate-400">({candidatos.length})</span>
            </p>
            <p className="text-[10px] text-slate-500">
              {rotuloDoTipo(etapa.tipo)}
              {etapa.prazoDias ? ` · até ${etapa.prazoDias} dias` : ""}
            </p>
          </button>
        )}
        <div className="mt-1 flex gap-1">
          {primeira ? null : (
            <button type="button" className={botao} onClick={() => rodar(() => moverEtapa(etapa.id, "SUBIR"))} title="Mover para antes">
              ←
            </button>
          )}
          {ultima ? null : (
            <button type="button" className={botao} onClick={() => rodar(() => moverEtapa(etapa.id, "DESCER"))} title="Mover para depois">
              →
            </button>
          )}
          <button type="button" className={botao} onClick={() => rodar(() => excluirEtapa(etapa.id))} title="Excluir a etapa">
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        {candidatos.length === 0 ? (
          <p className="px-1 py-2 text-[11px] text-slate-400">Ninguém aqui.</p>
        ) : (
          candidatos.map((c) => (
            <Candidato
              key={c.id}
              c={c}
              etapa={etapa}
              vaga={vaga}
              empresa={empresa}
              etapas={etapas}
              testesDisponiveis={testesDisponiveis}
            />
          ))
        )}
      </div>
    </div>
  );
}

function NovaEtapa({ vagaId }: { vagaId: string }) {
  const acao = adicionarEtapa.bind(null, vagaId);
  const [state, action] = useActionState<SelecaoState, FormData>(acao, {});
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  if (!aberto) {
    return (
      <button type="button" className={`${botao} h-fit`} onClick={() => setAberto(true)}>
        <Plus className="h-3 w-3" /> Etapa
      </button>
    );
  }

  return (
    <form action={action} className="w-64 shrink-0 space-y-1 rounded-lg border border-slate-200 bg-white p-2">
      <Input name="nome" required placeholder="Nome da etapa" />
      <Select name="tipo" defaultValue="LIVRE">
        {TIPOS_DE_ETAPA.map((t) => (
          <option key={t.valor} value={t.valor}>
            {t.rotulo}
          </option>
        ))}
      </Select>
      <Input name="prazoDias" placeholder="Prazo em dias (opcional)" />
      <FormError message={state.error} />
      <div className="flex justify-end gap-1">
        <button type="button" className={botao} onClick={() => setAberto(false)}>
          Cancelar
        </button>
        <SubmitButton>Adicionar</SubmitButton>
      </div>
    </form>
  );
}

// ------------------------------------------------------------------- quadro

function NovoCandidato({ vagaId }: { vagaId: string }) {
  const acao = adicionarCandidato.bind(null, vagaId);
  const [state, action] = useActionState<SelecaoState, FormData>(acao, {});
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (state.ok) setAberto(false);
  }, [state]);

  if (!aberto) {
    return (
      <button type="button" className={botao} onClick={() => setAberto(true)}>
        <Plus className="h-3 w-3" /> Candidato
      </button>
    );
  }

  return (
    <form action={action}>
      <Painel titulo="Novo candidato" descricao="Entra na primeira etapa da vaga.">
        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Nome">
            <Input name="name" required />
          </Field>
          <Field label="WhatsApp">
            <Input name="phone" placeholder="(83) 9 9999-9999" />
          </Field>
          <Field label="E-mail">
            <Input name="email" type="email" />
          </Field>
        </div>
        <FormError message={state.error} />
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" className={botao} onClick={() => setAberto(false)}>
            Cancelar
          </button>
          <SubmitButton>Cadastrar</SubmitButton>
        </div>
      </Painel>
    </form>
  );
}

export default function SelecaoQuadro({
  vagaId,
  vaga,
  empresa,
  etapas,
  candidatos,
  funil,
  testesDisponiveis,
}: {
  vagaId: string;
  vaga: string;
  empresa: string | null;
  etapas: EtapaNaTela[];
  candidatos: CandidatoNaTela[];
  funil: FunilNaTela;
  testesDisponiveis: TesteDisponivel[];
}) {
  const [verEncerrados, setVerEncerrados] = useState(false);

  const andando = candidatos.filter((c) => c.situacao === "EM_ANDAMENTO");
  const encerrados = candidatos.filter((c) => c.situacao !== "EM_ANDAMENTO");
  const semRetorno = encerrados.filter((c) => !c.avisado).length;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <NovoCandidato vagaId={vagaId} />
        {encerrados.length > 0 ? (
          <button type="button" className={botao} onClick={() => setVerEncerrados((v) => !v)}>
            {verEncerrados ? "Esconder encerrados" : `Encerrados (${encerrados.length})`}
            {semRetorno > 0 ? ` · ${semRetorno} sem retorno` : ""}
          </button>
        ) : null}
      </div>

      {etapas.length === 0 ? (
        <Vazio>
          Esta vaga ainda não tem etapas. Crie as etapas do processo para começar a mover os candidatos.
        </Vazio>
      ) : null}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {etapas.map((e, i) => (
          <ColunaDaEtapa
            key={e.id}
            etapa={e}
            etapas={etapas}
            candidatos={andando.filter((c) => c.etapaId === e.id)}
            vaga={vaga}
            empresa={empresa}
            primeira={i === 0}
            ultima={i === etapas.length - 1}
            testesDisponiveis={testesDisponiveis}
          />
        ))}
        <NovaEtapa vagaId={vagaId} />
      </div>

      {verEncerrados && encerrados.length > 0 ? (
        <Painel titulo="Encerrados" descricao="Quem saiu do processo. O retorno ao candidato é dado aqui.">
          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
            {encerrados.map((c) => (
              <Candidato key={c.id} c={c} etapa={null} vaga={vaga} empresa={empresa} etapas={etapas} testesDisponiveis={testesDisponiveis} />
            ))}
          </div>
        </Painel>
      ) : null}

      {funil.some((f) => f.passaram > 0) ? (
        <Painel titulo="Funil da vaga" descricao="Quantos passaram por cada etapa e quantos pararam nela.">
          <div className="space-y-1">
            {funil.map((f) => (
              <div key={f.id} className="flex items-center gap-2 text-[12px] text-slate-600">
                <span className="w-44 shrink-0 truncate">{f.nome}</span>
                <span className="w-24 shrink-0 text-slate-500">{f.passaram} passaram</span>
                <span className="w-24 shrink-0 text-slate-500">{f.pararam} pararam</span>
                <span className="text-slate-500">{f.agora} agora</span>
              </div>
            ))}
          </div>
        </Painel>
      ) : null}
    </div>
  );
}
