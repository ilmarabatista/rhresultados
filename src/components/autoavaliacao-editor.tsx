"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from "lucide-react";
import {
  excluirPergunta,
  moverPergunta,
  salvarModelo,
  salvarPergunta,
  type AutoavaliacaoState,
} from "@/app/(app)/empresas/[id]/pdi/autoavaliacoes/actions";
import {
  DESTINOS,
  LEGENDA_DA_ESCALA,
  OPCOES,
  ROTULO_DO_DESTINO,
  SECAO_DO_TIPO,
  TIPOS_DE_PERGUNTA,
  type Destino,
  type TipoDePergunta,
} from "@/lib/autoavaliacao";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "./form";
import { avisar, confirmar } from "@/components/avisos";

/**
 * O editor do modelo de autoavaliação: o nome da função, o texto de abertura
 * e as perguntas de cada seção. Cada pergunta se edita no lugar.
 */

type PerguntaDaTela = { id: string; tipo: TipoDePergunta; texto: string; destino: Destino | null };

const botaoIcone = "rounded p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 disabled:opacity-30";

function Cabecalho({
  companyId,
  cargos,
  modelo,
}: {
  companyId: string;
  cargos: { id: string; nome: string }[];
  modelo: { id: string; nome: string; cargoId: string; instrucoes: string };
}) {
  const [state, action] = useActionState<AutoavaliacaoState, FormData>(salvarModelo, {});
  useEffect(() => {
    if (state.ok) avisar("Modelo salvo.");
  }, [state]);

  return (
    <form action={action} className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
      <input type="hidden" name="companyId" value={companyId} />
      <input type="hidden" name="modeloId" value={modelo.id} />
      <h1 className="text-xl font-semibold tracking-tight text-slate-900">Autoavaliação · {modelo.nome}</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Função">
          <Input name="nome" required defaultValue={modelo.nome} />
        </Field>
        <Field label="Cargo (opcional)" hint="Quem ocupa o cargo recebe este modelo como sugestão.">
          <Select name="cargoId" defaultValue={modelo.cargoId}>
            <option value="">Nenhum</option>
            {cargos.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Texto de abertura" hint="A pessoa lê antes de começar.">
        <Textarea name="instrucoes" rows={2} defaultValue={modelo.instrucoes} />
      </Field>
      <FormError message={state.error} />
      <div className="flex justify-end">
        <SubmitButton>Salvar</SubmitButton>
      </div>
    </form>
  );
}

function FormularioDaPergunta({
  modeloId,
  tipo,
  pergunta,
  onClose,
}: {
  modeloId: string;
  tipo: TipoDePergunta;
  pergunta?: PerguntaDaTela;
  onClose: () => void;
}) {
  const [state, action] = useActionState<AutoavaliacaoState, FormData>(salvarPergunta, {});
  const [tipoEscolhido, setTipo] = useState<TipoDePergunta>(pergunta?.tipo ?? tipo);
  useEffect(() => {
    if (state.ok) onClose();
  }, [state, onClose]);

  return (
    <form action={action} className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
      <input type="hidden" name="modeloId" value={modeloId} />
      {pergunta ? <input type="hidden" name="perguntaId" value={pergunta.id} /> : null}
      <Textarea
        name="texto"
        rows={2}
        required
        autoFocus
        defaultValue={pergunta?.texto ?? ""}
        placeholder={
          tipoEscolhido === "ABERTA"
            ? "Ex.: Dificuldades: o que mais trava o meu dia a dia?"
            : tipoEscolhido === "CONDUTA"
              ? "Ex.: Celular no atendimento: usei o celular durante um atendimento"
              : "Ex.: Pontualidade: chego sempre no horário e respeito os horários de pausa"
        }
      />
      <p className="text-micro text-slate-500">
        Padrão: o tema, dois-pontos e a frase como a pessoa falaria de si. Ex.: Pontualidade: chego sempre no horário e
        respeito os horários de pausa.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          name="tipo"
          value={tipoEscolhido}
          onChange={(e) => setTipo(e.target.value as TipoDePergunta)}
          className="w-auto py-1.5"
          aria-label="Seção"
        >
          {TIPOS_DE_PERGUNTA.map((t) => (
            <option key={t} value={t}>
              {SECAO_DO_TIPO[t].titulo}
            </option>
          ))}
        </Select>
        {tipoEscolhido === "ABERTA" ? (
          <Select name="destino" defaultValue={pergunta?.destino ?? "querDesenvolver"} className="w-auto py-1.5" aria-label="Vai para">
            {DESTINOS.map((d) => (
              <option key={d} value={d}>
                Vai para: {ROTULO_DO_DESTINO[d]}
              </option>
            ))}
          </Select>
        ) : null}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">
            Cancelar
          </button>
          <SubmitButton className="py-1.5">{pergunta ? "Salvar" : "Incluir"}</SubmitButton>
        </div>
      </div>
      <FormError message={state.error} />
    </form>
  );
}

function Respostas({ tipo }: { tipo: TipoDePergunta }) {
  if (tipo === "ABERTA") return <span>Resposta livre, em texto.</span>;
  if (tipo === "TECNICA" || tipo === "COMPORTAMENTAL") return <span>Nota: {LEGENDA_DA_ESCALA}</span>;
  return <span>Opções: {OPCOES[tipo].map((o) => o.rotulo).join(" · ")}</span>;
}

export default function AutoavaliacaoEditor({
  companyId,
  cargos,
  modelo,
  perguntas,
}: {
  companyId: string;
  cargos: { id: string; nome: string }[];
  modelo: { id: string; nome: string; cargoId: string; instrucoes: string };
  perguntas: PerguntaDaTela[];
}) {
  const [editando, setEditando] = useState<string | null>(null);
  const [incluindo, setIncluindo] = useState<TipoDePergunta | null>(null);
  const [pending, startTransition] = useTransition();

  const fazer = (acao: () => Promise<AutoavaliacaoState>) =>
    startTransition(async () => {
      const r = await acao();
      if (r.error) avisar(r.error);
    });

  let secao = 0;
  return (
    <div className={`space-y-3.5 ${pending ? "opacity-60" : ""}`}>
      <Cabecalho companyId={companyId} cargos={cargos} modelo={modelo} />

      {TIPOS_DE_PERGUNTA.map((tipo) => {
        const daSecao = perguntas.filter((p) => p.tipo === tipo);
        if (daSecao.length > 0) secao += 1;
        return (
          <section key={tipo} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-slate-900">
                  {daSecao.length > 0 ? `${secao}. ` : ""}
                  {SECAO_DO_TIPO[tipo].titulo}
                  <span className="ml-1.5 font-normal text-slate-400">{daSecao.length}</span>
                </h2>
                <p className="mt-0.5 text-micro text-slate-500">
                  <Respostas tipo={tipo} />
                  {daSecao.length === 0 ? " · seção vazia, não aparece para a pessoa" : ""}
                </p>
              </div>
              {incluindo !== tipo ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditando(null);
                    setIncluindo(tipo);
                  }}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50"
                >
                  <Plus size={13} /> Incluir pergunta
                </button>
              ) : null}
            </div>

            <ol className="space-y-1">
              {daSecao.map((p, i) =>
                editando === p.id ? (
                  <li key={p.id}>
                    <FormularioDaPergunta modeloId={modelo.id} tipo={tipo} pergunta={p} onClose={() => setEditando(null)} />
                  </li>
                ) : (
                  <li key={p.id} className="group flex items-start gap-2 rounded-md px-1.5 py-1 hover:bg-slate-50">
                    <span className="w-5 shrink-0 pt-0.5 text-right text-xs tabular-nums text-slate-400">{i + 1}</span>
                    <span className="min-w-0 flex-1 text-sm text-slate-700">
                      {p.texto}
                      {p.tipo === "ABERTA" && p.destino ? (
                        <span className="ml-1.5 text-micro text-slate-400">→ {ROTULO_DO_DESTINO[p.destino]}</span>
                      ) : null}
                    </span>
                    <span className="flex shrink-0 items-center">
                      <button
                        type="button"
                        className={botaoIcone}
                        disabled={i === 0}
                        aria-label="Subir"
                        onClick={() => fazer(() => moverPergunta(p.id, -1))}
                      >
                        <ArrowUp size={14} />
                      </button>
                      <button
                        type="button"
                        className={botaoIcone}
                        disabled={i === daSecao.length - 1}
                        aria-label="Descer"
                        onClick={() => fazer(() => moverPergunta(p.id, 1))}
                      >
                        <ArrowDown size={14} />
                      </button>
                      <button
                        type="button"
                        className={botaoIcone}
                        aria-label="Editar"
                        onClick={() => {
                          setIncluindo(null);
                          setEditando(p.id);
                        }}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className={`${botaoIcone} hover:text-red-600`}
                        aria-label="Excluir"
                        onClick={async () => {
                          if (await confirmar(`Excluir a pergunta "${p.texto}"? Os links já mandados não mudam.`))
                            fazer(() => excluirPergunta(p.id));
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </span>
                  </li>
                ),
              )}
            </ol>
            {incluindo === tipo ? (
              <div className="mt-2">
                <FormularioDaPergunta modeloId={modelo.id} tipo={tipo} onClose={() => setIncluindo(null)} />
              </div>
            ) : null}
          </section>
        );
      })}

      <p className="text-xs text-slate-500">
        Mudanças valem para os próximos links. Quem já recebeu o link responde as perguntas do dia do envio.
      </p>
    </div>
  );
}
