"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { responderFicha, type FichaState } from "@/app/ficha/[token]/actions";
import {
  MINIMO_DA_REDACAO,
  NIVEIS_DE_FORMACAO,
  PASSOS,
  PERGUNTAS_DA_REDACAO,
  SITUACOES_DO_CURSO,
  dataBr,
  experienciaPreenchida,
  experienciaVazia,
  fichaVazia,
  idadeEm,
  lerFicha,
  mesAno,
  problemasDoPasso,
  type Experiencia,
  type Ficha,
} from "@/lib/ficha";
import { Field, FormError, Input, Select, Textarea } from "./form";

/**
 * A ficha no celular do candidato, em passos curtos.
 *
 * O que ele digita fica guardado no aparelho: fechar a página no meio não
 * perde nada. Na redação, a página mede o tempo de escrita e se o texto foi
 * colado — é o que faz da ficha também um pequeno teste.
 */

const chaveDoRascunho = (token: string) => `ficha:${token}`;

function lerRascunho(token: string): Ficha | null {
  try {
    const guardado = window.localStorage.getItem(chaveDoRascunho(token));
    return guardado ? lerFicha(JSON.parse(guardado)) : null;
  } catch {
    return null;
  }
}

function guardarRascunho(token: string, ficha: Ficha) {
  try {
    window.localStorage.setItem(chaveDoRascunho(token), JSON.stringify(ficha));
  } catch {
    // Sem armazenamento (aba anônima, cota cheia): segue sem rascunho.
  }
}

function apagarRascunho(token: string) {
  try {
    window.localStorage.removeItem(chaveDoRascunho(token));
  } catch {
    // idem
  }
}

const botaoSecundario =
  "rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";
const botaoPrimario =
  "rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50";

function Enviar() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={botaoPrimario}>
      {pending ? "Enviando…" : "Enviar ficha"}
    </button>
  );
}

function Escolha<T extends string>({
  nome,
  valor,
  opcoes,
  aoMudar,
}: {
  nome: string;
  valor: T | "";
  opcoes: { valor: T; rotulo: string }[];
  aoMudar: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={nome}>
      {opcoes.map((o) => (
        <label
          key={o.valor}
          className={`cursor-pointer rounded-lg border px-3 py-2 text-sm transition ${
            valor === o.valor ? "border-brand-500 bg-brand-50 text-brand-800" : "border-slate-300 bg-white text-slate-700 hover:border-brand-300"
          }`}
        >
          <input type="radio" name={nome} className="sr-only" checked={valor === o.valor} onChange={() => aoMudar(o.valor)} />
          {o.rotulo}
        </label>
      ))}
    </div>
  );
}

const SIM_NAO = [
  { valor: "SIM" as const, rotulo: "Sim" },
  { valor: "NAO" as const, rotulo: "Não" },
];

export default function PublicFichaForm({
  token,
  nome,
  cargo,
  empresa,
}: {
  token: string;
  nome: string;
  cargo: string;
  empresa: string | null;
}) {
  const [state, action] = useActionState<FichaState, FormData>(responderFicha, {});
  const [ficha, setFicha] = useState<Ficha>(() => {
    const f = fichaVazia(cargo);
    f.pessoal.nome = nome;
    return f;
  });
  const [passo, setPasso] = useState(0);
  const [erros, setErros] = useState<string[]>([]);
  const [carregado, setCarregado] = useState(false);
  const topo = useRef<HTMLDivElement>(null);
  const escrevendoDesde = useRef<number | null>(null);

  // O rascunho só existe no navegador: lido depois de montar, para o servidor
  // e o navegador desenharem a mesma coisa na primeira vez.
  useEffect(() => {
    const r = lerRascunho(token);
    if (r) setFicha({ ...r, vaga: { ...r.vaga, cargo: r.vaga.cargo || cargo } });
    setCarregado(true);
  }, [token, cargo]);

  useEffect(() => {
    if (carregado) guardarRascunho(token, ficha);
  }, [token, ficha, carregado]);

  useEffect(() => {
    if (state.ok) apagarRascunho(token);
  }, [state.ok, token]);

  if (state.ok) {
    return (
      <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-8 text-center">
        <h2 className="text-lg font-semibold text-emerald-900">Ficha enviada</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-emerald-800">
          Obrigado! Recebemos a sua ficha e entraremos em contato sobre as próximas etapas.
        </p>
      </div>
    );
  }

  function mudar(fn: (f: Ficha) => Ficha) {
    setFicha((f) => fn(structuredClone(f)));
  }

  function mudarExperiencia(i: number, campo: keyof Experiencia, valor: string) {
    mudar((f) => {
      f.experiencias[i][campo] = valor;
      return f;
    });
  }

  // O tempo de escrita conta só enquanto o campo da redação está em foco.
  function comecarAEscrever() {
    escrevendoDesde.current = Date.now();
  }
  function pararDeEscrever() {
    const desde = escrevendoDesde.current;
    escrevendoDesde.current = null;
    if (desde === null) return;
    const segundos = (Date.now() - desde) / 1000;
    mudar((f) => {
      f.medidas.segundosNaRedacao = Math.round(f.medidas.segundosNaRedacao + segundos);
      return f;
    });
  }
  function colou() {
    mudar((f) => {
      f.medidas.colouNaRedacao = true;
      return f;
    });
  }

  function irPara(n: number) {
    if (n > passo) {
      const problemas = problemasDoPasso(ficha, passo);
      if (problemas.length > 0) {
        setErros(problemas);
        return;
      }
    }
    setErros([]);
    setPasso(n);
    topo.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const idade = ficha.pessoal.nascimento ? idadeEm(ficha.pessoal.nascimento) : null;
  const ultimo = passo === PASSOS.length - 1;

  return (
    <form action={action} className="space-y-3" onSubmit={(e) => {
      const problemas = problemasDoPasso(ficha, passo);
      if (problemas.length > 0) {
        e.preventDefault();
        setErros(problemas);
      }
    }}>
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="ficha" value={JSON.stringify(ficha)} />

      <div ref={topo} className="scroll-mt-4">
        <div className="mb-1 flex items-baseline justify-between text-xs text-slate-500">
          <span className="font-medium text-slate-700">
            {passo + 1}. {PASSOS[passo]}
          </span>
          <span>
            passo {passo + 1} de {PASSOS.length}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${((passo + 1) / PASSOS.length) * 100}%` }} />
        </div>
      </div>

      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        {passo === 0 ? (
          <>
            <Field label="Cargo pretendido">
              <Input value={ficha.vaga.cargo} onChange={(e) => mudar((f) => ((f.vaga.cargo = e.target.value), f))} />
            </Field>
            <Field label="Pretensão salarial" hint="Em reais, por mês.">
              <Input inputMode="decimal" value={ficha.vaga.pretensao} onChange={(e) => mudar((f) => ((f.vaga.pretensao = e.target.value), f))} />
            </Field>
            <Field label="Quando pode começar?" hint="Opcional. Ex.: imediatamente, em 30 dias.">
              <Input value={ficha.vaga.inicio} onChange={(e) => mudar((f) => ((f.vaga.inicio = e.target.value), f))} />
            </Field>
            <Field label="Horários em que pode trabalhar" hint="Opcional. Ex.: comercial, fins de semana, noite.">
              <Input value={ficha.vaga.horarios} onChange={(e) => mudar((f) => ((f.vaga.horarios = e.target.value), f))} />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Tem disponibilidade para viajar?</p>
              <Escolha nome="viagens" valor={ficha.vaga.viagens} opcoes={SIM_NAO} aoMudar={(v) => mudar((f) => ((f.vaga.viagens = v), f))} />
            </div>
          </>
        ) : null}

        {passo === 1 ? (
          <>
            <Field label="Nome completo">
              <Input autoComplete="name" value={ficha.pessoal.nome} onChange={(e) => mudar((f) => ((f.pessoal.nome = e.target.value), f))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Data de nascimento" hint={idade !== null ? `${idade} anos` : undefined}>
                <Input type="date" value={ficha.pessoal.nascimento} onChange={(e) => mudar((f) => ((f.pessoal.nascimento = e.target.value), f))} />
              </Field>
              <Field label="Onde nasceu" hint="Cidade e estado.">
                <Input value={ficha.pessoal.naturalidade} onChange={(e) => mudar((f) => ((f.pessoal.naturalidade = e.target.value), f))} />
              </Field>
            </div>
            <Field label="Endereço" hint="Rua, número e complemento.">
              <Input autoComplete="street-address" value={ficha.pessoal.endereco} onChange={(e) => mudar((f) => ((f.pessoal.endereco = e.target.value), f))} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Bairro">
                <Input value={ficha.pessoal.bairro} onChange={(e) => mudar((f) => ((f.pessoal.bairro = e.target.value), f))} />
              </Field>
              <Field label="CEP">
                <Input inputMode="numeric" autoComplete="postal-code" value={ficha.pessoal.cep} onChange={(e) => mudar((f) => ((f.pessoal.cep = e.target.value), f))} />
              </Field>
              <Field label="Cidade">
                <Input autoComplete="address-level2" value={ficha.pessoal.cidade} onChange={(e) => mudar((f) => ((f.pessoal.cidade = e.target.value), f))} />
              </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Celular (WhatsApp)">
                <Input type="tel" autoComplete="tel" placeholder="(83) 9 9999-9999" value={ficha.pessoal.celular} onChange={(e) => mudar((f) => ((f.pessoal.celular = e.target.value), f))} />
              </Field>
              <Field label="E-mail" hint="Opcional.">
                <Input type="email" autoComplete="email" value={ficha.pessoal.email} onChange={(e) => mudar((f) => ((f.pessoal.email = e.target.value), f))} />
              </Field>
            </div>
          </>
        ) : null}

        {passo === 2 ? (
          <>
            <Field label="Último nível de formação">
              <Select value={ficha.formacao.nivel} onChange={(e) => mudar((f) => ((f.formacao.nivel = e.target.value), f))}>
                <option value="">Escolha…</option>
                {NIVEIS_DE_FORMACAO.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Curso" hint="Se for técnico, superior ou pós.">
              <Input value={ficha.formacao.curso} onChange={(e) => mudar((f) => ((f.formacao.curso = e.target.value), f))} />
            </Field>
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">Situação</p>
              <Escolha
                nome="situacao"
                valor={ficha.formacao.situacao as (typeof SITUACOES_DO_CURSO)[number]["valor"] | ""}
                opcoes={SITUACOES_DO_CURSO.map((s) => ({ valor: s.valor, rotulo: s.rotulo }))}
                aoMudar={(v) => mudar((f) => ((f.formacao.situacao = v), f))}
              />
            </div>
            <Field label={ficha.formacao.situacao === "CURSANDO" ? "Previsão de conclusão" : "Ano de conclusão"} hint="Opcional.">
              <Input value={ficha.formacao.conclusao} onChange={(e) => mudar((f) => ((f.formacao.conclusao = e.target.value), f))} />
            </Field>
            <Field label="Outros cursos" hint="Opcional. Cursos livres, certificações, treinamentos.">
              <Textarea rows={3} value={ficha.formacao.outrosCursos} onChange={(e) => mudar((f) => ((f.formacao.outrosCursos = e.target.value), f))} />
            </Field>
            <Field label="Idiomas" hint="Opcional. Qual e em que nível (básico, intermediário, fluente).">
              <Input value={ficha.formacao.idiomas} onChange={(e) => mudar((f) => ((f.formacao.idiomas = e.target.value), f))} />
            </Field>
          </>
        ) : null}

        {passo === 3 ? (
          <>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={ficha.primeiroEmprego}
                onChange={(e) => mudar((f) => ((f.primeiroEmprego = e.target.checked), f))}
                className="h-4 w-4 rounded border-slate-300"
              />
              Este será o meu primeiro emprego
            </label>
            {ficha.primeiroEmprego ? null : (
              <>
                <p className="text-xs text-slate-500">Comece pela mais recente (ou a atual). Adicione quantas quiser.</p>
                {ficha.experiencias.map((x, i) => (
                  <fieldset key={i} className="space-y-3 rounded-lg border border-slate-200 p-3">
                    <legend className="flex items-center gap-2 px-1 text-xs font-medium text-slate-500">
                      {i === 0 ? "Última empresa (ou atual)" : `Experiência ${i + 1}`}
                      {ficha.experiencias.length > 1 ? (
                        <button
                          type="button"
                          className="text-slate-400 hover:text-red-600"
                          aria-label={`Remover experiência ${i + 1}`}
                          onClick={() => mudar((f) => ((f.experiencias = f.experiencias.filter((_, k) => k !== i)), f))}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </legend>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label="Empresa">
                        <Input value={x.empresa} onChange={(e) => mudarExperiencia(i, "empresa", e.target.value)} />
                      </Field>
                      <Field label="Cargo ou função">
                        <Input value={x.cargo} onChange={(e) => mudarExperiencia(i, "cargo", e.target.value)} />
                      </Field>
                      <Field label="Mês e ano de entrada">
                        <Input type="month" value={x.entrada} onChange={(e) => mudarExperiencia(i, "entrada", e.target.value)} />
                      </Field>
                      <Field label="Mês e ano de saída" hint="Em branco se ainda trabalha lá.">
                        <Input type="month" value={x.saida} onChange={(e) => mudarExperiencia(i, "saida", e.target.value)} />
                      </Field>
                      <Field label="Último salário" hint="Opcional.">
                        <Input inputMode="decimal" value={x.salario} onChange={(e) => mudarExperiencia(i, "salario", e.target.value)} />
                      </Field>
                      <Field label="Contato para referência" hint="Opcional. Nome e telefone.">
                        <Input value={x.contato} onChange={(e) => mudarExperiencia(i, "contato", e.target.value)} />
                      </Field>
                    </div>
                    <Field label="Motivo da saída" hint={x.saida ? undefined : "Opcional se ainda trabalha lá."}>
                      <Textarea rows={2} value={x.motivoSaida} onChange={(e) => mudarExperiencia(i, "motivoSaida", e.target.value)} />
                    </Field>
                  </fieldset>
                ))}
                {ficha.experiencias.length < 15 ? (
                  <button
                    type="button"
                    className={`${botaoSecundario} inline-flex items-center gap-1.5`}
                    onClick={() => mudar((f) => ((f.experiencias = [...f.experiencias, experienciaVazia()]), f))}
                  >
                    <Plus className="h-4 w-4" /> Adicionar outra experiência
                  </button>
                ) : null}
              </>
            )}
            <Field label="Faz ou já fez algum trabalho voluntário?" hint="Opcional. Conte o que você faz ou fazia.">
              <Textarea rows={2} value={ficha.voluntariado} onChange={(e) => mudar((f) => ((f.voluntariado = e.target.value), f))} />
            </Field>
            <Field label="Perfil profissional na internet" hint="Opcional. LinkedIn ou outro endereço onde mostra o seu trabalho.">
              <Input value={ficha.perfilProfissional} onChange={(e) => mudar((f) => ((f.perfilProfissional = e.target.value), f))} />
            </Field>
          </>
        ) : null}

        {passo === 4 ? (
          <>
            <div>
              <p className="mb-1.5 text-sm font-medium text-slate-700">
                Você foi indicado por alguém que trabalha ou trabalhou {empresa ? `na ${empresa}` : "na empresa"}?
              </p>
              <Escolha nome="indicado" valor={ficha.indicacao.indicado} opcoes={SIM_NAO} aoMudar={(v) => mudar((f) => ((f.indicacao.indicado = v), f))} />
            </div>
            {ficha.indicacao.indicado === "SIM" ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label="Nome de quem indicou">
                  <Input value={ficha.indicacao.nome} onChange={(e) => mudar((f) => ((f.indicacao.nome = e.target.value), f))} />
                </Field>
                <Field label="Cargo dessa pessoa" hint="Opcional.">
                  <Input value={ficha.indicacao.cargo} onChange={(e) => mudar((f) => ((f.indicacao.cargo = e.target.value), f))} />
                </Field>
                <Field label="Grau de proximidade" hint="Ex.: amigo, parente, ex-colega.">
                  <Input value={ficha.indicacao.proximidade} onChange={(e) => mudar((f) => ((f.indicacao.proximidade = e.target.value), f))} />
                </Field>
              </div>
            ) : null}
          </>
        ) : null}

        {passo === 5 ? (
          <>
            <p className="text-sm leading-relaxed text-slate-600">
              Responda com as suas palavras, sem pressa. Não há resposta certa: queremos conhecer você. Mínimo de {MINIMO_DA_REDACAO} caracteres em cada pergunta.
            </p>
            {(["qualidades", "expectativas"] as const).map((campo, i) => {
              const valor = ficha.redacao[campo];
              return (
                <Field key={campo} label={`${i + 1}. ${PERGUNTAS_DA_REDACAO[campo]}`}>
                  <Textarea
                    rows={8}
                    value={valor}
                    onFocus={comecarAEscrever}
                    onBlur={pararDeEscrever}
                    onPaste={colou}
                    onChange={(e) => mudar((f) => ((f.redacao[campo] = e.target.value), f))}
                  />
                  <span className={`mt-1 block text-xs ${valor.trim().length >= MINIMO_DA_REDACAO ? "text-emerald-700" : "text-slate-500"}`}>
                    {valor.trim().length} de {MINIMO_DA_REDACAO} caracteres
                  </span>
                </Field>
              );
            })}
          </>
        ) : null}

        {passo === 6 ? <Conferencia ficha={ficha} idade={idade} aoEditar={irPara} /> : null}

        {passo === 6 ? (
          <div className="space-y-2 rounded-lg bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
            <p className="font-medium text-slate-800">Aviso de privacidade</p>
            <p>
              Os dados desta ficha servem apenas para este processo seletivo{empresa ? ` da ${empresa}` : ""}, conduzido pela consultoria de RH. Eles não são
              vendidos nem repassados a terceiros fora do processo. Você pode pedir a qualquer momento para ver, corrigir ou apagar os seus dados, falando com
              quem enviou este link.
            </p>
            <label className="flex items-start gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={ficha.aceite}
                onChange={(e) => mudar((f) => ((f.aceite = e.target.checked), f))}
                className="mt-0.5 h-4 w-4 rounded border-slate-300"
              />
              Li o aviso e confirmo que as informações são verdadeiras.
            </label>
          </div>
        ) : null}
      </section>

      {erros.length > 0 ? (
        <div role="alert" className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <ul className="list-inside list-disc space-y-0.5">
            {erros.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      ) : null}
      <FormError message={state.error} />

      <div className="flex items-center justify-between gap-2">
        {passo > 0 ? (
          <button type="button" className={botaoSecundario} onClick={() => irPara(passo - 1)}>
            Voltar
          </button>
        ) : (
          <span />
        )}
        {ultimo ? (
          <Enviar />
        ) : (
          <button type="button" className={botaoPrimario} onClick={() => irPara(passo + 1)}>
            Continuar
          </button>
        )}
      </div>
      <p className="text-center text-xs text-slate-400">O que você digita fica salvo neste aparelho até o envio.</p>
    </form>
  );
}

/** O resumo para conferir antes de enviar, com atalho para cada passo. */
function Conferencia({ ficha, idade, aoEditar }: { ficha: Ficha; idade: number | null; aoEditar: (passo: number) => void }) {
  const experiencias = ficha.experiencias.filter(experienciaPreenchida);
  const blocos: { passo: number; linhas: string[] }[] = [
    { passo: 0, linhas: [`Cargo: ${ficha.vaga.cargo}`, `Pretensão: ${ficha.vaga.pretensao}`] },
    {
      passo: 1,
      linhas: [
        ficha.pessoal.nome,
        `${dataBr(ficha.pessoal.nascimento)}${idade !== null ? ` (${idade} anos)` : ""}`,
        [ficha.pessoal.endereco, ficha.pessoal.bairro, ficha.pessoal.cidade].filter(Boolean).join(", "),
        [ficha.pessoal.celular, ficha.pessoal.email].filter(Boolean).join(" · "),
      ],
    },
    { passo: 2, linhas: [[ficha.formacao.nivel, ficha.formacao.curso].filter(Boolean).join(" · ")] },
    {
      passo: 3,
      linhas: ficha.primeiroEmprego
        ? ["Primeiro emprego"]
        : experiencias.map((x) => `${x.cargo} na ${x.empresa} (${mesAno(x.entrada)} a ${x.saida ? mesAno(x.saida) : "hoje"})`),
    },
    { passo: 4, linhas: [ficha.indicacao.indicado === "SIM" ? `Indicado por ${ficha.indicacao.nome}` : "Sem indicação"] },
    { passo: 5, linhas: [`Redação: ${ficha.redacao.qualidades.length + ficha.redacao.expectativas.length} caracteres`] },
  ];

  return (
    <div className="divide-y divide-slate-100">
      {blocos.map((b) => (
        <div key={b.passo} className="flex items-start justify-between gap-3 py-2">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{PASSOS[b.passo]}</p>
            {b.linhas.filter(Boolean).map((l, i) => (
              <p key={i} className="text-sm text-slate-700">
                {l}
              </p>
            ))}
          </div>
          <button type="button" className="shrink-0 text-xs text-brand-700 hover:underline" onClick={() => aoEditar(b.passo)}>
            editar
          </button>
        </div>
      ))}
    </div>
  );
}
