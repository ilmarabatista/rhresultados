"use client";

import { useActionState, useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  alternarTesteCadastrado,
  excluirTesteCadastrado,
  salvarTesteCadastrado,
  type TestesState,
} from "@/app/(app)/testes/actions";
import { lerEstrutura, MODELO_DE_ESTRUTURA, MODOS_DO_TESTE, type ModoDoTeste } from "@/lib/testes-cadastrados";
import { Aviso, Etiqueta, Painel } from "./ui";
import { Field, FormError, FormOk, Input, Select, SubmitButton, Textarea } from "./form";

/**
 * O cadastro de um teste: o nome, a forma de responder, as instruções e a
 * estrutura colada. Ao lado, o que o sistema entendeu da estrutura, na hora —
 * as questões contadas, os fatores, os pares e o que precisa ser corrigido.
 */

export type TesteNaTela = {
  id: string | null;
  nome: string;
  instrucoes: string;
  modo: ModoDoTeste;
  estrutura: string;
  ativo: boolean;
  aplicado: number;
};

export default function CustomTestEditor({ teste }: { teste: TesteNaTela }) {
  const router = useRouter();
  const [state, action] = useActionState<TestesState, FormData>(salvarTesteCadastrado, {});
  const [texto, setTexto] = useState(teste.estrutura);
  const [modo, setModo] = useState<ModoDoTeste>(teste.modo);
  const [pending, startTransition] = useTransition();
  const lido = useMemo(() => (texto.trim() ? lerEstrutura(texto) : null), [texto]);

  useEffect(() => {
    if (state.ok && state.id && !teste.id) router.replace(`/testes/cadastro/${state.id}`);
  }, [state, teste.id, router]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-5 sm:px-6">
      <Link href="/testes?ver=cadastrados" className="text-xs text-slate-500 transition hover:text-brand-700">
        ‹ Testes
      </Link>
      <div className="mb-3 mt-1 flex flex-wrap items-center gap-2">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">{teste.id ? teste.nome : "Cadastrar teste"}</h1>
        {teste.id ? <Etiqueta tom={teste.ativo ? "bom" : "neutro"}>{teste.ativo ? "ativo" : "desativado"}</Etiqueta> : null}
        {teste.id ? <span className="text-xs text-slate-500">enviado {teste.aplicado} vez(es)</span> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <form action={action} className="space-y-3">
          <input type="hidden" name="id" value={teste.id ?? ""} />
          <Painel titulo="O teste">
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Nome">
                <Input name="nome" required defaultValue={teste.nome} placeholder="Ex.: Questionário tipológico" />
              </Field>
              <Field label="Forma de responder" hint={MODOS_DO_TESTE.find((m) => m.valor === modo)?.explicacao}>
                <Select name="modo" value={modo} onChange={(e) => setModo(e.target.value as ModoDoTeste)}>
                  {MODOS_DO_TESTE.map((m) => (
                    <option key={m.valor} value={m.valor}>
                      {m.rotulo}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="mt-2">
              <Field label="Instruções para quem responde" hint="Uma por linha. Aparecem antes das questões.">
                <Textarea name="instrucoes" rows={3} defaultValue={teste.instrucoes} />
              </Field>
            </div>
          </Painel>

          <Painel
            titulo="Estrutura"
            descricao="Cole as questões com a chave de cada alternativa entre colchetes. Também dá para colar uma tabela de planilha: pergunta, alternativa e fator."
            acao={
              !texto.trim() ? (
                <button
                  type="button"
                  onClick={() => setTexto(MODELO_DE_ESTRUTURA)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:text-brand-700"
                >
                  Usar o modelo
                </button>
              ) : null
            }
          >
            <Textarea
              name="estrutura"
              rows={26}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              className="font-mono text-[12px]"
              placeholder={MODELO_DE_ESTRUTURA}
              spellCheck={false}
            />
          </Painel>

          <FormError message={state.error} />
          {state.erros?.length ? (
            <ul className="list-disc space-y-0.5 pl-5 text-xs text-red-700">
              {state.erros.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          ) : null}
          <FormOk message={state.ok ? "Teste salvo." : undefined} />

          <div className="flex flex-wrap items-center gap-3">
            <SubmitButton pendingLabel="Salvando…">Salvar o teste</SubmitButton>
            {teste.id ? (
              <>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => startTransition(async () => void (await alternarTesteCadastrado(teste.id!, !teste.ativo)))}
                  className="text-xs text-slate-600 transition hover:text-brand-700 disabled:opacity-60"
                >
                  {teste.ativo ? "Desativar" : "Ativar"}
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm(`Excluir o teste "${teste.nome}"? As respostas já enviadas ficam guardadas.`)) return;
                    startTransition(async () => {
                      const r = await excluirTesteCadastrado(teste.id!);
                      if (r.ok) router.push("/testes?ver=cadastrados");
                    });
                  }}
                  className="ml-auto text-xs text-slate-400 transition hover:text-red-700 disabled:opacity-60"
                >
                  Excluir
                </button>
              </>
            ) : null}
          </div>
        </form>

        <div className="space-y-3 lg:sticky lg:top-4 lg:self-start">
          <Painel titulo="Como o sistema leu">
            {!lido ? (
              <p className="text-xs text-slate-500">Cole a estrutura ao lado para ver aqui as questões, os fatores e os pares.</p>
            ) : (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-center">
                  {[
                    ["Questões", lido.estrutura.questoes.length],
                    ["Fatores", lido.estrutura.fatores.length],
                    ["Pares", lido.estrutura.pares.length],
                  ].map(([rotulo, valor]) => (
                    <div key={rotulo} className="rounded-md bg-slate-50 py-2">
                      <p className="text-lg font-semibold tabular-nums text-brand-800">{valor}</p>
                      <p className="text-[10px] uppercase tracking-wider text-slate-400">{rotulo}</p>
                    </div>
                  ))}
                </div>

                {lido.erros.length > 0 ? (
                  <Aviso rotulo={`${lido.erros.length} ponto(s) a corrigir`} tom="ruim">
                    <ul className="list-disc space-y-0.5 pl-4 text-[11px]">
                      {lido.erros.slice(0, 15).map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                    {lido.erros.length > 15 ? <p className="text-[11px]">E mais {lido.erros.length - 15}.</p> : null}
                  </Aviso>
                ) : (
                  <Aviso tom="bom">Tudo certo: a estrutura está pronta para salvar.</Aviso>
                )}

                {lido.estrutura.fatores.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Fatores</p>
                    <ul className="mt-0.5 space-y-0.5 text-[12px] text-slate-700">
                      {lido.estrutura.fatores.map((f) => (
                        <li key={f.codigo}>
                          <strong>{f.codigo}</strong> · {f.nome}
                          {f.descricao ? <span className="text-slate-400"> — {f.descricao}</span> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}

                {lido.estrutura.pares.length > 0 ? (
                  <p className="text-[12px] text-slate-700">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Tipo por </span>
                    {lido.estrutura.pares.map((p) => p.join("/")).join(", ")}
                  </p>
                ) : null}

                {lido.estrutura.questoes.slice(0, 3).map((q, i) => (
                  <div key={i} className="rounded-md border border-slate-200 p-2 text-[12px]">
                    <p className="whitespace-pre-line font-medium text-slate-800">
                      {i + 1}. {q.enunciado}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-slate-600">
                      {q.opcoes.map((o, j) => (
                        <li key={j} className="flex gap-2">
                          <span className="min-w-0 flex-1">{o.texto}</span>
                          <Etiqueta tom="azul">{o.fator}</Etiqueta>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                {lido.estrutura.questoes.length > 3 ? (
                  <p className="text-[11px] text-slate-400">E mais {lido.estrutura.questoes.length - 3} questões.</p>
                ) : null}
              </div>
            )}
          </Painel>
        </div>
      </div>
    </main>
  );
}
