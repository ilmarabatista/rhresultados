"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Pencil, Plus, Trash2 } from "lucide-react";
import {
  alternarPerguntaNaPesquisa,
  criarPerguntaPropria,
  editarPerguntaDaPesquisa,
  excluirPesquisa,
  mudarStatus,
  salvarConfiguracao,
  salvarPerfil,
  type ClimaState,
} from "@/app/(app)/empresas/[id]/clima/actions";
import { NOME_DO_TIPO, TIPOS, type PerguntaDePerfil, type StatusDaPesquisa, type TipoDePergunta } from "@/lib/clima";
import { Field, FormError, FormOk, Input, Select, SubmitButton, Textarea } from "./form";
import { Etiqueta, Painel } from "./ui";
import { avisarSeErro, confirmar } from "./avisos";

/**
 * Montar o ciclo: a configuração, o perfil e as perguntas. A situação e o link
 * ficam no alto de todas as abas (ClimaSituacao).
 *
 * As perguntas só mudam em rascunho. Com a pesquisa aberta, o que já foi
 * respondido precisa continuar valendo, então a lista fica só para leitura.
 */

export type PerguntaParaMontar = {
  id: string;
  enunciado: string;
  tipo: TipoDePergunta;
  enps: boolean;
  propria: boolean;
  /** O id da cópia na pesquisa, quando incluída. */
  naPesquisa: string | null;
  enunciadoNaPesquisa: string | null;
};

export type DimensaoParaMontar = { id: string | null; nome: string; perguntas: PerguntaParaMontar[] };

export type PesquisaParaMontar = {
  id: string;
  companyId: string;
  nome: string;
  status: StatusDaPesquisa;
  token: string;
  prazo: string;
  convidados: number | null;
  regua: number;
  introducao: string;
  respostas: number;
};

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";
const botao =
  "inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60";

/** A situação e o link: fica no alto de todas as abas do ciclo. */
export function ClimaSituacao({ pesquisa }: { pesquisa: PesquisaParaMontar }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [copiado, setCopiado] = useState(false);
  const [link, setLink] = useState(`/pesquisa/${pesquisa.token}`);
  useEffect(() => setLink(`${window.location.origin}/pesquisa/${pesquisa.token}`), [pesquisa.token]);

  function mudar(para: StatusDaPesquisa) {
    start(async () => {
      const r = await mudarStatus(pesquisa.id, para);
      avisarSeErro(r);
      router.refresh();
    });
  }

  async function excluir() {
    const texto = pesquisa.respostas
      ? `Excluir ${pesquisa.nome} e as ${pesquisa.respostas} respostas? Não dá para desfazer.`
      : `Excluir ${pesquisa.nome}?`;
    if (!(await confirmar(texto, { sim: "Excluir" }))) return;
    start(async () => {
      const r = await excluirPesquisa(pesquisa.id);
      avisarSeErro(r);
      if (r.ok) router.push(`/empresas/${pesquisa.companyId}/clima`);
    });
  }

  const aberta = pesquisa.status === "ABERTA";
  return (
    <Painel>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-slate-600">
            {pesquisa.status === "RASCUNHO"
              ? "Em rascunho: monte as perguntas e o perfil, e abra quando estiver pronta."
              : aberta
                ? `Aberta, com ${pesquisa.respostas} ${pesquisa.respostas === 1 ? "resposta" : "respostas"}. Divulgue o link para a equipe.`
                : `Encerrada, com ${pesquisa.respostas} respostas. O link não aceita mais respostas.`}
          </p>
          {pesquisa.status !== "RASCUNHO" ? (
            <div className="flex min-w-0 items-center gap-2">
              <code className="truncate rounded bg-slate-100 px-2 py-1 text-micro text-slate-700">{link}</code>
              <button
                type="button"
                className={botaoClaro}
                onClick={async () => {
                  await navigator.clipboard.writeText(link);
                  setCopiado(true);
                  setTimeout(() => setCopiado(false), 2000);
                }}
              >
                {copiado ? <Check size={13} /> : <Copy size={13} />}
                {copiado ? "Copiado" : "Copiar link"}
              </button>
            </div>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {pesquisa.status === "RASCUNHO" ? (
            <button type="button" disabled={pendente} onClick={() => mudar("ABERTA")} className={botao}>
              Abrir pesquisa
            </button>
          ) : null}
          {aberta && pesquisa.respostas === 0 ? (
            <button type="button" disabled={pendente} onClick={() => mudar("RASCUNHO")} className={botaoClaro}>
              Voltar para rascunho
            </button>
          ) : null}
          {aberta ? (
            <button type="button" disabled={pendente} onClick={() => mudar("ENCERRADA")} className={botao}>
              Encerrar
            </button>
          ) : null}
          {pesquisa.status === "ENCERRADA" ? (
            <button type="button" disabled={pendente} onClick={() => mudar("ABERTA")} className={botaoClaro}>
              Reabrir
            </button>
          ) : null}
          <button type="button" disabled={pendente} onClick={excluir} className={`${botaoClaro} text-red-700`}>
            <Trash2 size={13} /> Excluir
          </button>
        </div>
      </div>
    </Painel>
  );
}

function Configuracao({ pesquisa }: { pesquisa: PesquisaParaMontar }) {
  const [state, action] = useActionState<ClimaState, FormData>(salvarConfiguracao, {});
  return (
    <Painel titulo="Configuração">
      <form action={action} className="space-y-3">
        <input type="hidden" name="pesquisaId" value={pesquisa.id} />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Nome do ciclo *">
            <Input name="nome" required defaultValue={pesquisa.nome} />
          </Field>
          <Field label="Prazo para responder" hint="Depois desse dia o link fecha sozinho.">
            <Input name="prazo" type="date" defaultValue={pesquisa.prazo} />
          </Field>
          <Field label="Colaboradores convidados" hint="Para a taxa de adesão.">
            <Input name="convidados" type="number" min={1} defaultValue={pesquisa.convidados ?? ""} />
          </Field>
          <Field label="Régua *" hint="Nota a partir da qual está dentro do esperado.">
            <Input name="regua" inputMode="decimal" required defaultValue={String(pesquisa.regua).replace(".", ",")} />
          </Field>
        </div>
        <Field label="Texto de abertura" hint="O que a pessoa lê antes de começar. Em branco, vai um texto padrão sobre o objetivo e o anonimato.">
          <Textarea name="introducao" rows={3} defaultValue={pesquisa.introducao} />
        </Field>
        <FormError message={state.error} />
        {state.ok ? <FormOk message="Configuração salva." /> : null}
        <div className="flex justify-end">
          <SubmitButton>Salvar configuração</SubmitButton>
        </div>
      </form>
    </Painel>
  );
}

type LinhaDoPerfil = { chave?: string; rotulo: string; opcoes: string };

function Perfil({ pesquisa, perfil }: { pesquisa: PesquisaParaMontar; perfil: PerguntaDePerfil[] }) {
  const router = useRouter();
  const [linhas, setLinhas] = useState<LinhaDoPerfil[]>(
    perfil.map((p) => ({ chave: p.chave, rotulo: p.rotulo, opcoes: p.opcoes.join("\n") })),
  );
  const [estado, setEstado] = useState<ClimaState>({});
  const [pendente, start] = useTransition();
  const travado = pesquisa.respostas > 0;

  function mudar(i: number, campo: "rotulo" | "opcoes", valor: string) {
    setLinhas((atual) => atual.map((l, n) => (n === i ? { ...l, [campo]: valor } : l)));
    setEstado({});
  }

  return (
    <Painel
      titulo="Perfil de quem responde"
      descricao={
        travado
          ? "A pesquisa já tem respostas, então o perfil não muda mais."
          : "As perguntas que permitem ver os resultados por grupo. Uma opção por linha."
      }
    >
      <div className="grid gap-3 md:grid-cols-2">
        {linhas.map((l, i) => (
          <div key={i} className="space-y-1.5 rounded-lg border border-slate-200 p-2.5">
            <div className="flex items-center gap-2">
              <Input value={l.rotulo} disabled={travado} onChange={(e) => mudar(i, "rotulo", e.target.value)} placeholder="Pergunta" />
              {!travado ? (
                <button
                  type="button"
                  aria-label="Tirar do perfil"
                  onClick={() => setLinhas((atual) => atual.filter((_, n) => n !== i))}
                  className="rounded p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 size={14} />
                </button>
              ) : null}
            </div>
            <Textarea rows={4} value={l.opcoes} disabled={travado} onChange={(e) => mudar(i, "opcoes", e.target.value)} placeholder={"Opção 1\nOpção 2"} />
          </div>
        ))}
      </div>
      {!travado ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setLinhas((atual) => [...atual, { rotulo: "", opcoes: "" }])}
            className={botaoClaro}
            disabled={linhas.length >= 8}
          >
            <Plus size={13} /> Pergunta de perfil
          </button>
          <div className="flex items-center gap-2">
            {estado.error ? <span className="text-xs text-red-700">{estado.error}</span> : null}
            {estado.ok ? <span className="text-xs text-emerald-700">Perfil salvo.</span> : null}
            <button
              type="button"
              disabled={pendente}
              onClick={() =>
                start(async () => {
                  const r = await salvarPerfil(pesquisa.id, linhas);
                  setEstado(r);
                  if (r.ok) router.refresh();
                })
              }
              className={botao}
            >
              {pendente ? "Salvando…" : "Salvar perfil"}
            </button>
          </div>
        </div>
      ) : null}
    </Painel>
  );
}

function LinhaDePergunta({ pesquisaId, p, editavel }: { pesquisaId: string; p: PerguntaParaMontar; editavel: boolean }) {
  const router = useRouter();
  const [pendente, start] = useTransition();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(p.enunciadoNaPesquisa ?? p.enunciado);
  const incluida = p.naPesquisa !== null;
  const ajustada = incluida && p.enunciadoNaPesquisa !== null && p.enunciadoNaPesquisa !== p.enunciado;

  return (
    <li className={`flex items-start gap-2 py-1 ${incluida ? "" : "opacity-60"}`}>
      <input
        type="checkbox"
        checked={incluida}
        disabled={!editavel || pendente}
        aria-label={incluida ? "Tirar da pesquisa" : "Pôr na pesquisa"}
        onChange={(e) =>
          start(async () => {
            avisarSeErro(await alternarPerguntaNaPesquisa(pesquisaId, p.id, e.target.checked));
            router.refresh();
          })
        }
        className="mt-0.5 accent-brand-600"
      />
      <div className="min-w-0 flex-1">
        {editando ? (
          <div className="flex gap-2">
            <Input value={texto} onChange={(e) => setTexto(e.target.value)} className="text-xs" />
            <button
              type="button"
              className={botao}
              disabled={pendente}
              onClick={() =>
                start(async () => {
                  const r = await editarPerguntaDaPesquisa(p.naPesquisa!, texto);
                  avisarSeErro(r);
                  if (r.ok) {
                    setEditando(false);
                    router.refresh();
                  }
                })
              }
            >
              Salvar
            </button>
          </div>
        ) : (
          <span className="text-xs leading-snug text-slate-700">
            {incluida ? (p.enunciadoNaPesquisa ?? p.enunciado) : p.enunciado}
            {p.tipo !== "NOTA" ? <span className="ml-1.5"><Etiqueta>{NOME_DO_TIPO[p.tipo]}</Etiqueta></span> : null}
            {p.enps ? <span className="ml-1.5"><Etiqueta tom="azul">eNPS · 0 a 10</Etiqueta></span> : null}
            {p.propria ? <span className="ml-1.5"><Etiqueta tom="azul">só desta empresa</Etiqueta></span> : null}
            {ajustada ? <span className="ml-1.5"><Etiqueta tom="atencao">texto ajustado</Etiqueta></span> : null}
          </span>
        )}
      </div>
      {editavel && incluida && !editando ? (
        <button
          type="button"
          aria-label="Ajustar o texto nesta pesquisa"
          title="Ajustar o texto só nesta pesquisa. Texto diferente conta como pergunta nova no comparativo."
          onClick={() => setEditando(true)}
          className="rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-brand-700"
        >
          <Pencil size={13} />
        </button>
      ) : null}
    </li>
  );
}

function PerguntaPropria({ pesquisaId, dimensoes }: { pesquisaId: string; dimensoes: { id: string; nome: string }[] }) {
  const [aberta, setAberta] = useState(false);
  const [tipo, setTipo] = useState<TipoDePergunta>("NOTA");
  const [state, action] = useActionState<ClimaState, FormData>(criarPerguntaPropria, {});
  useEffect(() => {
    if (state.ok) setAberta(false);
  }, [state]);

  if (!aberta) {
    return (
      <button type="button" onClick={() => setAberta(true)} className={botaoClaro}>
        <Plus size={13} /> Pergunta só desta empresa
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-lg border border-brand-200 bg-brand-50/30 p-3">
      <input type="hidden" name="pesquisaId" value={pesquisaId} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem_12rem]">
        <Field label="Pergunta *" hint="Escreva de forma que nota alta seja bom.">
          <Input name="enunciado" required placeholder="O quanto…" />
        </Field>
        <Field label="Dimensão *">
          <Select name="dimensaoId" required>
            {dimensoes.map((d) => (
              <option key={d.id} value={d.id}>{d.nome}</option>
            ))}
          </Select>
        </Field>
        <Field label="Tipo">
          <Select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as TipoDePergunta)}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>{NOME_DO_TIPO[t]}</option>
            ))}
          </Select>
        </Field>
      </div>
      {tipo === "ESCOLHA" || tipo === "MULTIPLA" ? (
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
          <Field label="Opções *" hint="Uma por linha.">
            <Textarea name="opcoes" rows={4} required />
          </Field>
          {tipo === "MULTIPLA" ? (
            <Field label="Escolher até">
              <Input name="maxEscolhas" type="number" min={1} defaultValue={3} />
            </Field>
          ) : null}
        </div>
      ) : null}
      <FormError message={state.error} />
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setAberta(false)} className={botaoClaro}>Cancelar</button>
        <SubmitButton>Criar e incluir</SubmitButton>
      </div>
    </form>
  );
}

export default function ClimaMontar({
  pesquisa,
  perfil,
  dimensoes,
}: {
  pesquisa: PesquisaParaMontar;
  perfil: PerguntaDePerfil[];
  dimensoes: DimensaoParaMontar[];
}) {
  const editavel = pesquisa.status === "RASCUNHO";
  const incluidas = dimensoes.reduce((n, d) => n + d.perguntas.filter((p) => p.naPesquisa).length, 0);
  const [todas, setTodas] = useState(false);

  return (
    <div className="space-y-3.5">
      <Configuracao pesquisa={pesquisa} />
      <Perfil pesquisa={pesquisa} perfil={perfil} />

      <Painel
        titulo={`Perguntas (${incluidas})`}
        descricao={
          editavel
            ? "Marque as perguntas que entram nesta pesquisa. O lápis ajusta o texto só aqui."
            : "A pesquisa já foi aberta: as perguntas ficam como estão para o que foi respondido continuar valendo."
        }
        acao={
          editavel ? (
            <label className="flex items-center gap-1.5 text-xs text-slate-600">
              <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} className="accent-brand-600" />
              Mostrar também as que não entraram
            </label>
          ) : undefined
        }
      >
        <div className="space-y-3">
          {dimensoes.map((d) => {
            const visiveis = d.perguntas.filter((p) => p.naPesquisa || (editavel && todas));
            if (visiveis.length === 0) return null;
            return (
              <div key={d.nome}>
                <h4 className="text-micro font-semibold uppercase tracking-wider text-brand-700">{d.nome}</h4>
                <ul className="divide-y divide-slate-50">
                  {visiveis.map((p) => (
                    <LinhaDePergunta key={p.id} pesquisaId={pesquisa.id} p={p} editavel={editavel} />
                  ))}
                </ul>
              </div>
            );
          })}
          {editavel ? (
            <PerguntaPropria
              pesquisaId={pesquisa.id}
              dimensoes={dimensoes.filter((d): d is DimensaoParaMontar & { id: string } => d.id !== null).map((d) => ({ id: d.id, nome: d.nome }))}
            />
          ) : null}
        </div>
      </Painel>
    </div>
  );
}
