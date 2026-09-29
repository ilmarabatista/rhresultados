"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { CalendarClock, Plus, Search, Trash2, Users } from "lucide-react";
import { excluirReuniao } from "@/app/(app)/empresas/[id]/reunioes/actions";
import { reuniaoCombina, ROTULO_DA_SITUACAO, type SituacaoDaReuniao } from "@/lib/reunioes";
import type { OpcoesDaReuniao } from "@/lib/reunioes-dados";
import { Vazio } from "./ui";
import NewMeetingDialog from "./new-meeting-dialog";

/**
 * Todas as reuniões da empresa, uma por linha: as criadas à mão e as dos planos
 * de treinamento. Primeiro as a agendar, depois as próximas (as
 * mais perto primeiro) e as que já passaram (as mais recentes primeiro); as
 * arquivadas ficam guardadas embaixo.
 */

export type ReuniaoDaLista = {
  id: string;
  href: string;
  reuniaoId: string;
  numero: number;
  codigo: string;
  /** O plano, quando a reunião é de um. */
  plano: string | null;
  /** O nome curto do produto a que a reunião se refere. */
  produto: string | null;
  titulo: string;
  /** "dd/mm/aaaa", ou nulo quando está a agendar. */
  dia: string | null;
  /** "AAAA-MM-DD", para ordenar e comparar com hoje. */
  chave: string | null;
  hora: string | null;
  situacao: SituacaoDaReuniao;
  setor: string | null;
  unidade: string;
  tipo: string | null;
  local: string | null;
  participantes: number;
  combinadosAbertos: number;
  /** Os combinados em aberto, para ler ao passar o mouse. */
  combinados: { texto: string; responsavel: string | null; prazo: string | null }[];
};

const PROXIMAS_VISIVEIS = 8;
const PASSADAS_VISIVEIS = 15;

const ordem = (r: ReuniaoDaLista) => `${r.chave ?? ""} ${r.hora ?? ""}`;

function LinhaDaReuniao({ r, hoje }: { r: ReuniaoDaLista; hoje: string }) {
  const [pending, startTransition] = useTransition();
  const semMarcar = r.situacao === "AGENDADA" && r.chave !== null && r.chave < hoje;

  /** Sai com pauta, ata e o compromisso na agenda; a de um plano continua no plano como encontro. */
  const excluir = () => {
    const pergunta = r.plano
      ? `Excluir a reunião "${r.titulo}", com a pauta e a ata? O encontro continua no plano "${r.plano}", sem data na agenda.`
      : `Excluir a reunião "${r.titulo}", com a pauta e a ata?`;
    if (!confirm(pergunta)) return;

    startTransition(async () => {
      const resposta = await excluirReuniao(r.reuniaoId);
      if (resposta.error) alert(resposta.error);
    });
  };

  return (
    <div
      className={`group flex items-center border-b border-slate-100 pr-2 transition hover:bg-brand-50/40 ${
        pending ? "opacity-50" : ""
      }`}
    >
      <Link
        href={r.href}
        className="grid min-w-0 flex-1 grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-x-4 px-3 py-2.5 md:grid-cols-[7.5rem_minmax(0,1fr)_5rem_5rem_2.5rem_9.5rem_7rem]"
      >
      <span className="text-[13px] font-semibold tabular-nums text-slate-800">
        {r.dia ?? <span className="font-normal text-slate-400">a agendar</span>}
        {r.hora ? <span className="ml-1.5 text-[11px] font-normal text-slate-400">{r.hora}</span> : null}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[13px] font-medium text-slate-800">{r.titulo}</span>
        <span className="block truncate text-[11px] text-slate-400">
          {[r.codigo, r.plano ? `plano ${r.plano}` : null, r.setor, r.tipo, r.local].filter(Boolean).join(" · ")}
        </span>
      </span>

      <span className="hidden md:block">
        {r.produto ? (
          <span className="inline-block max-w-full truncate rounded border border-slate-300 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
            {r.produto}
          </span>
        ) : (
          <span className="text-[11px] text-slate-300">—</span>
        )}
      </span>

      <span className="hidden truncate text-[11px] text-slate-500 md:block" title={r.unidade}>
        {r.unidade}
      </span>

      <span className="hidden items-center gap-1 text-[11px] text-slate-500 md:flex">
        <Users size={12} /> {r.participantes}
      </span>

      <span className={`group/comb relative hidden text-[11px] md:block ${r.combinadosAbertos > 0 ? "cursor-help text-amber-700" : "text-slate-400"}`}>
        {r.combinadosAbertos === 0
          ? "nenhum combinado aberto"
          : `${r.combinadosAbertos} combinado${r.combinadosAbertos === 1 ? "" : "s"} aberto${r.combinadosAbertos === 1 ? "" : "s"}`}
        {r.combinados.length > 0 ? (
          // Ao passar o mouse: os combinados em aberto, sem precisar abrir a reunião.
          <span className="pointer-events-none absolute right-0 top-full z-30 mt-1 hidden w-80 rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-xl group-hover/comb:block">
            <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-amber-700">Combinados em aberto</span>
            {r.combinados.map((c, i) => (
              <span key={i} className="block border-t border-slate-100 py-1 first-of-type:border-t-0">
                <span className="block whitespace-normal text-[12px] leading-snug text-slate-800">{c.texto}</span>
                {c.responsavel || c.prazo ? (
                  <span className="block text-[10px] text-slate-500">
                    {[c.responsavel, c.prazo ? `até ${c.prazo}` : null].filter(Boolean).join(" · ")}
                  </span>
                ) : null}
              </span>
            ))}
          </span>
        ) : null}
      </span>

      <span className="hidden items-center gap-1.5 text-[11px] md:flex">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            semMarcar
              ? "bg-amber-400"
              : r.situacao === "REALIZADA"
                ? "bg-emerald-500"
                : r.situacao === "ARQUIVADA"
                  ? "bg-slate-300"
                  : "bg-brand-500"
          }`}
        />
        <span className={semMarcar ? "text-amber-700" : "text-slate-600"}>
          {semMarcar ? "sem marcar feito" : ROTULO_DA_SITUACAO[r.situacao]}
        </span>
      </span>
      </Link>

      <button
        type="button"
        disabled={pending}
        onClick={excluir}
        className="shrink-0 rounded p-1 text-slate-300 transition hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
        aria-label={`Excluir ${r.titulo}`}
        title="Excluir a reunião"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

function Grupo({
  titulo,
  detalhe,
  children,
}: {
  titulo: string;
  detalhe: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <p className="flex items-center gap-1.5 border-b border-slate-200 px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <CalendarClock size={12} /> {titulo}
        <span className="font-normal normal-case tracking-normal text-slate-400">{detalhe}</span>
      </p>
      <div className="bg-white">{children}</div>
    </section>
  );
}

function VerMais({ quantas, onClick }: { quantas: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full px-3 py-1.5 text-left text-[11px] text-brand-700 transition hover:bg-brand-50/40"
    >
      ver mais {quantas}
    </button>
  );
}

export default function MeetingsList({
  companyId,
  reunioes,
  opcoes,
  hoje,
  abrirNova,
}: {
  companyId: string;
  reunioes: ReuniaoDaLista[];
  opcoes: OpcoesDaReuniao;
  hoje: string;
  /** Abre a janela de nova reunião ao chegar — o endereço antigo de "nova" leva para cá. */
  abrirNova: boolean;
}) {
  const [busca, setBusca] = useState("");
  const [nova, setNova] = useState(abrirNova);
  const [todasAsProximas, setTodasAsProximas] = useState(false);
  const [todasAsPassadas, setTodasAsPassadas] = useState(false);
  const [verArquivadas, setVerArquivadas] = useState(false);

  const achadas = reunioes.filter((r) => reuniaoCombina(r, busca));
  const ativas = achadas.filter((r) => r.situacao !== "ARQUIVADA");
  const aAgendar = ativas.filter((r) => !r.chave);
  const proximas = ativas
    .filter((r) => r.chave && r.chave >= hoje && r.situacao === "AGENDADA")
    .sort((a, b) => ordem(a).localeCompare(ordem(b)));
  const passadas = ativas
    .filter((r) => r.chave && !(r.chave >= hoje && r.situacao === "AGENDADA"))
    .sort((a, b) => ordem(b).localeCompare(ordem(a)));
  const arquivadas = achadas.filter((r) => r.situacao === "ARQUIVADA");

  // Buscando, mostra tudo o que achou; sem busca, só o começo de cada grupo.
  const buscando = busca.trim().length > 0;
  const proximasNaTela = buscando || todasAsProximas ? proximas : proximas.slice(0, PROXIMAS_VISIVEIS);
  const passadasNaTela = buscando || todasAsPassadas ? passadas : passadas.slice(0, PASSADAS_VISIVEIS);

  return (
    <main className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Reuniões</h1>
          <p className="mt-0.5 text-xs text-slate-500">
            Pauta escrita antes, ata escrita depois — conversado, decidido e{" "}
            <span className="text-brand-700">combinado com um responsável e um prazo</span>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNova(true)}
          className="inline-flex items-center gap-1 rounded-md bg-brand-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-800"
        >
          <Plus size={13} /> Nova reunião
        </button>
      </div>

      {reunioes.length === 0 ? (
        <Vazio
          acao={
            <button
              type="button"
              onClick={() => setNova(true)}
              className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-800"
            >
              Criar a primeira reunião
            </button>
          }
        >
          Nenhuma reunião registrada para esta empresa.
        </Vazio>
      ) : (
        <>
          <label className="flex items-center gap-2 border-b border-slate-200 pb-1.5">
            <Search size={13} className="text-slate-400" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por título, plano, setor, tipo ou REU-…"
              className="w-full bg-transparent text-[13px] outline-none placeholder:text-slate-400"
            />
          </label>

          {aAgendar.length > 0 ? (
            <Grupo titulo="A agendar" detalhe={`${aAgendar.length} · ainda sem data`}>
              {aAgendar.map((r) => (
                <LinhaDaReuniao key={r.id} r={r} hoje={hoje} />
              ))}
            </Grupo>
          ) : null}

          {proximas.length > 0 ? (
            <Grupo titulo="Próximas" detalhe={`${proximas.length} · as mais perto primeiro`}>
              {proximasNaTela.map((r) => (
                <LinhaDaReuniao key={r.id} r={r} hoje={hoje} />
              ))}
              {proximasNaTela.length < proximas.length ? (
                <VerMais quantas={proximas.length - proximasNaTela.length} onClick={() => setTodasAsProximas(true)} />
              ) : null}
            </Grupo>
          ) : null}

          {passadas.length > 0 ? (
            <Grupo titulo="Últimas reuniões" detalhe={`${passadas.length} · mais recentes primeiro`}>
              {passadasNaTela.map((r) => (
                <LinhaDaReuniao key={r.id} r={r} hoje={hoje} />
              ))}
              {passadasNaTela.length < passadas.length ? (
                <VerMais quantas={passadas.length - passadasNaTela.length} onClick={() => setTodasAsPassadas(true)} />
              ) : null}
            </Grupo>
          ) : null}

          {achadas.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">Nenhuma reunião com “{busca}”.</p>
          ) : null}

          {arquivadas.length > 0 ? (
            verArquivadas ? (
              <Grupo titulo="Arquivadas" detalhe={String(arquivadas.length)}>
                {arquivadas.map((r) => (
                  <LinhaDaReuniao key={r.id} r={r} hoje={hoje} />
                ))}
              </Grupo>
            ) : (
              <button
                type="button"
                onClick={() => setVerArquivadas(true)}
                className="px-3 text-[11px] text-slate-400 transition hover:text-brand-700"
              >
                ver {arquivadas.length} arquivada{arquivadas.length === 1 ? "" : "s"}
              </button>
            )
          ) : null}
        </>
      )}

      {nova ? (
        <NewMeetingDialog
          companyId={companyId}
          opcoes={opcoes}
          hoje={hoje}
          aoFechar={() => setNova(false)}
        />
      ) : null}
    </main>
  );
}
