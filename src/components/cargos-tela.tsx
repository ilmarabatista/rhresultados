"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Printer, Sparkles, Trash2 } from "lucide-react";
import {
  aprovarDescricao,
  enviarQuestionario,
  excluirQuestionario,
  gerarDescricao,
  mudarNivel,
  reabrirQuestionario,
  salvarDescricao,
  salvarPerguntas,
  sugerirPerguntasDoCargo,
  type CargoState,
} from "@/app/(app)/empresas/[id]/cargos/actions";
import { criarCargo, excluirCargo, renomearCargo } from "@/app/(app)/empresas/[id]/treinamentos/actions";
import {
  CAMPOS_DA_ESPECIFICACAO,
  NIVEIS_DE_CARGO,
  questionarioDoNivel,
  respostaEmTexto,
  ROTULO_DO_NIVEL_DE_CARGO,
  type Especificacao,
  type NivelDeCargo,
  type Respostas,
} from "@/lib/cargos";
import CargoCompetencias, { type Competencia } from "./cargo-competencias";
import { Field, FormError, FormOk, Input, Select, SubmitButton, Textarea } from "./form";
import { Etiqueta, Vazio } from "./ui";
import { avisar, confirmar } from "@/components/avisos";
import { linkPublico } from "@/lib/link-publico";
import { lembreteDoLink } from "@/lib/cobranca";
import CobrarTodos from "./cobrar-todos";

/**
 * A aba Cargos: a lista à esquerda e, à direita, o cargo escolhido em quatro
 * abas — a descrição, os questionários mandados, o roteiro de entrevista e
 * quem está no cargo.
 */

export type AbaDoCargo = "descricao" | "questionarios" | "entrevista" | "pessoas";

type Situacao = "VAZIA" | "RASCUNHO" | "APROVADA" | "REVISAR";

type CargoNaLista = {
  id: string;
  nome: string;
  nivel: NivelDeCargo | null;
  pessoas: number;
  respondidos: number;
  situacao: Situacao;
  aprovadaEm: string | null;
  competencias: Competencia[];
};

type Questionario = {
  id: string;
  token: string;
  pessoa: string;
  nivel: NivelDeCargo;
  status: "ENVIADO" | "RESPONDIDO";
  enviadoEm: string;
  prazo: string | null;
  atrasado: boolean;
  respondidoEm: string | null;
  respostas: Respostas;
};

type Detalhe = {
  id: string;
  setor: string;
  cbo: string;
  superior: string;
  subordinados: string;
  missao: string;
  responsabilidades: string;
  requisitos: string;
  especificacao: Especificacao;
  perguntas: string[];
  questionarios: Questionario[];
  colaboradores: { id: string; nome: string }[];
  vagas: { id: string; titulo: string; status: string; aberta: string }[];
};

const ABAS: { slug: AbaDoCargo; rotulo: string }[] = [
  { slug: "descricao", rotulo: "Descrição" },
  { slug: "questionarios", rotulo: "Questionários" },
  { slug: "entrevista", rotulo: "Entrevista" },
  { slug: "pessoas", rotulo: "Pessoas e vagas" },
];

const SITUACAO: Record<Situacao, { texto: string; tom: "neutro" | "azul" | "bom" | "atencao" }> = {
  VAZIA: { texto: "sem descrição", tom: "neutro" },
  RASCUNHO: { texto: "rascunho", tom: "azul" },
  APROVADA: { texto: "aprovada", tom: "bom" },
  REVISAR: { texto: "revisar", tom: "atencao" },
};

const botaoClaro =
  "inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function linkDoQuestionario(token: string) {
  return linkPublico(`/questionario/${token}`);
}

async function copiar(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
    avisar("Link copiado.");
  } catch {
    avisar(texto);
  }
}

// ---------------------------------------------------------------- descrição

function Descricao({
  cargo,
  detalhe,
  outros,
  temValores,
  companyId,
}: {
  cargo: CargoNaLista;
  detalhe: Detalhe;
  outros: CargoNaLista[];
  temValores: boolean;
  companyId: string;
}) {
  const [state, action] = useActionState<CargoState, FormData>(salvarDescricao, {});
  const [pending, startTransition] = useTransition();
  const temEspecificacao = Object.keys(detalhe.especificacao).length > 0;

  const gerar = () =>
    startTransition(async () => {
      const jaTem = detalhe.missao || detalhe.responsabilidades;
      if (jaTem && !(await confirmar("Gerar de novo troca a missão, as responsabilidades e as condições pelo rascunho da IA. As competências atuais ficam. Continuar?")))
        return;
      const r = await gerarDescricao(cargo.id);
      avisar(r.error ?? "Rascunho pronto. Revise e aprove quando estiver bom.");
    });

  const aprovar = () =>
    startTransition(async () => {
      const r = await aprovarDescricao(cargo.id);
      if (r.error) avisar(r.error);
    });

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-sm text-slate-600">
          {cargo.situacao === "APROVADA"
            ? `Aprovada em ${cargo.aprovadaEm}.`
            : cargo.situacao === "REVISAR"
              ? `Aprovada em ${cargo.aprovadaEm}: passou de um ano, vale revisar.`
              : cargo.respondidos > 0
                ? `${cargo.respondidos} questionário(s) respondido(s). Gere o rascunho e revise.`
                : "Mande o questionário para quem ocupa o cargo, ou escreva a descrição aqui."}
        </p>
        <div className="flex flex-wrap gap-2">
          {cargo.respondidos > 0 ? (
            <Link href={`/empresas/${companyId}/cargos?cargo=${cargo.id}&aba=questionarios`} className={botaoClaro}>
              Ver respostas
            </Link>
          ) : null}
          {cargo.respondidos > 0 ? (
            <button type="button" onClick={gerar} disabled={pending} className={botaoClaro}>
              <Sparkles size={14} /> {pending ? "Gerando…" : "Gerar com IA"}
            </button>
          ) : null}
          <button type="button" onClick={aprovar} disabled={pending} className={botaoClaro}>
            {cargo.situacao === "APROVADA" ? "Aprovar de novo" : "Aprovar descrição"}
          </button>
          <Link href={`/empresas/${companyId}/cargos/${cargo.id}/imprimir`} className={botaoClaro}>
            <Printer size={14} /> Imprimir
          </Link>
        </div>
      </div>

      <form action={action} key={`${detalhe.id}-${detalhe.missao.length}-${detalhe.responsabilidades.length}`} className="space-y-3">
        <input type="hidden" name="cargoId" value={cargo.id} />
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">Identificação</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Setor">
              <Input name="setor" defaultValue={detalhe.setor} />
            </Field>
            <Field label="CBO" hint="Classificação Brasileira de Ocupações, quando se aplica.">
              <Input name="cbo" defaultValue={detalhe.cbo} placeholder="0000-00" />
            </Field>
            <Field label="Reporta-se a">
              <Input name="superior" defaultValue={detalhe.superior} />
            </Field>
            <Field label="Cargos subordinados">
              <Input name="subordinados" defaultValue={detalhe.subordinados} />
            </Field>
          </div>
        </section>

        <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
          <Field label="Missão do cargo" hint="Para que o cargo existe, em uma ou duas frases.">
            <Textarea name="missao" rows={2} defaultValue={detalhe.missao} />
          </Field>
          <Field
            label="Responsabilidades"
            hint="Uma por parágrafo, das mais frequentes e importantes para as menores. Cada uma num texto corrido: o que faz, como faz, por que faz e quando faz."
          >
            <Textarea name="responsabilidades" rows={8} defaultValue={detalhe.responsabilidades} />
          </Field>
          <Field label="Requisitos" hint="Formação mínima, cursos e experiência mínima.">
            <Textarea name="requisitos" rows={3} defaultValue={detalhe.requisitos} />
          </Field>
        </section>

        <details open={temEspecificacao} className="rounded-lg border border-slate-200 bg-white p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-900">Condições do cargo</summary>
          <p className="mb-3 mt-1 text-xs text-slate-500">Só aparecem na descrição as que estiverem preenchidas.</p>
          <div className="grid gap-3 md:grid-cols-2">
            {CAMPOS_DA_ESPECIFICACAO.map(({ chave, rotulo }) => (
              <Field key={chave} label={rotulo}>
                <Textarea name={`esp_${chave}`} rows={2} defaultValue={detalhe.especificacao[chave] ?? ""} />
              </Field>
            ))}
          </div>
        </details>

        <FormError message={state.error} />
        {state.ok ? <FormOk message="Descrição salva." /> : null}
        <div className="flex justify-end">
          <SubmitButton>Salvar descrição</SubmitButton>
        </div>
      </form>

      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">Competências do cargo</h3>
        <p className="mb-3 mt-0.5 text-xs text-slate-500">
          Técnicas, comportamentais e organizacionais. Adicione quantas quiser: a entrevista do cargo usa todas.
          {temValores ? null : (
            <>
              {" "}
              Para as organizacionais,{" "}
              <Link href={`/empresas/${companyId}/dados`} className="text-brand-700 underline">
                cadastre os valores da empresa
              </Link>
              .
            </>
          )}
        </p>
        <CargoCompetencias cargo={cargo} outros={outros} />
      </section>
    </div>
  );
}

// ------------------------------------------------------------ questionários

function NovoQuestionario({ cargo }: { cargo: CargoNaLista }) {
  const [state, action] = useActionState<CargoState, FormData>(enviarQuestionario, {});
  const [link, setLink] = useState("");

  useEffect(() => {
    if (state.ok && state.token) setLink(linkDoQuestionario(state.token));
  }, [state]);

  if (!cargo.nivel) {
    return (
      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Escolha o nível do cargo, no alto, para saber qual questionário mandar.
      </p>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <input type="hidden" name="cargoId" value={cargo.id} />
      <p className="text-sm text-slate-600">
        Questionário <strong>{ROTULO_DO_NIVEL_DE_CARGO[cargo.nivel].toLowerCase()}</strong>. Gere um link para cada pessoa
        que vai responder: quem ocupa o cargo e, se quiser, o gestor.
      </p>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Quem vai responder">
          <Input name="pessoa" required placeholder="Nome" />
        </Field>
        <Field label="Responder até">
          <Input name="prazo" type="date" />
        </Field>
        <SubmitButton pendingLabel="Gerando…">Gerar link</SubmitButton>
      </div>
      <FormError message={state.error} />
      {link ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          <span className="min-w-0 flex-1 truncate">{link}</span>
          <button type="button" onClick={() => copiar(link)} className={botaoClaro}>
            <Copy size={14} /> Copiar link
          </button>
        </div>
      ) : null}
    </form>
  );
}

function Respondido({ q }: { q: Questionario }) {
  return (
    <div className="space-y-3 border-t border-slate-100 px-3 py-3">
      {questionarioDoNivel(q.nivel).map((s) => (
        <div key={s.titulo}>
          <h4 className="mb-1 text-micro font-medium uppercase tracking-wider text-slate-500">{s.titulo}</h4>
          <dl className="space-y-2">
            {s.perguntas.map((p) => (
              <div key={p.id}>
                <dt className="text-xs font-medium text-slate-700">{p.titulo}</dt>
                <dd className="whitespace-pre-line text-sm text-slate-600">{respostaEmTexto(p, q.respostas[p.id])}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function Questionarios({ cargo, detalhe }: { cargo: CargoNaLista; detalhe: Detalhe }) {
  const [aberto, setAberto] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const fazer = (acao: () => Promise<CargoState>) =>
    startTransition(async () => {
      const r = await acao();
      if (r.error) avisar(r.error);
    });

  return (
    <div className="space-y-3.5">
      <NovoQuestionario cargo={cargo} />
      <CobrarTodos
        pessoas={detalhe.questionarios
          .filter((q) => q.status !== "RESPONDIDO")
          .map((q) => ({
            id: q.id,
            nome: q.pessoa,
            telefone: null,
            mensagem: lembreteDoLink(q.pessoa, `o questionário do cargo ${cargo.nome}`, linkDoQuestionario(q.token)),
          }))}
      />
      {detalhe.questionarios.length === 0 ? (
        <Vazio>Nenhum questionário mandado ainda.</Vazio>
      ) : (
        <ul className={`divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white ${pending ? "opacity-60" : ""}`}>
          {detalhe.questionarios.map((q) => (
            <li key={q.id}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2">
                <div className="min-w-[12rem] flex-1">
                  <span className="text-sm font-medium text-slate-800">{q.pessoa}</span>
                  <span className="block text-micro text-slate-500">
                    {ROTULO_DO_NIVEL_DE_CARGO[q.nivel]} · enviado em {q.enviadoEm}
                    {q.prazo ? ` · prazo ${q.prazo}` : ""}
                    {q.respondidoEm ? ` · respondido em ${q.respondidoEm}` : ""}
                  </span>
                </div>
                {q.status === "RESPONDIDO" ? (
                  <Etiqueta tom="bom">respondido</Etiqueta>
                ) : q.atrasado ? (
                  <Etiqueta tom="atencao">prazo vencido</Etiqueta>
                ) : (
                  <Etiqueta tom="azul">aguardando</Etiqueta>
                )}
                <div className="flex items-center gap-1.5">
                  {q.status === "RESPONDIDO" ? (
                    <>
                      <button type="button" className={botaoClaro} onClick={() => setAberto(aberto === q.id ? null : q.id)}>
                        {aberto === q.id ? "Fechar" : "Ver respostas"}
                      </button>
                      <button
                        type="button"
                        className={botaoClaro}
                        onClick={async () => {
                          if (await confirmar(`Reabrir o link para ${q.pessoa} corrigir as respostas?`))
                            fazer(() => reabrirQuestionario(q.id));
                        }}
                      >
                        Reabrir
                      </button>
                    </>
                  ) : (
                    <button type="button" className={botaoClaro} onClick={() => copiar(linkDoQuestionario(q.token))}>
                      <Copy size={14} /> Copiar link
                    </button>
                  )}
                  <button
                    type="button"
                    className="p-1 text-slate-400 hover:text-red-600"
                    aria-label={`Excluir o questionário de ${q.pessoa}`}
                    onClick={async () => {
                      if (await confirmar(`Excluir o questionário de ${q.pessoa}? As respostas somem.`))
                        fazer(() => excluirQuestionario(q.id));
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              {aberto === q.id ? <Respondido q={q} /> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- entrevista

function Entrevista({ cargo, detalhe }: { cargo: CargoNaLista; detalhe: Detalhe }) {
  const [texto, setTexto] = useState(detalhe.perguntas.join("\n"));
  const [sugeridas, setSugeridas] = useState<{ pergunta: string; usar: boolean }[]>([]);
  const [salvo, setSalvo] = useState(false);
  const [pending, startTransition] = useTransition();
  const quantas = texto.split(/\r?\n/).filter((l) => l.trim()).length;

  const sugerir = () =>
    startTransition(async () => {
      const r = await sugerirPerguntasDoCargo(cargo.id);
      if (r.error) avisar(r.error);
      else setSugeridas((r.perguntas ?? []).map((pergunta) => ({ pergunta, usar: true })));
    });

  const salvar = () =>
    startTransition(async () => {
      const r = await salvarPerguntas(cargo.id, texto);
      if (r.error) avisar(r.error);
      else setSalvo(true);
    });

  return (
    <div className="space-y-3.5">
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Roteiro de entrevista</h3>
            <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
              Uma pergunta por linha. Ao abrir uma vaga para este cargo, o roteiro vai para a vaga, onde a IA organiza a
              transcrição da entrevista nestas perguntas. Mudar aqui não mexe nas vagas já abertas.
            </p>
          </div>
          <button type="button" onClick={sugerir} disabled={pending} className={botaoClaro}>
            <Sparkles size={14} /> {pending ? "Pensando…" : "Sugerir com IA"}
          </button>
        </div>

        {sugeridas.length > 0 ? (
          <div className="rounded-lg border border-brand-200 bg-brand-50/40 p-3">
            <p className="mb-2 text-xs font-medium text-slate-700">Sugestões a partir da descrição. Desmarque as que não quer.</p>
            <ul className="space-y-1">
              {sugeridas.map((s, i) => (
                <li key={i}>
                  <label className="flex items-start gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={s.usar}
                      onChange={(e) => setSugeridas((atual) => atual.map((x, n) => (n === i ? { ...x, usar: e.target.checked } : x)))}
                    />
                    {s.pergunta}
                  </label>
                </li>
              ))}
            </ul>
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" className={botaoClaro} onClick={() => setSugeridas([])}>
                Descartar
              </button>
              <button
                type="button"
                className={botaoClaro}
                onClick={() => {
                  const novas = sugeridas.filter((s) => s.usar).map((s) => s.pergunta);
                  setTexto((atual) => [atual.trim(), ...novas].filter(Boolean).join("\n"));
                  setSugeridas([]);
                  setSalvo(false);
                }}
              >
                Acrescentar ao roteiro
              </button>
            </div>
          </div>
        ) : null}

        <Textarea
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setSalvo(false);
          }}
          rows={Math.min(24, Math.max(8, quantas + 2))}
          placeholder={"Conte uma situação em que você...\nComo você organiza..."}
        />
        <div className="flex items-center justify-end gap-3">
          <span className="text-xs text-slate-500">{salvo ? "Roteiro salvo." : `${quantas} pergunta(s)`}</span>
          <button
            type="button"
            onClick={salvar}
            disabled={pending}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            Salvar roteiro
          </button>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------- pessoas e vagas

const ROTULO_DA_VAGA: Record<string, string> = { ABERTA: "aberta", PAUSADA: "pausada", ENCERRADA: "encerrada" };

function Pessoas({ companyId, detalhe }: { companyId: string; detalhe: Detalhe }) {
  return (
    <div className="grid gap-3.5 md:grid-cols-2">
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Quem está no cargo</h3>
        {detalhe.colaboradores.length === 0 ? (
          <p className="text-sm text-slate-500">Ninguém da equipe neste cargo.</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detalhe.colaboradores.map((p) => (
              <li key={p.id}>
                <Link href={`/empresas/${companyId}/equipe/${p.id}`} className="text-slate-700 hover:text-brand-700">
                  {p.nome}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="mb-2 text-sm font-semibold text-slate-900">Vagas para o cargo</h3>
        {detalhe.vagas.length === 0 ? (
          <p className="text-sm text-slate-500">
            Nenhuma vaga ainda. Ao abrir uma vaga na{" "}
            <Link href={`/empresas/${companyId}/selecao`} className="text-brand-700 underline">
              Seleção
            </Link>
            , escolha este cargo para levar o roteiro de entrevista.
          </p>
        ) : (
          <ul className="space-y-1 text-sm">
            {detalhe.vagas.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-2">
                <Link href={`/selecao/${v.id}`} className="truncate text-slate-700 hover:text-brand-700">
                  {v.titulo}
                </Link>
                <span className="shrink-0 text-micro text-slate-500">
                  {ROTULO_DA_VAGA[v.status] ?? v.status} · {v.aberta}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

// ------------------------------------------------------------------- a tela

function Cabecalho({ cargo, companyId }: { cargo: CargoNaLista; companyId: string }) {
  const router = useRouter();
  const [nome, setNome] = useState(cargo.nome);
  const [pending, startTransition] = useTransition();

  const renomear = () => {
    if (nome.trim() === cargo.nome) return;
    startTransition(async () => {
      const r = await renomearCargo(cargo.id, nome);
      if (r.error) {
        avisar(r.error);
        setNome(cargo.nome);
      }
    });
  };

  return (
    <div className={`flex flex-wrap items-center gap-2 ${pending ? "opacity-60" : ""}`}>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        onBlur={renomear}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        aria-label="Nome do cargo"
        className="min-w-0 flex-1 rounded-md border border-transparent px-1 py-0.5 text-base font-semibold text-slate-900 outline-none hover:border-slate-200 focus:border-brand-500"
      />
      <Select
        value={cargo.nivel ?? ""}
        onChange={(e) =>
          startTransition(async () => {
            const r = await mudarNivel(cargo.id, e.target.value);
            if (r.error) avisar(r.error);
          })
        }
        aria-label="Nível do cargo"
        className="!w-auto"
      >
        {cargo.nivel ? null : <option value="">Escolha o nível…</option>}
        {NIVEIS_DE_CARGO.map((n) => (
          <option key={n} value={n}>
            {ROTULO_DO_NIVEL_DE_CARGO[n]}
          </option>
        ))}
      </Select>
      <span className="text-xs text-slate-500">{cargo.pessoas} pessoa(s)</span>
      <button
        type="button"
        className="p-1 text-slate-400 hover:text-red-600"
        aria-label="Excluir o cargo"
        onClick={async () => {
          const aviso =
            cargo.pessoas > 0
              ? `Excluir o cargo ${cargo.nome}? ${cargo.pessoas} pessoa(s) ficam sem cargo, e a descrição, os questionários e o roteiro somem.`
              : `Excluir o cargo ${cargo.nome}, com a descrição, os questionários e o roteiro?`;
          if (!(await confirmar(aviso))) return;
          startTransition(async () => {
            const r = await excluirCargo(cargo.id);
            if (r.error) avisar(r.error);
            else router.push(`/empresas/${companyId}/cargos`);
          });
        }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function NovoCargo({ companyId }: { companyId: string }) {
  const router = useRouter();
  const [nome, setNome] = useState("");
  const [nivel, setNivel] = useState<string>("");
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!nivel) {
          avisar("Escolha o nível do cargo.");
          return;
        }
        startTransition(async () => {
          const r = await criarCargo(companyId, nome, nivel);
          if (r.error) avisar(r.error);
          else {
            setNome("");
            router.push(`/empresas/${companyId}/cargos?cargo=${r.id}`);
          }
        });
      }}
      className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-2"
    >
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Novo cargo"
        className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-brand-500"
      />
      <div className="flex gap-1.5">
        <select
          value={nivel}
          onChange={(e) => setNivel(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-slate-300 px-1.5 py-1 text-sm"
          aria-label="Nível do novo cargo"
        >
          <option value="">Nível…</option>
          {NIVEIS_DE_CARGO.map((n) => (
            <option key={n} value={n}>
              {ROTULO_DO_NIVEL_DE_CARGO[n]}
            </option>
          ))}
        </select>
        <button type="submit" disabled={pending} className={botaoClaro}>
          Criar
        </button>
      </div>
    </form>
  );
}

export default function CargosTela({
  companyId,
  aba,
  cargos,
  detalhe,
  temValores,
}: {
  companyId: string;
  aba: AbaDoCargo;
  cargos: CargoNaLista[];
  detalhe: Detalhe | null;
  temValores: boolean;
}) {
  const cargo = detalhe ? cargos.find((c) => c.id === detalhe.id) ?? null : null;
  const base = `/empresas/${companyId}/cargos`;

  return (
    <div className="grid gap-3.5 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="space-y-2">
        <nav className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {cargos.map((c) => (
            <Link
              key={c.id}
              href={`${base}?cargo=${c.id}${aba !== "descricao" ? `&aba=${aba}` : ""}`}
              className={`block border-l-2 px-2.5 py-1.5 transition ${
                cargo?.id === c.id ? "border-brand-600 bg-brand-50/60" : "border-transparent hover:bg-slate-50"
              }`}
            >
              <span className={`block truncate text-mini ${cargo?.id === c.id ? "font-semibold text-brand-800" : "text-slate-700"}`}>
                {c.nome}
              </span>
              <span className="mt-0.5 flex items-center gap-1.5 text-micro text-slate-500">
                {c.nivel ? ROTULO_DO_NIVEL_DE_CARGO[c.nivel] : <span className="text-amber-700">sem nível</span>}
                <Etiqueta tom={SITUACAO[c.situacao].tom}>{SITUACAO[c.situacao].texto}</Etiqueta>
                {c.respondidos > 0 ? <Etiqueta tom="bom">{c.respondidos === 1 ? "1 respondido" : `${c.respondidos} respondidos`}</Etiqueta> : null}
              </span>
            </Link>
          ))}
          {cargos.length === 0 ? <p className="px-3 py-2 text-sm text-slate-500">Nenhum cargo ainda.</p> : null}
        </nav>
        <NovoCargo companyId={companyId} />
      </aside>

      {cargo && detalhe ? (
        <div key={cargo.id} className="min-w-0 space-y-3">
          <Cabecalho cargo={cargo} companyId={companyId} />
          <nav className="flex flex-wrap gap-1 border-b border-slate-200">
            {ABAS.map((a) => (
              <Link
                key={a.slug}
                href={`${base}?cargo=${cargo.id}&aba=${a.slug}`}
                className={`-mb-px border-b-2 px-3 py-2 text-sm transition ${
                  aba === a.slug ? "border-brand-600 font-semibold text-brand-800" : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                {a.rotulo}
                {a.slug === "questionarios" && detalhe.questionarios.length > 0 ? (
                  <span className="ml-1.5 text-micro text-slate-500">{detalhe.questionarios.length}</span>
                ) : null}
                {a.slug === "entrevista" && detalhe.perguntas.length > 0 ? (
                  <span className="ml-1.5 text-micro text-slate-500">{detalhe.perguntas.length}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          {aba === "descricao" ? (
            <Descricao
              cargo={cargo}
              detalhe={detalhe}
              outros={cargos.filter((c) => c.id !== cargo.id)}
              temValores={temValores}
              companyId={companyId}
            />
          ) : aba === "questionarios" ? (
            <Questionarios cargo={cargo} detalhe={detalhe} />
          ) : aba === "entrevista" ? (
            <Entrevista cargo={cargo} detalhe={detalhe} />
          ) : (
            <Pessoas companyId={companyId} detalhe={detalhe} />
          )}
        </div>
      ) : (
        <Vazio>Crie o primeiro cargo ao lado, escolhendo o nível: gerencial, técnico-administrativo ou operacional.</Vazio>
      )}
    </div>
  );
}
