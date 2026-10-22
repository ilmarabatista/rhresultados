"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { enviarQuestionario, guardarRascunho } from "@/app/questionario/[token]/actions";
import {
  NAO_SE_APLICA,
  totalDeExperiencia,
  type Duracao,
  type Experiencia,
  type Marcadas,
  type Pergunta,
  type Resposta,
  type Respostas,
  type Secao,
  type Tarefa,
} from "@/lib/cargos";

/**
 * O questionário de cargo no link. Cada mudança é guardada sozinha depois de
 * uma pausa curta: a pessoa pode fechar e voltar pelo mesmo link. As tarefas
 * entram uma por campo, só com o que a pessoa faz.
 */

const campo =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-100";
const botaoClaro =
  "inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50";

function Texto({ p, valor, mudar }: { p: Extract<Pergunta, { tipo: "texto" }>; valor: string; mudar: (v: string) => void }) {
  const naoSeAplica = valor === NAO_SE_APLICA;
  return (
    <div>
      {p.curta ? (
        <input value={valor} onChange={(e) => mudar(e.target.value)} className={campo} disabled={naoSeAplica} />
      ) : (
        <textarea value={valor} onChange={(e) => mudar(e.target.value)} rows={3} className={campo} disabled={naoSeAplica} />
      )}
      <label className="mt-1 inline-flex items-center gap-1.5 text-xs text-slate-500">
        <input type="checkbox" checked={naoSeAplica} onChange={(e) => mudar(e.target.checked ? NAO_SE_APLICA : "")} />
        Não se aplica ao cargo
      </label>
    </div>
  );
}

function Tarefas({ valor, mudar }: { valor: Tarefa[]; mudar: (v: Tarefa[]) => void }) {
  const lista = valor.length ? valor : [""];
  return (
    <div className="space-y-2">
      {lista.map((t, i) => (
        <div key={i} className="flex items-start gap-2">
          <span className="w-5 shrink-0 pt-2 text-right text-xs text-slate-400">{i + 1}</span>
          <textarea
            value={t}
            onChange={(e) => mudar(lista.map((x, n) => (n === i ? e.target.value : x)))}
            rows={2}
            placeholder="Ex.: Recebe os pagamentos dos clientes no caixa"
            className={campo}
            aria-label={`Tarefa ${i + 1}`}
          />
          {lista.length > 1 ? (
            <button
              type="button"
              onClick={() => mudar(lista.filter((_, n) => n !== i))}
              className="pt-2 text-slate-400 hover:text-red-600"
              aria-label={`Tirar a tarefa ${i + 1}`}
            >
              <Trash2 size={14} />
            </button>
          ) : null}
        </div>
      ))}
      <button type="button" onClick={() => mudar([...lista, ""])} className={botaoClaro}>
        <Plus size={14} /> Outra tarefa
      </button>
    </div>
  );
}

function Marcar({
  p,
  valor,
  mudar,
}: {
  p: Extract<Pergunta, { tipo: "marcar" }>;
  valor: Marcadas | undefined;
  mudar: (v: Marcadas) => void;
}) {
  const atual = valor ?? { marcadas: [], qual: {} };
  return (
    <div className="grid gap-1.5 sm:grid-cols-2">
      {p.opcoes.map((o) => {
        const marcada = atual.marcadas.includes(o.valor);
        return (
          <div key={o.valor}>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={marcada}
                onChange={(e) =>
                  mudar({
                    ...atual,
                    marcadas: e.target.checked ? [...atual.marcadas, o.valor] : atual.marcadas.filter((m) => m !== o.valor),
                  })
                }
              />
              {o.valor}
            </label>
            {o.qual && marcada ? (
              <input
                value={atual.qual[o.valor] ?? ""}
                onChange={(e) => mudar({ ...atual, qual: { ...atual.qual, [o.valor]: e.target.value } })}
                placeholder="Qual?"
                className={`${campo} mt-1`}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Escolher({ p, valor, mudar }: { p: Extract<Pergunta, { tipo: "escolher" }>; valor: string; mudar: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {p.opcoes.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => mudar(o)}
          aria-pressed={valor === o}
          className={`rounded-full border px-3 py-1 text-sm transition ${
            valor === o ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 text-slate-700 hover:border-brand-400"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function CampoDeDuracao({ valor, mudar }: { valor: Duracao; mudar: (d: Duracao) => void }) {
  return (
    <span className="inline-flex gap-1">
      <input
        type="number"
        min={0}
        step="any"
        value={valor.quantidade ?? ""}
        onChange={(e) => mudar({ ...valor, quantidade: e.target.value === "" ? null : Number(e.target.value) })}
        className={`${campo} w-20`}
        aria-label="Quantidade"
      />
      <select
        value={valor.unidade}
        onChange={(e) => mudar({ ...valor, unidade: e.target.value === "meses" ? "meses" : "anos" })}
        className={`${campo} w-24`}
        aria-label="Meses ou anos"
      >
        <option value="anos">anos</option>
        <option value="meses">meses</option>
      </select>
    </span>
  );
}

function ExperienciaPedida({
  p,
  valor,
  mudar,
}: {
  p: Extract<Pergunta, { tipo: "experiencia" }>;
  valor: Experiencia | undefined;
  mudar: (v: Experiencia) => void;
}) {
  const atual: Experiencia = valor ?? { nenhuma: false, noCargo: { quantidade: null, unidade: "anos" }, anteriores: [] };
  const total = totalDeExperiencia(atual);
  return (
    <div className="space-y-2 text-sm text-slate-700">
      {p.podeSemExperiencia ? (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={atual.nenhuma} onChange={(e) => mudar({ ...atual, nenhuma: e.target.checked })} />
          Não precisa de experiência
        </label>
      ) : null}
      {atual.nenhuma ? null : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <CampoDeDuracao valor={atual.noCargo} mudar={(d) => mudar({ ...atual, noCargo: d })} />
            <span>no próprio cargo</span>
          </div>
          {atual.anteriores.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <span>mais</span>
              <CampoDeDuracao
                valor={a.duracao}
                mudar={(d) => mudar({ ...atual, anteriores: atual.anteriores.map((x, n) => (n === i ? { ...x, duracao: d } : x)) })}
              />
              <span>como</span>
              <input
                value={a.cargo}
                onChange={(e) =>
                  mudar({ ...atual, anteriores: atual.anteriores.map((x, n) => (n === i ? { ...x, cargo: e.target.value } : x)) })
                }
                placeholder="cargo anterior"
                className={`${campo} w-48`}
              />
              <button
                type="button"
                onClick={() => mudar({ ...atual, anteriores: atual.anteriores.filter((_, n) => n !== i) })}
                className="text-slate-400 hover:text-red-600"
                aria-label="Tirar"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {atual.anteriores.length < 5 ? (
            <button
              type="button"
              onClick={() =>
                mudar({ ...atual, anteriores: [...atual.anteriores, { cargo: "", duracao: { quantidade: null, unidade: "anos" } }] })
              }
              className={botaoClaro}
            >
              <Plus size={14} /> Experiência em cargo anterior
            </button>
          ) : null}
          {total > 0 ? (
            <p className="text-xs text-slate-500">
              Total pedido: {String(total).replace(".", ",")} {total === 1 ? "ano" : "anos"}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}

function UmaPergunta({ p, valor, mudar }: { p: Pergunta; valor: Resposta | undefined; mudar: (v: Resposta) => void }) {
  switch (p.tipo) {
    case "texto":
      return <Texto p={p} valor={typeof valor === "string" ? valor : ""} mudar={mudar} />;
    case "tarefas":
      return <Tarefas valor={Array.isArray(valor) ? (valor as Tarefa[]) : []} mudar={mudar} />;
    case "marcar":
      return <Marcar p={p} valor={valor as Marcadas | undefined} mudar={mudar} />;
    case "escolher":
      return <Escolher p={p} valor={typeof valor === "string" ? valor : ""} mudar={mudar} />;
    case "experiencia":
      return <ExperienciaPedida p={p} valor={valor as Experiencia | undefined} mudar={mudar} />;
  }
}

export default function QuestionarioDeCargoForm({
  token,
  secoes,
  iniciais,
}: {
  token: string;
  secoes: Secao[];
  iniciais: Respostas;
}) {
  const [respostas, setRespostas] = useState<Respostas>(iniciais);
  const [situacao, setSituacao] = useState<"" | "guardando" | "guardado" | "erro">("");
  const [erro, setErro] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [enviando, startTransition] = useTransition();
  const mudou = useRef(false);

  useEffect(() => {
    if (!mudou.current || enviado) return;
    const espera = setTimeout(async () => {
      setSituacao("guardando");
      const r = await guardarRascunho(token, JSON.stringify(respostas));
      setSituacao(r.error ? "erro" : "guardado");
    }, 1500);
    return () => clearTimeout(espera);
  }, [respostas, token, enviado]);

  if (enviado) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <h2 className="text-lg font-semibold text-emerald-900">Questionário enviado</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800">
          Obrigado! As suas respostas vão ajudar a montar a descrição do cargo.
        </p>
      </div>
    );
  }

  const mudar = (id: string, v: Resposta) => {
    mudou.current = true;
    setRespostas((atual) => ({ ...atual, [id]: v }));
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setErro("");
        startTransition(async () => {
          const r = await enviarQuestionario(token, JSON.stringify(respostas));
          if (r.error) setErro(r.error);
          else setEnviado(true);
        });
      }}
      className="space-y-4"
    >
      {secoes.map((s) => (
        <section key={s.titulo} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">{s.titulo}</h2>
          <div className="space-y-5">
            {s.perguntas.map((p) => (
              <div key={p.id}>
                <p className="text-sm font-medium text-slate-800">{p.titulo}</p>
                {p.ajuda ? <p className="mb-1.5 mt-0.5 text-xs leading-relaxed text-slate-500">{p.ajuda}</p> : <div className="mb-1.5" />}
                <UmaPergunta p={p} valor={respostas[p.id]} mudar={(v) => mudar(p.id, v)} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {erro ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erro}</p> : null}

      <div className="flex flex-wrap items-center justify-end gap-3">
        <span className="text-xs text-slate-500" aria-live="polite">
          {situacao === "guardando"
            ? "Guardando…"
            : situacao === "guardado"
              ? "Respostas guardadas. Pode continuar depois pelo mesmo link."
              : situacao === "erro"
                ? "Não deu para guardar agora. Tente de novo em instantes."
                : ""}
        </span>
        <button
          type="submit"
          disabled={enviando}
          className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
        >
          {enviando ? "Enviando…" : "Enviar questionário"}
        </button>
      </div>
    </form>
  );
}
