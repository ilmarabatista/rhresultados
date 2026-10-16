"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import {
  comentarNota,
  criarAvaliacao,
  criarPlano,
  excluirAvaliacao,
  incluirNaAvaliacao,
  marcarNota,
  mudarAvaliacao,
  tirarDaAvaliacao,
  type CampoDaAvaliacao,
  type CampoDaNota,
  type PdiState,
} from "@/app/(app)/empresas/[id]/pdi/actions";
import {
  comparar,
  divergencias,
  gap,
  gapsPrioritarios,
  NIVEIS,
  nivelFinal,
  resumoDaAvaliacao,
  ROTULO_DO_NIVEL,
  ROTULO_DO_TIPO,
  lerTipoDeCompetencia,
} from "@/lib/pdi";
import { Field, FormError, Input, SubmitButton, Textarea } from "./form";
import { Aviso, Etiqueta, Numeros } from "./ui";
import { avisar, confirmar } from "@/components/avisos";

/**
 * A avaliação de competências, feita junto com a pessoa: para cada competência
 * do cargo, como ela se vê, como o avaliador vê e o nível em que os dois
 * concordaram. O gap é o esperado menos o acordado. Cada clique grava.
 */

export type NotaDaTela = {
  id: string;
  nome: string;
  tipo: string;
  esperado: number;
  pessoa: number | null;
  avaliador: number | null;
  acordado: number | null;
  comentario: string;
};

export type AvaliacaoDaTela = {
  id: string;
  dia: string;
  data: string;
  cargoNome: string | null;
  pontosFortes: string;
  querDesenvolver: string;
  apoio: string;
  carreira: string;
  notas: NotaDaTela[];
  planos: number;
};

const COLUNAS: { campo: Exclude<CampoDaNota, "esperado">; rotulo: string; cor: string }[] = [
  { campo: "pessoa", rotulo: "Pessoa", cor: "bg-sky-500 text-white" },
  { campo: "avaliador", rotulo: "Avaliador", cor: "bg-violet-500 text-white" },
  { campo: "acordado", rotulo: "Acordado", cor: "bg-brand-700 text-white" },
];

const botaoClaro =
  "rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50 disabled:opacity-60";

function Escala({
  valor,
  esperado,
  cor,
  onEscolher,
  rotulo,
}: {
  valor: number | null;
  esperado: number;
  cor: string;
  onEscolher: (n: number | null) => void;
  rotulo: string;
}) {
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label={rotulo}>
      {NIVEIS.map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={valor === n}
          title={`${n} · ${ROTULO_DO_NIVEL[n]}`}
          onClick={() => onEscolher(valor === n ? null : n)}
          className={`h-6 w-6 rounded text-micro font-medium tabular-nums transition ${
            valor === n
              ? cor
              : n === esperado
                ? "border border-dashed border-brand-400 text-slate-500 hover:bg-slate-100"
                : "border border-slate-200 text-slate-500 hover:bg-slate-100"
          }`}
        >
          {n}
        </button>
      ))}
    </div>
  );
}

function Comentario({ nota }: { nota: NotaDaTela }) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState(nota.comentario);
  if (!aberto) {
    return (
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="block max-w-full truncate text-left text-micro text-slate-500 hover:text-brand-700"
      >
        {nota.comentario || "+ comentário"}
      </button>
    );
  }
  return (
    <textarea
      autoFocus
      value={texto}
      rows={2}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={async () => {
        setAberto(false);
        if (texto !== nota.comentario) {
          const r = await comentarNota(nota.id, texto);
          if (r.error) avisar(r.error);
        }
      }}
      placeholder="Exemplos, combinados, por que esta nota"
      className="w-full rounded-md border border-brand-300 px-2 py-1 text-mini outline-none focus-visible:ring-2 focus-visible:ring-brand-300"
    />
  );
}

function Grade({ avaliacao, anterior }: { avaliacao: AvaliacaoDaTela; anterior: AvaliacaoDaTela | null }) {
  const [notas, setNotas] = useState(avaliacao.notas);
  const [, startTransition] = useTransition();
  useEffect(() => setNotas(avaliacao.notas), [avaliacao.notas]);

  const antes = anterior ? new Map(comparar(anterior.notas, notas).map((c) => [c.nome, c])) : null;

  function marcar(nota: NotaDaTela, campo: CampoDaNota, valor: number | null) {
    setNotas((atual) => atual.map((n) => (n.id === nota.id ? { ...n, [campo]: valor } : n)));
    startTransition(async () => {
      const r = await marcarNota(nota.id, campo, valor);
      if (r.error) avisar(r.error);
    });
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <div className="min-w-[860px]">
        <div className="grid grid-cols-[minmax(0,1.6fr)_4.5rem_repeat(3,9.5rem)_4rem_minmax(0,1fr)_1.5rem] items-center gap-2 bg-brand-900 px-3 py-1.5 text-micro font-semibold uppercase tracking-wider text-white">
          <span>Competência</span>
          <span>Esperado</span>
          {COLUNAS.map((c) => (
            <span key={c.campo}>{c.rotulo}</span>
          ))}
          <span>Gap</span>
          <span>Comentário</span>
          <span />
        </div>
        {notas.map((n) => {
          const g = gap(n);
          const c = antes?.get(n.nome);
          return (
            <div
              key={n.id}
              className="grid grid-cols-[minmax(0,1.6fr)_4.5rem_repeat(3,9.5rem)_4rem_minmax(0,1fr)_1.5rem] items-center gap-2 border-b border-slate-100 px-3 py-1.5 last:border-b-0 even:bg-slate-50/60"
            >
              <div className="min-w-0">
                <span className="block truncate text-corpo font-medium text-slate-800" title={n.nome}>
                  {n.nome}
                </span>
                <span className="text-micro text-slate-500">
                  {ROTULO_DO_TIPO[lerTipoDeCompetencia(n.tipo)]}
                  {c && c.antes != null ? ` · antes: ${c.antes}` : ""}
                  {c && c.mudou ? (
                    <span className={c.mudou > 0 ? "text-emerald-700" : "text-red-700"}>
                      {" "}
                      ({c.mudou > 0 ? "+" : ""}
                      {c.mudou})
                    </span>
                  ) : null}
                </span>
              </div>
              <select
                value={n.esperado}
                onChange={(e) => marcar(n, "esperado", Number(e.target.value))}
                className="w-14 rounded border border-slate-200 bg-transparent px-1 py-0.5 text-mini font-semibold text-brand-800"
                aria-label="Nível esperado"
              >
                {NIVEIS.map((x) => (
                  <option key={x} value={x}>
                    {x}
                  </option>
                ))}
              </select>
              {COLUNAS.map((col) => (
                <Escala
                  key={col.campo}
                  rotulo={`${col.rotulo}: ${n.nome}`}
                  valor={n[col.campo]}
                  esperado={n.esperado}
                  cor={col.cor}
                  onEscolher={(v) => marcar(n, col.campo, v)}
                />
              ))}
              <span>
                {g == null ? (
                  <span className="text-micro text-slate-300">—</span>
                ) : g > 0 ? (
                  <Etiqueta tom={g >= 2 ? "ruim" : "atencao"}>−{g}</Etiqueta>
                ) : (
                  <Etiqueta tom="bom">{g === 0 ? "ok" : `+${-g}`}</Etiqueta>
                )}
              </span>
              <Comentario nota={n} />
              <button
                type="button"
                onClick={async () => {
                  if (await confirmar(`Tirar ${n.nome} desta avaliação?`)) {
                    setNotas((atual) => atual.filter((x) => x.id !== n.id));
                    startTransition(async () => void (await tirarDaAvaliacao(n.id)));
                  }
                }}
                className="text-slate-300 hover:text-red-600"
                aria-label="Tirar da avaliação"
              >
                <Trash2 size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** O gráfico dos gaps: a barra é onde a pessoa está, o traço é o que o cargo pede. */
function Grafico({ notas }: { notas: NotaDaTela[] }) {
  const avaliadas = notas.filter((n) => nivelFinal(n) != null);
  if (avaliadas.length === 0) return null;
  return (
    <div className="space-y-1.5">
      {avaliadas.map((n) => {
        const f = nivelFinal(n)!;
        const g = n.esperado - f;
        return (
          <div key={n.id} className="grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_2.5rem] items-center gap-2">
            <span className="truncate text-mini text-slate-600" title={n.nome}>
              {n.nome}
            </span>
            <div className="relative h-3 rounded-full bg-slate-100">
              <div
                className={`h-full rounded-full ${g > 0 ? (g >= 2 ? "bg-red-400" : "bg-amber-400") : "bg-emerald-500"}`}
                style={{ width: `${(f / 5) * 100}%` }}
              />
              <span
                className="absolute -top-0.5 h-4 w-0.5 rounded bg-brand-900"
                style={{ left: `calc(${(n.esperado / 5) * 100}% - 1px)` }}
                title={`Esperado: ${n.esperado}`}
              />
            </div>
            <span className="text-right text-micro tabular-nums text-slate-500">
              {f}/{n.esperado}
            </span>
          </div>
        );
      })}
      <p className="text-micro text-slate-500">A barra é o nível acordado; o traço escuro, o nível que o cargo pede.</p>
    </div>
  );
}

const PERGUNTAS: { campo: Exclude<CampoDaAvaliacao, "data">; rotulo: string; dica: string }[] = [
  { campo: "pontosFortes", rotulo: "Pontos fortes", dica: "O que a pessoa já faz bem e pode ensinar." },
  { campo: "querDesenvolver", rotulo: "O que a pessoa quer desenvolver", dica: "Nas palavras dela." },
  { campo: "apoio", rotulo: "Apoio de que precisa", dica: "Do líder, da empresa, de colegas." },
  { campo: "carreira", rotulo: "Aspirações de carreira", dica: "Onde quer estar em 1 a 2 anos." },
];

function Conversa({ avaliacao }: { avaliacao: AvaliacaoDaTela }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {PERGUNTAS.map((p) => (
        <Field key={p.campo} label={p.rotulo} hint={p.dica}>
          <Textarea
            rows={3}
            defaultValue={avaliacao[p.campo]}
            onBlur={async (e) => {
              if (e.target.value === avaliacao[p.campo]) return;
              const r = await mudarAvaliacao(avaliacao.id, p.campo, e.target.value);
              if (r.error) avisar(r.error);
            }}
          />
        </Field>
      ))}
    </div>
  );
}

function Incluir({ avaliacaoId }: { avaliacaoId: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome, setNome] = useState("");
  const [tipo, setTipo] = useState("TECNICA");
  const [esperado, setEsperado] = useState(3);
  const [pending, startTransition] = useTransition();
  if (!aberto) {
    return (
      <button type="button" onClick={() => setAberto(true)} className="text-xs text-brand-700 hover:text-brand-800">
        + Competência só nesta avaliação
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await incluirNaAvaliacao(avaliacaoId, nome, tipo, esperado);
          if (r.error) avisar(r.error);
          else {
            setNome("");
            setAberto(false);
          }
        });
      }}
      className="flex flex-wrap items-center gap-2"
    >
      <input
        autoFocus
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        placeholder="Competência"
        className="w-56 rounded-md border border-slate-300 px-2 py-1 text-sm"
      />
      <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="rounded-md border border-slate-300 px-2 py-1 text-sm">
        <option value="TECNICA">Técnica</option>
        <option value="COMPORTAMENTAL">Comportamental</option>
      </select>
      <select
        value={esperado}
        onChange={(e) => setEsperado(Number(e.target.value))}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        aria-label="Nível esperado"
      >
        {NIVEIS.map((n) => (
          <option key={n} value={n}>
            esperado {n}
          </option>
        ))}
      </select>
      <button type="submit" disabled={pending} className={botaoClaro}>
        Incluir
      </button>
      <button type="button" onClick={() => setAberto(false)} className="text-xs text-slate-500">
        cancelar
      </button>
    </form>
  );
}

function NovoPlano({
  employeeId,
  nome,
  avaliacao,
  hoje,
  onClose,
}: {
  employeeId: string;
  nome: string;
  avaliacao: AvaliacaoDaTela;
  hoje: string;
  onClose: () => void;
}) {
  const [state, action] = useActionState<PdiState, FormData>(criarPlano, {});
  const gaps = gapsPrioritarios(avaliacao.notas);
  const seisMeses = (() => {
    const d = new Date(`${hoje}T00:00:00Z`);
    d.setUTCMonth(d.getUTCMonth() + 6);
    return d.toISOString().slice(0, 10);
  })();

  useEffect(() => {
    if (state.ok) {
      onClose();
      document.getElementById("plano")?.scrollIntoView({ behavior: "smooth" });
    }
  }, [state.ok, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 backdrop-blur-sm">
      <form action={action} className="my-8 w-full max-w-xl space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Novo PDI</h3>
          <p className="text-xs text-slate-500">
            Cada gap marcado vira uma meta, já com a frase específica, o indicador e a relevância sugeridos. Depois é
            ajustar e incluir as ações.
          </p>
        </div>
        <input type="hidden" name="employeeId" value={employeeId} />
        <input type="hidden" name="avaliacaoId" value={avaliacao.id} />
        <Field label="Nome do plano *">
          <Input name="title" required defaultValue={`PDI ${nome.split(/\s+/)[0]} — ${hoje.slice(0, 4)}`} />
        </Field>
        <Field label="Objetivo geral" hint="Onde a pessoa quer chegar com este plano.">
          <Textarea name="objective" rows={2} defaultValue={avaliacao.carreira || avaliacao.querDesenvolver} />
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Início">
            <Input name="startDate" type="date" defaultValue={hoje} />
          </Field>
          <Field label="Fim" hint="O prazo das metas, se não mudar.">
            <Input name="endDate" type="date" defaultValue={seisMeses} />
          </Field>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-medium text-slate-700">Gaps que viram meta</legend>
          {gaps.length === 0 ? (
            <p className="text-xs text-slate-500">Nenhum gap nesta avaliação. O plano começa sem metas.</p>
          ) : (
            <ul className="space-y-1">
              {gaps.map((n, i) => (
                <li key={n.id}>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      name="notaIds"
                      value={n.id}
                      defaultChecked={i < 3}
                      className="h-4 w-4 rounded border-slate-300 accent-brand-600"
                    />
                    {n.nome}
                    <Etiqueta tom={(gap(n) ?? 0) >= 2 ? "ruim" : "atencao"}>
                      {nivelFinal(n)} → {n.esperado}
                    </Etiqueta>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {gaps.length > 3 ? (
            <p className="mt-1 text-micro text-slate-500">Dica: de 2 a 4 metas por plano. Mais que isso dispersa.</p>
          ) : null}
        </fieldset>
        <FormError message={state.error} />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={botaoClaro}>
            Cancelar
          </button>
          <SubmitButton pendingLabel="Criando…">Criar PDI</SubmitButton>
        </div>
      </form>
    </div>
  );
}

export default function PdiAvaliacao({
  companyId,
  employeeId,
  nome,
  temCargo,
  cargoDescrito,
  avaliacoes,
  escolhida,
  temPlanoAtivo,
  hoje,
}: {
  companyId: string;
  employeeId: string;
  nome: string;
  temCargo: boolean;
  cargoDescrito: boolean;
  avaliacoes: AvaliacaoDaTela[];
  escolhida: string | null;
  temPlanoAtivo: boolean;
  hoje: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dia, setDia] = useState(hoje);
  const [criandoPlano, setCriandoPlano] = useState(false);

  const i = Math.max(0, avaliacoes.findIndex((a) => a.id === escolhida));
  const avaliacao = avaliacoes[i] ?? null;
  const anterior = avaliacoes[i + 1] ?? null;
  const resumo = avaliacao ? resumoDaAvaliacao(avaliacao.notas) : null;
  const divergentes = avaliacao ? divergencias(avaliacao.notas) : [];
  const semAcordo = avaliacao ? avaliacao.notas.filter((n) => n.acordado == null).length : 0;

  const nova = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const r = await criarAvaliacao(employeeId, dia);
          if (r.error) avisar(r.error);
          else router.push(`?avaliacao=${r.id}#avaliacao`);
        });
      }}
      className="flex items-center gap-1.5"
    >
      <input
        type="date"
        value={dia}
        onChange={(e) => setDia(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        aria-label="Dia da avaliação"
      />
      <button type="submit" disabled={pending || !temCargo || !cargoDescrito} className={botaoClaro}>
        {avaliacoes.length ? "Nova avaliação" : "Começar avaliação"}
      </button>
    </form>
  );

  return (
    <section id="avaliacao" className={`rounded-lg border border-slate-200 bg-white p-4 ${pending ? "opacity-60" : ""}`}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">
            <span className="mr-1.5 text-brand-600">2</span>Avaliação dos gaps
          </h2>
          <p className="mt-0.5 max-w-2xl text-xs text-slate-500">
            Feita junto com a pessoa. Primeiro ela dá a nota dela, depois você dá a sua, e conversando chegam ao nível
            acordado — é ele que define o gap. O tracejado marca o nível que o cargo pede.
          </p>
        </div>
        {nova}
      </div>

      {!temCargo ? (
        <Aviso rotulo="Falta o cargo">
          A pessoa está sem cargo. Escolha o cargo no cadastro dela (ficha da pessoa, Editar cadastro).
        </Aviso>
      ) : !cargoDescrito ? (
        <Aviso rotulo="Falta a descrição do cargo">
          O cargo ainda não tem competências. Descreva o cargo no passo 1 para poder avaliar.
        </Aviso>
      ) : null}

      {avaliacao ? (
        <div className="space-y-3">
          {avaliacoes.length > 1 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-micro font-medium uppercase tracking-wider text-slate-500">Avaliações</span>
              {avaliacoes.map((a, j) => (
                <Link
                  key={a.id}
                  href={`?avaliacao=${a.id}#avaliacao`}
                  scroll={false}
                  className={`rounded-full border px-2.5 py-0.5 text-xs ${
                    j === i ? "border-brand-700 bg-brand-700 text-white" : "border-slate-200 text-slate-600 hover:border-brand-300"
                  }`}
                >
                  {a.data}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
            <label className="flex items-center gap-1.5">
              Dia
              <input
                type="date"
                defaultValue={avaliacao.dia}
                key={avaliacao.id}
                onBlur={async (e) => {
                  if (e.target.value === avaliacao.dia) return;
                  const r = await mudarAvaliacao(avaliacao.id, "data", e.target.value);
                  if (r.error) avisar(r.error);
                }}
                className="rounded border border-slate-200 px-1.5 py-0.5"
              />
            </label>
            {avaliacao.cargoNome ? <span>· cargo na época: {avaliacao.cargoNome}</span> : null}
            {anterior ? <span>· comparando com {anterior.data}</span> : null}
            <button
              type="button"
              onClick={async () => {
                const aviso = avaliacao.planos
                  ? "Excluir esta avaliação? O PDI que saiu dela continua, mas perde o vínculo com os gaps."
                  : "Excluir esta avaliação?";
                if (await confirmar(aviso))
                  startTransition(async () => {
                    await excluirAvaliacao(avaliacao.id);
                    router.push(`/empresas/${companyId}/pdi/${employeeId}#avaliacao`);
                  });
              }}
              className="ml-auto text-slate-500 hover:text-red-600"
            >
              Excluir avaliação
            </button>
          </div>

          {resumo ? (
            <Numeros
              colunas={4}
              itens={[
                { rotulo: "Competências", valor: resumo.competencias, detalhe: `${resumo.avaliadas} com nota` },
                {
                  rotulo: "Gaps",
                  valor: resumo.comGap,
                  tom: resumo.comGap > 0 ? "atencao" : "bom",
                  detalhe: "abaixo do esperado",
                },
                {
                  rotulo: "Aderência ao cargo",
                  valor: resumo.aderencia == null ? "—" : `${resumo.aderencia}%`,
                  tom: resumo.aderencia == null ? "neutro" : resumo.aderencia >= 85 ? "bom" : "atencao",
                  detalhe: "do nível que o cargo pede",
                },
                {
                  rotulo: "Sem acordo",
                  valor: semAcordo,
                  tom: semAcordo > 0 ? "atencao" : "bom",
                  detalhe: "competências sem nível acordado",
                },
              ]}
            />
          ) : null}

          {divergentes.length > 0 ? (
            <Aviso rotulo="Vale conversar" tom="informacao">
              A pessoa e o avaliador estão a 2 níveis ou mais de distância em: {divergentes.map((n) => n.nome).join(", ")}.
              Peça exemplos concretos antes de acordar a nota.
            </Aviso>
          ) : null}

          <Grade avaliacao={avaliacao} anterior={anterior} />
          <Incluir avaliacaoId={avaliacao.id} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Mapa dos gaps</h3>
              <Grafico notas={avaliacao.notas} />
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">A conversa</h3>
              <Conversa key={avaliacao.id} avaliacao={avaliacao} />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 pt-3">
            {temPlanoAtivo ? (
              <span className="text-xs text-slate-500">
                Já existe um PDI em andamento. Para incluir um gap nele, crie uma meta no passo 3.
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => setCriandoPlano(true)}
              className="rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
            >
              {temPlanoAtivo ? "Criar outro PDI com estes gaps" : "Montar o PDI com estes gaps →"}
            </button>
          </div>
        </div>
      ) : temCargo && cargoDescrito ? (
        <p className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
          Nenhuma avaliação ainda. Escolha o dia da conversa e clique em Começar avaliação: as competências do cargo
          entram na grade.
        </p>
      ) : null}

      {criandoPlano && avaliacao ? (
        <NovoPlano employeeId={employeeId} nome={nome} avaliacao={avaliacao} hoje={hoje} onClose={() => setCriandoPlano(false)} />
      ) : null}
    </section>
  );
}
