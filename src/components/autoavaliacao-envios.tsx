"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, MessageCircle } from "lucide-react";
import {
  gerarLinks,
  levarParaAvaliacao,
  type AutoavaliacaoState,
} from "@/app/(app)/empresas/[id]/pdi/autoavaliacoes/actions";
import { linkDoWhatsApp, mensagemDoLink, telefoneDoWhatsApp } from "@/lib/autoavaliacao";
import { Etiqueta, Tabela, Vazio } from "./ui";
import { copiarLink } from "./autoavaliacao-modelos";
import { avisar } from "@/components/avisos";
import { linkPublico } from "@/lib/link-publico";
import { lembreteDoLink } from "@/lib/cobranca";
import CobrarTodos from "./cobrar-todos";
import BotaoPrestador from "./botao-prestador";

/**
 * O controle de envio e de respostas: toda a equipe numa lista, com a
 * situação de cada um. Daqui se geram os links (de um ou de todos que faltam),
 * se manda cada um pelo WhatsApp da pessoa e, com a resposta, se segue para o
 * PDI dela.
 */

export type PessoaNoEnvio = {
  id: string;
  nome: string;
  funcao: string | null;
  telefone: string | null;
  sugerido: string;
  envio: {
    id: string;
    token: string;
    titulo: string;
    status: string;
    enviadoEm: string;
    /** Link gerado hoje: ainda é de mandar, não de cobrar. */
    deHoje: boolean;
    respondidoEm: string | null;
    prazo: string | null;
    atrasado: boolean;
    marcados: number;
    itens: number;
    atencao: number;
    avaliacaoId: string | null;
  } | null;
  temPlano: boolean;
};

type Situacao = "SEM_LINK" | "AGUARDANDO" | "RESPONDIDA" | "NO_PDI";

const FILTROS: { valor: Situacao | "TODOS"; rotulo: string }[] = [
  { valor: "TODOS", rotulo: "Todos" },
  { valor: "SEM_LINK", rotulo: "Sem link" },
  { valor: "AGUARDANDO", rotulo: "Aguardando resposta" },
  { valor: "RESPONDIDA", rotulo: "Respondidas" },
  { valor: "NO_PDI", rotulo: "Já no PDI" },
];

function situacao(p: PessoaNoEnvio): Situacao {
  if (!p.envio) return "SEM_LINK";
  if (p.envio.status !== "RESPONDIDO") return "AGUARDANDO";
  return p.envio.avaliacaoId ? "NO_PDI" : "RESPONDIDA";
}

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";
const botaoWhats =
  "inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-emerald-700";
const botaoForte =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700";

export default function AutoavaliacaoEnvios({
  companyId,
  pessoas,
  modelos,
}: {
  companyId: string;
  pessoas: PessoaNoEnvio[];
  modelos: { id: string; nome: string; perguntas: number }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filtro, setFiltro] = useState<Situacao | "TODOS">("TODOS");
  const [escolhidos, setEscolhidos] = useState<Record<string, string>>(() =>
    Object.fromEntries(pessoas.map((p) => [p.id, p.sugerido])),
  );
  const [prazo, setPrazo] = useState("");
  // A fila do "Enviar todos": o WhatsApp não manda em massa, então cada clique
  // abre a conversa da próxima pessoa, já com a mensagem e o link.
  const [fila, setFila] = useState<string[] | null>(null);
  const [mandados, setMandados] = useState<Set<string>>(() => new Set());

  const contagem = useMemo(() => {
    const c: Record<string, number> = { TODOS: pessoas.length, SEM_LINK: 0, AGUARDANDO: 0, RESPONDIDA: 0, NO_PDI: 0 };
    for (const p of pessoas) c[situacao(p)] += 1;
    return c;
  }, [pessoas]);
  const visiveis = pessoas.filter((p) => filtro === "TODOS" || situacao(p) === filtro);
  const prontosParaGerar = pessoas.filter((p) => !p.envio && escolhidos[p.id]);
  const comPerguntas = modelos.filter((m) => m.perguntas > 0);

  const gerar = (lista: PessoaNoEnvio[]) =>
    startTransition(async () => {
      const r = await gerarLinks(
        companyId,
        lista.map((p) => ({ employeeId: p.id, modeloId: escolhidos[p.id] ?? "" })),
        prazo,
      );
      if (r.error) avisar(r.error);
      else {
        avisar(r.gerados === 1 ? "Link gerado. Agora é mandar no WhatsApp." : `${r.gerados} links gerados. Agora é mandar no WhatsApp.`);
        if (filtro === "SEM_LINK") setFiltro("AGUARDANDO");
      }
    });

  const montar = (p: PessoaNoEnvio) =>
    startTransition(async () => {
      const r: AutoavaliacaoState = await levarParaAvaliacao(p.envio!.id);
      if (r.error) avisar(r.error);
      else router.push(`/empresas/${companyId}/pdi/${p.id}${r.id ? `?avaliacao=${r.id}` : ""}#avaliacao`);
    });

  const whatsapp = (p: PessoaNoEnvio) =>
    p.envio ? linkDoWhatsApp(p.telefone, mensagemDoLink(p.nome, linkPublico(`/autoavaliacao/${p.envio.token}`))) : "#";

  const aguardando = pessoas.filter((p) => situacao(p) === "AGUARDANDO" && p.envio!.deHoje);
  const paraCobrar = pessoas.filter((p) => situacao(p) === "AGUARDANDO" && !p.envio!.deHoje);
  const naFila = fila ? fila.map((id) => pessoas.find((p) => p.id === id)).filter((p): p is PessoaNoEnvio => Boolean(p)) : [];
  const proximo = naFila.find((p) => !mandados.has(p.id));
  const feitos = naFila.filter((p) => mandados.has(p.id)).length;

  const abrir = (p: PessoaNoEnvio) => {
    window.open(whatsapp(p), "_blank", "noreferrer");
    setMandados((atual) => new Set(atual).add(p.id));
  };
  const comecarFila = () => {
    const lista = aguardando.filter((p) => !mandados.has(p.id));
    if (lista.length === 0) return;
    setFila(lista.map((p) => p.id));
    abrir(lista[0]);
  };

  if (pessoas.length === 0) return <Vazio>Ninguém na equipe ainda. Cadastre as pessoas na aba Equipe.</Vazio>;

  return (
    <div className={`space-y-3 ${pending ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex flex-wrap items-center gap-1.5">
        {FILTROS.map((f) => (
          <button
            key={f.valor}
            type="button"
            onClick={() => setFiltro(f.valor)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              filtro === f.valor
                ? "border-brand-700 bg-brand-700 text-white"
                : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
            }`}
          >
            {f.rotulo} <span className="ml-0.5 tabular-nums opacity-70">{contagem[f.valor]}</span>
          </button>
        ))}
      </div>

      {contagem.SEM_LINK > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-brand-200 bg-brand-50/50 px-3 py-2 text-sm">
          <span className="text-slate-700">
            {contagem.SEM_LINK} pessoa(s) sem link.
            {prontosParaGerar.length < contagem.SEM_LINK
              ? ` ${contagem.SEM_LINK - prontosParaGerar.length} sem modelo escolhido.`
              : ""}
          </span>
          <label className="ml-auto flex items-center gap-1.5 text-xs text-slate-600">
            Responder até
            <input
              type="date"
              value={prazo}
              onChange={(e) => setPrazo(e.target.value)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs"
            />
          </label>
          <button type="button" className={botaoForte} disabled={prontosParaGerar.length === 0} onClick={() => gerar(prontosParaGerar)}>
            Gerar os links de todos ({prontosParaGerar.length})
          </button>
        </div>
      ) : null}

      {aguardando.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/60 px-3 py-2 text-sm">
          {!fila ? (
            <>
              <span className="text-slate-700">
                {aguardando.length} link(s) gerado(s) hoje. Mande para todos em sequência: cada clique abre o WhatsApp da
                próxima pessoa, com a mensagem pronta. É só apertar enviar lá e voltar aqui.
              </span>
              <button type="button" className={`${botaoWhats} ml-auto`} onClick={comecarFila}>
                <MessageCircle size={13} /> Enviar todos pelo WhatsApp ({aguardando.filter((p) => !mandados.has(p.id)).length})
              </button>
            </>
          ) : proximo ? (
            <>
              <span className="text-slate-700">
                {feitos} de {naFila.length} abertos. Próximo: <strong>{proximo.nome}</strong>
                {telefoneDoWhatsApp(proximo.telefone) ? "" : " (sem celular no cadastro, escolha o contato)"}.
              </span>
              <button type="button" className={`${botaoWhats} ml-auto`} onClick={() => abrir(proximo)}>
                <MessageCircle size={13} /> Abrir o WhatsApp de {proximo.nome.split(" ")[0]}
              </button>
              <button type="button" className={botaoClaro} onClick={() => setFila(null)}>
                Parar
              </button>
            </>
          ) : (
            <>
              <span className="text-slate-700">Pronto: o WhatsApp foi aberto para as {naFila.length} pessoa(s) da lista.</span>
              <button type="button" className={`${botaoClaro} ml-auto`} onClick={() => setFila(null)}>
                Fechar
              </button>
            </>
          )}
        </div>
      ) : null}

      <CobrarTodos
        pessoas={paraCobrar.map((p) => ({
          id: p.id,
          nome: p.nome,
          telefone: p.telefone,
          mensagem: lembreteDoLink(p.nome, "a sua autoavaliação", linkPublico(`/autoavaliacao/${p.envio!.token}`)),
        }))}
        aoCobrar={(id) => setMandados((atual) => new Set(atual).add(id))}
      />

      {visiveis.length === 0 ? (
        <Vazio>Ninguém nesta situação.</Vazio>
      ) : (
        <Tabela titulo="Equipe" direita={`${visiveis.length} pessoa(s)`}>
          {visiveis.map((p) => {
            const s = situacao(p);
            const temCelular = Boolean(telefoneDoWhatsApp(p.telefone));
            return (
              <div
                key={p.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-slate-100 px-3 py-2 last:border-b-0 even:bg-slate-50/60"
              >
                <div className="min-w-[11rem] flex-1">
                  <Link href={`/empresas/${companyId}/pdi/${p.id}#autoavaliacao`} className="text-sm font-medium text-slate-800 hover:text-brand-700">
                    {p.nome}
                  </Link>
                  <span className="block text-micro text-slate-500">
                    {p.funcao ?? "sem cargo"}
                    {p.envio ? ` · ${p.envio.titulo}` : ""}
                    {p.envio ? ` · link de ${p.envio.enviadoEm}` : ""}
                    {p.envio?.prazo ? ` · prazo ${p.envio.prazo}` : ""}
                    {p.envio?.respondidoEm ? ` · respondida em ${p.envio.respondidoEm}` : ""}
                    {s === "AGUARDANDO" && p.envio && p.envio.marcados > 0 ? ` · ${p.envio.marcados}/${p.envio.itens} marcados` : ""}
                    {s === "AGUARDANDO" && mandados.has(p.id) ? (p.envio!.deHoje ? " · WhatsApp aberto agora" : " · cobrado agora") : ""}
                  </span>
                </div>

                {s === "SEM_LINK" ? (
                  <Etiqueta>sem link</Etiqueta>
                ) : s === "AGUARDANDO" ? (
                  p.envio!.atrasado ? <Etiqueta tom="atencao">prazo vencido</Etiqueta> : <Etiqueta tom="azul">aguardando</Etiqueta>
                ) : s === "RESPONDIDA" ? (
                  <Etiqueta tom="bom">respondida{p.envio!.atencao > 0 ? ` · ${p.envio!.atencao} abaixo do padrão` : ""}</Etiqueta>
                ) : (
                  <Etiqueta tom="bom">{p.temPlano ? "PDI montado" : "na avaliação"}</Etiqueta>
                )}

                <div className="flex flex-wrap items-center gap-1.5">
                  {s === "SEM_LINK" ? (
                    <>
                      <select
                        value={escolhidos[p.id] ?? ""}
                        onChange={(e) => setEscolhidos((atual) => ({ ...atual, [p.id]: e.target.value }))}
                        className="max-w-[13rem] rounded-md border border-slate-300 px-2 py-1 text-xs"
                        aria-label={`Modelo para ${p.nome}`}
                      >
                        <option value="">Escolha o modelo</option>
                        {comPerguntas.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.nome}
                          </option>
                        ))}
                      </select>
                      <button type="button" className={botaoClaro} disabled={!escolhidos[p.id]} onClick={() => gerar([p])}>
                        Gerar link
                      </button>
                    </>
                  ) : s === "AGUARDANDO" ? (
                    <>
                      <a href={whatsapp(p)} target="_blank" rel="noreferrer" onClick={() => setMandados((atual) => new Set(atual).add(p.id))} className={botaoWhats} title={temCelular ? p.telefone ?? "" : "Sem celular no cadastro: o WhatsApp abre para escolher o contato"}>
                        <MessageCircle size={13} /> {temCelular ? "WhatsApp" : "WhatsApp (escolher contato)"}
                      </a>
                      <button type="button" className={botaoClaro} onClick={() => copiarLink(p.envio!.token)}>
                        <Copy size={13} /> Copiar link
                      </button>
                    </>
                  ) : s === "RESPONDIDA" ? (
                    <>
                      <Link href={`/empresas/${companyId}/pdi/${p.id}#autoavaliacao`} className={botaoClaro}>
                        Ver respostas
                      </Link>
                      <button type="button" className={botaoForte} onClick={() => montar(p)}>
                        Seguir para o PDI →
                      </button>
                    </>
                  ) : (
                    <Link href={`/empresas/${companyId}/pdi/${p.id}${p.temPlano ? "#plano" : `?avaliacao=${p.envio!.avaliacaoId}#avaliacao`}`} className={botaoForte}>
                      Abrir o PDI →
                    </Link>
                  )}
                  <BotaoPrestador employeeId={p.id} nome={p.nome} prestador={false} />
                </div>
              </div>
            );
          })}
        </Tabela>
      )}
      <p className="text-micro text-slate-500">
        O WhatsApp abre com a mensagem e o link prontos, no número do cadastro da pessoa. Quem está sem celular no
        cadastro: o WhatsApp abre para você escolher o contato.
      </p>
    </div>
  );
}
