"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { Check, Copy, Sparkles, Trash2, X } from "lucide-react";
import {
  esquecerExemplo,
  excluirRoteiro,
  gerarNovoRoteiro,
  mudarStatus,
  salvarEdicao,
  type RoteiroState,
} from "@/app/(app)/roteiros/actions";
import {
  conferirTamanho,
  contarPalavras,
  DURACAO_PADRAO,
  linguagemSimples,
  numerosSuspeitos,
  PUBLICO_PADRAO,
  QUANTIDADES,
  rotuloDoObjetivo,
  segundosFalados,
  textoCompleto,
  textoFalado,
} from "@/lib/roteiros";
import {
  Field,
  FormError,
  Input,
  Section,
  Select,
  SubmitButton,
  Textarea,
} from "./form";

/**
 * Estúdio de roteiros.
 *
 * A IA escreve pelo método; você reescreve na tela; o que você mudou vira
 * exemplo nas próximas gerações. No fim, cada roteiro é aprovado para gravar
 * ou descartado — e o motivo do descarte também ensina.
 */

export type BlocoItem = { rotulo: string; texto: string };

export type RoteiroItem = {
  id: string;
  tema: string;
  publico: string;
  objetivo: string;
  plataforma: string | null;
  duracaoSegundos: number;
  framework: string;
  angulo: string | null;
  copyThesis: string;
  dsi: string;
  blocos: BlocoItem[];
  ganchosAlternativos: string[];
  status: string;
  descartadoPorque: string | null;
  quando: string;
  edicoes: number;
  /** Se a geração teve prova social informada. */
  tinhaProva: boolean;
};

export type ExemploItem = {
  id: string;
  bloco: string;
  antes: string;
  depois: string;
  usar: boolean;
  quando: string;
};

const STATUS_ESTILO: Record<string, string> = {
  RASCUNHO: "bg-slate-100 text-slate-600",
  APROVADO: "bg-brand-50 text-brand-700",
  GRAVADO: "bg-sky-50 text-sky-700",
  PUBLICADO: "bg-emerald-50 text-emerald-700",
  DESCARTADO: "bg-slate-50 text-slate-400",
};

const STATUS_LABEL: Record<string, string> = {
  RASCUNHO: "rascunho",
  APROVADO: "vai gravar",
  GRAVADO: "gravado",
  PUBLICADO: "publicado",
  DESCARTADO: "descartado",
};


/** O roteiro pronto para ler, com botão de copiar. */
function TextoParaGravar({
  blocos,
}: {
  blocos: BlocoItem[];
}) {
  const [modo, setModo] = useState<"completo" | "falado">("completo");
  const [copiado, setCopiado] = useState(false);

  const texto = modo === "completo" ? textoCompleto(blocos) : textoFalado(blocos);

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Roteiro completo
        </span>

        <div className="flex overflow-hidden rounded-lg border border-slate-200 bg-white">
          {(["completo", "falado"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setModo(m)}
              className={`px-2 py-0.5 text-[11px] transition ${
                modo === m
                  ? "bg-brand-600 font-medium text-white"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {m === "completo" ? "com os blocos" : "só a fala"}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(texto);
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            } catch {
              setCopiado(false);
            }
          }}
          className="ml-auto flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-700 transition hover:bg-slate-50"
        >
          <Copy size={11} />
          {copiado ? "copiado" : "copiar"}
        </button>
      </div>

      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
        {texto}
      </p>
    </div>
  );
}

// -------------------------------------------------------------- roteiro

function CardRoteiro({ roteiro }: { roteiro: RoteiroItem }) {
  const [blocos, setBlocos] = useState(roteiro.blocos);
  const [aberto, setAberto] = useState(roteiro.status === "RASCUNHO");
  const [state, action] = useActionState<RoteiroState, FormData>(
    salvarEdicao,
    {},
  );
  const [erro, setErro] = useState<string | undefined>();
  const [pending, startTransition] = useTransition();

  const falado = textoFalado(blocos);
  const palavras = contarPalavras(falado);
  const tamanho = conferirTamanho(palavras, roteiro.duracaoSegundos);
  const linguagem = linguagemSimples(falado);
  const mudou = blocos.some(
    (b, i) => b.texto.trim() !== roteiro.blocos[i]?.texto.trim(),
  );

  const alterar = (i: number, texto: string) =>
    setBlocos((atual) => atual.map((b, n) => (n === i ? { ...b, texto } : b)));

  const decidir = (status: string) => {
    setErro(undefined);
    // O motivo do descarte ensina tanto quanto a edição, então é obrigatório.
    let porque: string | undefined;
    if (status === "DESCARTADO") {
      porque = prompt("Por que está descartando? Isso ensina o sistema.") ?? "";
      if (!porque.trim()) return;
    }

    startTransition(async () => {
      const r = await mudarStatus(roteiro.id, status, porque);
      if (r.error) setErro(r.error);
    });
  };

  return (
    <article
      className={`rounded-lg border bg-white p-3.5 shadow-sm transition ${
        pending ? "opacity-60" : ""
      } ${roteiro.status === "DESCARTADO" ? "border-slate-100" : "border-slate-200"}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3
              className={`text-sm font-semibold ${
                roteiro.status === "DESCARTADO"
                  ? "text-slate-400 line-through"
                  : "text-slate-900"
              }`}
            >
              {roteiro.tema}
            </h3>
            <span
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                STATUS_ESTILO[roteiro.status] ?? STATUS_ESTILO.RASCUNHO
              }`}
            >
              {STATUS_LABEL[roteiro.status] ?? roteiro.status}
            </span>
            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
              {roteiro.framework}
            </span>
            {roteiro.angulo ? (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-800">
                {roteiro.angulo}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-slate-400">
            {[
              rotuloDoObjetivo(roteiro.objetivo),
              roteiro.plataforma,
              `${roteiro.duracaoSegundos}s`,
              roteiro.publico,
              roteiro.edicoes > 0 ? `${roteiro.edicoes} edição(ões)` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setAberto((v) => !v)}
            className="text-xs text-slate-500 transition hover:text-slate-800"
          >
            {aberto ? "fechar" : "abrir"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              if (!confirm(`Excluir o roteiro "${roteiro.tema}"?`)) return;
              startTransition(() => {
                void excluirRoteiro(roteiro.id);
              });
            }}
            className="text-slate-300 transition hover:text-red-600"
            aria-label={`Excluir ${roteiro.tema}`}
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {roteiro.descartadoPorque ? (
        <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          Descartado: {roteiro.descartadoPorque}
        </p>
      ) : null}

      {aberto ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Copy thesis
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                {roteiro.copyThesis || "—"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                Ideia dominante
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-600">
                {roteiro.dsi || "—"}
              </p>
            </div>
          </div>

          <form action={action} className="mt-4 space-y-3">
            <input type="hidden" name="id" value={roteiro.id} />
            <input type="hidden" name="blocos" value={JSON.stringify(blocos)} />

            {blocos.map((b, i) => (
              <label key={b.rotulo} className="block">
                <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                  {b.rotulo}
                </span>
                <Textarea
                  value={b.texto}
                  onChange={(e) => alterar(i, e.target.value)}
                  rows={b.rotulo === "GANCHO" ? 2 : 3}
                  aria-label={`Bloco ${b.rotulo}`}
                />
              </label>
            ))}

            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <span
                className={`text-[11px] ${
                  linguagem.simples ? "text-emerald-700" : "text-amber-700"
                }`}
                title={
                  linguagem.dificeis.length > 0
                    ? linguagem.dificeis
                        .map((d) => `${d.termo} → ${d.sugestao}`)
                        .join(" · ")
                    : undefined
                }
              >
                {linguagem.media} palavras por frase
                {linguagem.dificeis.length > 0
                  ? ` · ${linguagem.dificeis.length} palavra(s) difícil(eis)`
                  : linguagem.media <= 20
                    ? " · linguagem simples"
                    : " · frases longas"}
              </span>

              <span
                className={`text-[11px] ${
                  tamanho.ajuste === "OK"
                    ? "text-emerald-700"
                    : "text-amber-700"
                }`}
              >
                {palavras} palavras · ~{segundosFalados(palavras)}s ·{" "}
                {tamanho.ajuste === "OK"
                  ? `dentro da faixa (${tamanho.min}–${tamanho.max})`
                  : tamanho.ajuste === "CURTO"
                    ? `curto para ${roteiro.duracaoSegundos}s (faixa ${tamanho.min}–${tamanho.max})`
                    : `longo para ${roteiro.duracaoSegundos}s (faixa ${tamanho.min}–${tamanho.max})`}
              </span>

              {mudou ? (
                <SubmitButton pendingLabel="Gravando…">
                  Salvar edição
                </SubmitButton>
              ) : null}
              {state.ok && !mudou ? (
                <span className="text-[11px] text-emerald-700">
                  Edição gravada. O sistema aprendeu com ela.
                </span>
              ) : null}
            </div>

            <FormError message={state.error} />
          </form>

          {linguagem.dificeis.length > 0 ? (
            <div className="mt-3 rounded-lg bg-amber-50 px-3 py-2">
              <p className="text-xs font-medium text-amber-900">
                Palavras que o espectador pode não entender
              </p>
              <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                {linguagem.dificeis.map((d) => (
                  <li key={d.termo} className="text-xs text-amber-800">
                    <span className="line-through opacity-70">{d.termo}</span>{" "}
                    → {d.sugestao}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {(() => {
            // Número sem prova informada é o erro que mais dói: sai no vídeo
            // como fato. A conferência é sua, mas o aviso é do sistema.
            if (roteiro.tinhaProva) return null;
            const suspeitos = numerosSuspeitos(textoFalado(blocos));
            if (suspeitos.length === 0) return null;

            return (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                <strong>Confira antes de gravar:</strong> este roteiro cita{" "}
                {suspeitos.map((s) => `"${s}"`).join(", ")}, e não houve prova
                social informada na geração. Ou você confirma a fonte, ou tira
                o dado.
              </p>
            );
          })()}

          <TextoParaGravar blocos={blocos} />

          {roteiro.ganchosAlternativos.length > 0 ? (
            <div className="mt-4">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Ganchos alternativos, para testar
              </p>
              <ul className="mt-1 space-y-1">
                {roteiro.ganchosAlternativos.map((g, i) => (
                  <li
                    key={i}
                    className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs leading-relaxed text-slate-600"
                  >
                    {g}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </>
      ) : null}

      <FormError message={erro} />

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="text-[11px] text-slate-400">{roteiro.quando}</span>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {roteiro.status === "RASCUNHO" || roteiro.status === "DESCARTADO" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => decidir("APROVADO")}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
            >
              <Check size={12} /> vou gravar
            </button>
          ) : null}

          {roteiro.status === "APROVADO" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => decidir("GRAVADO")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
            >
              já gravei
            </button>
          ) : null}

          {roteiro.status === "GRAVADO" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => decidir("PUBLICADO")}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700 transition hover:bg-slate-50"
            >
              já publiquei
            </button>
          ) : null}

          {roteiro.status !== "DESCARTADO" ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => decidir("DESCARTADO")}
              className="inline-flex items-center gap-1 text-xs text-slate-500 transition hover:text-red-600"
            >
              <X size={12} /> descartar
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

// ----------------------------------------------------------- aprendizado

function Aprendizado({ exemplos }: { exemplos: ExemploItem[] }) {
  const [pending, startTransition] = useTransition();

  if (exemplos.length === 0) return null;

  const ativos = exemplos.filter((e) => e.usar).length;

  return (
    <Section
      title="O que o sistema aprendeu com você"
      description="Cada bloco que você reescreve vira exemplo nas próximas gerações. Não é treino de modelo: é a IA vendo como você escreve antes de escrever."
    >
      <p className="mb-3 text-[11px] text-slate-500">
        {ativos} de {exemplos.length} correções em uso. As seis mais recentes
        entram no prompt — exemplo demais afoga o método.
      </p>

      <ul className={`space-y-2 ${pending ? "opacity-60" : ""}`}>
        {exemplos.map((e) => (
          <li
            key={e.id}
            className={`rounded-lg border p-3 ${
              e.usar ? "border-slate-200 bg-white" : "border-slate-100 opacity-50"
            }`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                {e.bloco}
              </span>
              <span className="text-[11px] text-slate-400">{e.quando}</span>
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  startTransition(() => {
                    void esquecerExemplo(e.id, !e.usar);
                  })
                }
                className="ml-auto text-[11px] text-slate-500 transition hover:text-slate-800"
              >
                {e.usar ? "esquecer este" : "usar de novo"}
              </button>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  a IA escreveu
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                  {e.antes}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wide text-brand-600">
                  você reescreveu
                </p>
                <p className="mt-0.5 text-xs leading-relaxed text-slate-700">
                  {e.depois}
                </p>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </Section>
  );
}

// -------------------------------------------------------------- a página

export default function ScriptStudio({
  roteiros,
  exemplos,
}: {
  roteiros: RoteiroItem[];
  exemplos: ExemploItem[];
}) {
  const [novo, setNovo] = useState(false);
  const [state, action] = useActionState<RoteiroState, FormData>(
    gerarNovoRoteiro,
    {},
  );
  useEffect(() => {
    if (state.ok) setNovo(false);
  }, [state.ok]);

  const fila = roteiros.filter(
    (r) => r.status !== "DESCARTADO" && r.status !== "PUBLICADO",
  );
  const arquivo = roteiros.filter(
    (r) => r.status === "DESCARTADO" || r.status === "PUBLICADO",
  );

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">
            Roteiros
          </h1>
          <p className="mt-1 text-sm leading-relaxed text-slate-500">
            Roteiro de vídeo de venda pelo método de Ray Edwards, na estrutura{" "}
            <strong>PASTOR</strong>. Cinco de uma vez, cada um por um ângulo
            diferente, em linguagem simples.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNovo(true)}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700"
        >
          + Roteiro
        </button>
      </div>

      {novo ? (
        <div className="mb-4">
          <Section
            title="Novo roteiro"
            description="O método manda perguntar antes de escrever: sem a oferta e o CTA, o roteiro sai com promessa inventada."
          >
            <form action={action} className="space-y-4">
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-500">
                Todo roteiro aqui é de <strong>venda</strong>, no método{" "}
                <strong>PASTOR</strong>, para <strong>{PUBLICO_PADRAO.toLowerCase()}</strong>,
                em <strong>{DURACAO_PADRAO} segundos</strong>. O que muda de um
                vídeo para outro é o que está abaixo.
              </p>

              <Field label="Tema, produto ou serviço *">
                <Input name="tema" required autoFocus />
              </Field>

              <Field
                label="Oferta *"
                hint="O que é e o que inclui. Só o que for verdade — nada será inventado."
              >
                <Textarea name="oferta" rows={2} />
              </Field>

              <Field
                label="CTA — a ação única do final *"
                hint="Ex.: clicar no link e marcar uma conversa."
              >
                <Input name="cta" />
              </Field>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Plataforma">
                  <Input name="plataforma" placeholder="Reels, TikTok, Shorts…" />
                </Field>

                <Field
                  label="Quantos roteiros"
                  hint="Cada um ataca o tema por um ângulo diferente."
                >
                  <Select name="quantidade" defaultValue="5">
                    {QUANTIDADES.map((q) => (
                      <option key={q} value={q}>
                        {q} roteiros
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>

              {state.perguntas && state.perguntas.length > 0 ? (
                <div className="rounded-lg bg-amber-50 px-3 py-2">
                  <p className="text-xs font-medium text-amber-900">
                    Antes de escrever, preciso saber:
                  </p>
                  <ul className="mt-1 space-y-1">
                    {state.perguntas.map((p) => (
                      <li
                        key={p}
                        className="flex gap-2 text-xs leading-relaxed text-amber-800"
                      >
                        <span aria-hidden className="text-amber-400">
                          •
                        </span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <FormError message={state.error} />

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="submit"
                  name="modo"
                  value="MAO"
                  className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                  title="Cria um roteiro com os blocos do método em branco, para você escrever"
                >
                  Escrever eu mesma
                </button>
                <SubmitButton pendingLabel="Escrevendo…">
                  <span className="flex items-center gap-2">
                    <Sparkles size={14} />
                    Pedir à IA
                  </span>
                </SubmitButton>
                <button
                  type="button"
                  onClick={() => setNovo(false)}
                  className="text-sm text-slate-500 transition hover:text-slate-800"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </Section>
        </div>
      ) : null}

      <section className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-900">
          Na fila
        </h2>
        {fila.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
            Nenhum roteiro na fila.
          </p>
        ) : (
          <div className="space-y-3">
            {fila.map((r) => (
              <CardRoteiro key={r.id} roteiro={r} />
            ))}
          </div>
        )}
      </section>

      {arquivo.length > 0 ? (
        <section className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">
            Publicados e descartados
          </h2>
          <div className="space-y-3">
            {arquivo.map((r) => (
              <CardRoteiro key={r.id} roteiro={r} />
            ))}
          </div>
        </section>
      ) : null}

      <Aprendizado exemplos={exemplos} />
    </main>
  );
}
