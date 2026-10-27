import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { todayKey } from "@/lib/dates";
import {
  cargaSemanal,
  diasDoMes,
  DIAS_DA_SEMANA,
  horarioDaPessoa,
  horas,
  NOME_DA_OCORRENCIA,
  nomeDoMes,
  outroMes,
  relogio,
  saldoEscrito,
  totalizar,
  type Totais as TotaisDoPonto,
} from "@/lib/ponto";
import {
  calculosNoPonto,
  empresaNoPonto,
  enderecoDoPonto,
  ErroDoPonto,
  lancamentosNoPonto,
  ocorrenciasNoPonto,
  pontoConfigurado,
  presentesNoPonto,
  relatoriosNoPonto,
  saldosNoPonto,
  type ColaboradorNoPonto,
  type CalculoNoPonto,
  type DiaNoPonto,
  type SaldoNoPonto,
} from "@/lib/ponto-api";
import { Aviso, Etiqueta, Filtros, Numeros, Painel, Tabela, TituloDaSecao, Vazio } from "@/components/ui";
import PrintButton from "@/components/print-button";
import {
  ConfigForm,
  EnviarRelatorio,
  Espelho,
  ExcluirLancamento,
  ExcluirOcorrencia,
  HorarioDoColaborador,
  LancamentoForm,
  LancarOcorrencia,
  OcorrenciaForm,
} from "@/components/ponto-painel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ponto — RH Resultados" };

/**
 * O ponto da empresa, visto e ajustado do RH. As batidas moram no sistema de
 * ponto, à parte; esta tela lê e escreve lá pela API.
 *
 * Empresa → Ponto → Colaboradores → horários do colaborador, com os ajustes,
 * e o relatório individual que vai para o colaborador conferir.
 */

const VISOES = [
  ["colaboradores", "Colaboradores"],
  ["horarios", "Horários"],
  ["relatorio", "Relatório"],
  ["ocorrencias", "Feriados e ocorrências"],
  ["regras", "Regras"],
] as const;
type Visao = (typeof VISOES)[number][0];

export default async function PontoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ver?: string; mes?: string; colaborador?: string; periodo?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;

  const company = await prisma.company.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!company) notFound();

  const titulo = <TituloDaSecao antes="Ponto" destaque="Eletrônico" />;
  const urlDoPonto = enderecoDoPonto();

  if (!pontoConfigurado()) {
    return (
      <main className="space-y-3.5">
        {titulo}
        <Vazio>
          A ligação com o sistema de ponto ainda não está configurada. Faltam as variáveis PONTO_URL e INTEGRACAO_SECRET no servidor do RH.
        </Vazio>
      </main>
    );
  }

  let dados: Awaited<ReturnType<typeof empresaNoPonto>>;
  try {
    dados = await empresaNoPonto(id);
  } catch (e) {
    return (
      <main className="space-y-3.5">
        {titulo}
        <Aviso tom="ruim" rotulo="Sem resposta do ponto">
          {e instanceof ErroDoPonto ? e.message : "Não foi possível falar com o sistema de ponto."}
        </Aviso>
      </main>
    );
  }

  if (!dados) {
    return (
      <main className="space-y-3.5">
        {titulo}
        <Vazio
          acao={
            urlDoPonto ? (
              <a href={`${urlDoPonto}/admin`} target="_blank" rel="noreferrer" className="text-sm font-medium text-brand-700 underline">
                Abrir o sistema de ponto
              </a>
            ) : null
          }
        >
          Esta empresa ainda não tem ponto. O ponto é criado no sistema de ponto, na área do administrador: lá você escolhe a empresa, informa o
          horário padrão e cadastra os colaboradores pelo email.
        </Vazio>
      </main>
    );
  }

  const { empresa, colaboradores } = dados;
  const hoje = todayKey();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hoje.slice(0, 7);
  const visao: Visao = VISOES.some(([v]) => v === sp.ver) ? (sp.ver as Visao) : "colaboradores";
  const banco = empresa.regime === "BANCO_DE_HORAS";
  const ativos = colaboradores.filter((c) => c.ativo);
  const dias = diasDoMes(mes);
  const primeiroDia = dias[0];
  const ultimoDia = dias.at(-1)!;

  const seisMeses = sp.periodo === "6m";
  const href = (mudar: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const final = { ver: visao, mes, colaborador: sp.colaborador, periodo: seisMeses ? "6m" : undefined, ...mudar };
    for (const [k, v] of Object.entries(final)) if (v) q.set(k, v);
    return `/empresas/${id}/ponto?${q.toString()}`;
  };

  const navegaMes = (
    <div className="no-print flex items-center gap-1 text-xs">
      <Link href={href({ mes: outroMes(mes, -1) })} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:text-brand-700">
        ‹
      </Link>
      <span className="min-w-[8.5rem] text-center font-medium text-slate-700 first-letter:uppercase">{nomeDoMes(mes)}</span>
      <Link href={href({ mes: outroMes(mes, 1) })} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:text-brand-700">
        ›
      </Link>
    </div>
  );

  const escolhido = colaboradores.find((c) => c.id === sp.colaborador) ?? ativos[0] ?? colaboradores[0];
  const agora = await presentesNoPonto(id);

  return (
    <main className="space-y-3.5">
      <div className="no-print">
        {titulo}
        <Numeros
          colunas={4}
          itens={[
            {
              rotulo: "Regime",
              valor: banco ? "Banco de horas" : "Horas extras",
              detalhe: `${horas(cargaSemanal(empresa.horario))} semanais · tolerância ${empresa.tolerancia} min`,
            },
            {
              rotulo: "Colaboradores",
              valor: ativos.length,
              detalhe: `${ativos.filter((c) => c.trocarSenha).length} sem o primeiro acesso`,
              tom: ativos.length === 0 ? "atencao" : "neutro",
            },
            { rotulo: "Bateram hoje", valor: agora.bateramHoje },
            {
              rotulo: "Dentro agora",
              valor: agora.presentes.length,
              detalhe: agora.presentes.slice(0, 3).map((p) => p.nome.split(" ")[0]).join(", ") || "ninguém",
            },
          ]}
        />
      </div>

      {!empresa.ativo ? (
        <div className="no-print">
          <Aviso rotulo="Ponto desligado">Os colaboradores desta empresa não conseguem bater ponto. Para religar, use Regras.</Aviso>
        </div>
      ) : null}

      {colaboradores.length === 0 ? (
        <div className="no-print">
          <Aviso rotulo="Para começar">
            Ninguém cadastrado no ponto desta empresa. Os colaboradores são cadastrados pelo email no{" "}
            {urlDoPonto ? (
              <a className="underline" href={`${urlDoPonto}/admin`} target="_blank" rel="noreferrer">
                sistema de ponto
              </a>
            ) : (
              "sistema de ponto"
            )}
            .
          </Aviso>
        </div>
      ) : null}

      <div className="no-print">
        <Filtros itens={VISOES.map(([v, rotulo]) => ({ rotulo, href: href({ ver: v }), ativo: v === visao }))} />
      </div>

      {visao === "colaboradores" ? (
        <Colaboradores />
      ) : visao === "horarios" ? (
        <Horarios />
      ) : visao === "relatorio" ? (
        <Relatorio />
      ) : visao === "ocorrencias" ? (
        <Ocorrencias />
      ) : (
        <ConfigForm
          companyId={id}
          config={{
            regime: empresa.regime,
            horario: empresa.horario,
            tolerancia: empresa.tolerancia,
            intervaloMinimo: empresa.intervaloMinimo,
            validadeBancoMeses: empresa.validadeBancoMeses,
            inicio: empresa.inicio,
            ativo: empresa.ativo,
          }}
        />
      )}
    </main>
  );

  function seletorDoColaborador(ver: Visao, atual: ColaboradorNoPonto) {
    return (
      <form method="get" className="no-print flex flex-wrap items-center gap-2">
        <input type="hidden" name="ver" value={ver} />
        <input type="hidden" name="mes" value={mes} />
        {seisMeses && ver === "horarios" ? <input type="hidden" name="periodo" value="6m" /> : null}
        <select name="colaborador" defaultValue={atual.id} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm">
          {colaboradores.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
              {c.ativo ? "" : " (desativado)"}
            </option>
          ))}
        </select>
        <button type="submit" className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white">
          Ver
        </button>
        <span className="flex-1" />
        {navegaMes}
      </form>
    );
  }

  // ------------------------------------------------------- colaboradores

  async function Colaboradores() {
    const [calculos, saldos] = await Promise.all([
      calculosNoPonto(id, primeiroDia, ultimoDia),
      banco ? saldosNoPonto(id) : Promise.resolve(null),
    ]);
    const lista = calculos.filter((c) => c.pessoa.ativo || c.dias.some((d) => d.marcacoes.length > 0));

    const soma = lista.reduce(
      (s, c) => ({
        trabalhado: s.trabalhado + c.totais.trabalhado,
        extras: s.extras + c.totais.extras50 + c.totais.extras100,
        debito: s.debito + c.totais.debito,
        faltas: s.faltas + c.totais.faltas,
        alertas: s.alertas + c.totais.alertas,
      }),
      { trabalhado: 0, extras: 0, debito: 0, faltas: 0, alertas: 0 },
    );

    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {navegaMes}
          <a
            href={`/api/ponto/csv?empresa=${id}&mes=${mes}`}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 transition hover:text-brand-700"
          >
            <Download size={13} /> Planilha do mês (CSV)
          </a>
        </div>

        <Numeros
          colunas={4}
          itens={[
            { rotulo: "Horas trabalhadas", valor: horas(soma.trabalhado) },
            { rotulo: "Horas extras", valor: horas(soma.extras), detalhe: "fora do horário padrão" },
            { rotulo: "Faltas", valor: soma.faltas, tom: soma.faltas ? "ruim" : "neutro", detalhe: `atrasos e saídas: ${horas(soma.debito)}` },
            { rotulo: "Alertas", valor: soma.alertas, tom: soma.alertas ? "atencao" : "bom", detalhe: "batida faltando, intervalo, descanso" },
          ]}
        />

        <ListaDeColaboradores lista={lista} saldos={saldos} />

        {agora.presentes.length > 0 ? (
          <Painel titulo="Dentro agora">
            <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
              {agora.presentes.map((p) => (
                <li key={p.nome} className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">
                  {p.nome} · desde{" "}
                  {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(new Date(p.desde))}
                </li>
              ))}
            </ul>
          </Painel>
        ) : null}
      </div>
    );
  }

  /** Todos pelo nome, com o banco de horas de cada um na frente. Clicar abre o ponto da pessoa. */
  function ListaDeColaboradores({ lista, saldos }: { lista: CalculoNoPonto[]; saldos: Record<string, SaldoNoPonto> | null }) {
    if (lista.length === 0) return <Vazio>Ninguém no ponto neste mês.</Vazio>;
    const valor = (c: CalculoNoPonto) => (banco ? (saldos?.[c.pessoa.id]?.total ?? 0) : c.totais.extras50 + c.totais.extras100 - c.totais.debito);
    const maior = Math.max(60, ...lista.map((c) => Math.abs(valor(c))));
    const ordenada = [...lista].sort((x, y) => x.pessoa.nome.localeCompare(y.pessoa.nome, "pt-BR"));
    return (
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-900 px-3 py-1.5 text-micro font-semibold uppercase tracking-wider text-white">
          <span>Colaboradores · {ordenada.length}</span>
          <span className="text-brand-200">{banco ? "Banco de horas hoje" : `Extras menos atrasos em ${nomeCurto(mes)}`}</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {ordenada.map((c) => {
            const v = valor(c);
            const metade = `${(Math.abs(v) / maior) * 50}%`;
            const t = c.totais;
            return (
              <li key={c.pessoa.id}>
                <Link
                  href={href({ ver: "horarios", colaborador: c.pessoa.id })}
                  className="group flex items-center gap-3 px-3 py-2 transition hover:bg-brand-50/50"
                >
                  <Iniciais nome={c.pessoa.nome} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-slate-800 group-hover:text-brand-700">{c.pessoa.nome}</span>
                      {!c.pessoa.ativo ? (
                        <Etiqueta>desativado</Etiqueta>
                      ) : c.pessoa.trocarSenha ? (
                        <Etiqueta tom="atencao">sem 1º acesso</Etiqueta>
                      ) : null}
                      {t.faltas ? <Etiqueta tom="ruim">{t.faltas} falta{t.faltas > 1 ? "s" : ""}</Etiqueta> : null}
                      {t.alertas ? <Etiqueta tom="atencao">{t.alertas} alerta{t.alertas > 1 ? "s" : ""}</Etiqueta> : null}
                    </span>
                    <span className="block truncate text-micro text-slate-500">
                      {nomeCurto(mes)}: trabalhou {horas(t.trabalhado)} de {horas(t.previsto)} · extra {horas(t.extras50 + t.extras100)} · atraso {horas(t.debito)}
                    </span>
                  </span>
                  <span className="relative hidden h-2 w-40 shrink-0 rounded-full bg-slate-100 sm:block" aria-hidden>
                    <span className="absolute inset-y-[-3px] left-1/2 w-px bg-slate-300" />
                    <span
                      className={`absolute inset-y-0 rounded-full ${v >= 0 ? "left-1/2 bg-emerald-500" : "right-1/2 bg-red-500"}`}
                      style={{ width: metade }}
                    />
                  </span>
                  <span className={`w-20 shrink-0 text-right text-base font-semibold tabular-nums ${cor(v)}`}>{saldoEscrito(v)}</span>
                  <ChevronRight size={15} className="shrink-0 text-slate-300 group-hover:text-brand-700" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  // ------------------------------------------------------------ horários

  async function Horarios() {
    if (!escolhido) return <Vazio>Cadastre os colaboradores no sistema de ponto para ver os horários.</Vazio>;

    // Nos últimos 6 meses, uma leitura só, do 1º dia de 5 meses antes ao fim do mês escolhido.
    const meses = seisMeses ? [0, 1, 2, 3, 4, 5].map((i) => outroMes(mes, -i)) : [mes];
    const desde = diasDoMes(meses.at(-1)!)[0];
    const [[calculo], saldo, lancamentos] = await Promise.all([
      calculosNoPonto(id, desde, ultimoDia, escolhido.id),
      banco ? saldosNoPonto(id, escolhido.id).then((s) => s[escolhido.id]) : Promise.resolve(null),
      banco ? lancamentosNoPonto(id, escolhido.id) : Promise.resolve([]),
    ]);
    const porMes = meses.map((m) => {
      const diasDoPeriodo = calculo.dias.filter((d) => d.dia.startsWith(m));
      return { mes: m, dias: diasDoPeriodo, totais: totalizar(diasDoPeriodo.filter((d) => !d.foraDoPeriodo)) };
    });
    const horario = horarioDaPessoa(empresa.horario, escolhido.horario);
    const doMes = porMes[0].totais;

    const pilula = (ativo: boolean) =>
      `rounded-full border px-2.5 py-0.5 text-xs transition ${
        ativo ? "border-brand-700 bg-brand-700 font-medium text-white" : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
      }`;

    return (
      <div className="space-y-3">
        <div className="no-print flex flex-wrap items-center gap-2">
          <Link
            href={href({ ver: "colaboradores", colaborador: undefined, periodo: undefined })}
            className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 hover:text-brand-700"
          >
            <ChevronLeft size={13} /> Todos
          </Link>
          {seletorDoColaborador("horarios", escolhido)}
        </div>

        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-3">
              <Iniciais nome={escolhido.nome} grande />
              <div>
                <p className="text-micro font-medium uppercase tracking-wider text-slate-500">Ponto · {company!.name}</p>
                <h2 className="text-base font-semibold text-slate-900">{escolhido.nome}</h2>
                <p className="text-xs text-slate-500">
                  {[escolhido.email, `${horas(cargaSemanal(horario))} semanais${escolhido.horario ? " (horário próprio)" : ""}`].join(" · ")}
                </p>
                <div className="no-print mt-1.5 flex flex-wrap items-center gap-2">
                  <LancarOcorrencia companyId={id} colaboradorId={escolhido.id} nome={escolhido.nome} hoje={hoje} />
                  <HorarioDoColaborador
                    companyId={id}
                    colaborador={{ id: escolhido.id, horario: escolhido.horario, admissao: escolhido.admissao }}
                    horarioDaEmpresa={empresa.horario}
                  />
                  <Link href={href({ ver: "relatorio", colaborador: escolhido.id, periodo: undefined })} className="text-xs text-brand-700 underline">
                    Relatório do mês
                  </Link>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {banco ? (
                <Destaque rotulo="Banco de horas hoje" valor={saldo?.total ?? 0} detalhe={`prazo para compensar: ${empresa.validadeBancoMeses} meses`} />
              ) : null}
              <Destaque
                rotulo={banco ? `Saldo de ${nomeCurto(mes)}` : `Extras menos atrasos em ${nomeCurto(mes)}`}
                valor={banco ? doMes.saldo : doMes.extras50 + doMes.extras100 - doMes.debito}
                detalhe={`trabalhou ${horas(doMes.trabalhado)} de ${horas(doMes.previsto)}`}
              />
            </div>
          </header>
        </section>

        <div className="no-print flex flex-wrap items-center gap-2">
          <span className="text-micro font-medium uppercase tracking-wider text-slate-500">Ver</span>
          <Link href={href({ periodo: undefined })} className={pilula(!seisMeses)}>
            O mês
          </Link>
          <Link href={href({ periodo: "6m" })} className={pilula(seisMeses)}>
            Últimos 6 meses
          </Link>
        </div>

        {seisMeses ? <SeisMeses porMes={porMes} /> : null}

        {porMes.map((p, i) =>
          seisMeses ? (
            <details key={p.mes} id={`mes-${p.mes}`} open={i === 0} className="group scroll-mt-20 rounded-lg border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5 hover:bg-slate-50">
                <ChevronRight size={14} className="text-slate-400 transition group-open:rotate-90" />
                <span className="text-sm font-semibold text-slate-800 first-letter:uppercase">{nomeDoMes(p.mes)}</span>
                <span className="text-xs text-slate-500">trabalhou {horas(p.totais.trabalhado)}</span>
                {banco ? (
                  <span className={`text-xs font-semibold tabular-nums ${cor(p.totais.saldo)}`}>saldo {saldoEscrito(p.totais.saldo)}</span>
                ) : (
                  <span className="text-xs tabular-nums text-emerald-700">extras {horas(p.totais.extras50 + p.totais.extras100)}</span>
                )}
                {p.totais.faltas ? <Etiqueta tom="ruim">{p.totais.faltas} falta{p.totais.faltas > 1 ? "s" : ""}</Etiqueta> : null}
                {p.totais.alertas ? <Etiqueta tom="atencao">{p.totais.alertas} alerta{p.totais.alertas > 1 ? "s" : ""}</Etiqueta> : null}
              </summary>
              <DoMes dias={p.dias} totais={p.totais} />
            </details>
          ) : (
            <section key={p.mes} className="rounded-lg border border-slate-200 bg-white">
              <div className="border-b border-slate-100 px-4 py-2">
                <span className="block text-sm font-semibold text-slate-800 first-letter:uppercase">{nomeDoMes(p.mes)}</span>
              </div>
              <DoMes dias={p.dias} totais={p.totais} />
            </section>
          ),
        )}

        {banco ? (
          <Painel
            titulo="Banco de horas"
            descricao={`Saldo dos dias desde ${empresa.inicio.split("-").reverse().join("/")}: ${saldoEscrito(saldo?.dias ?? 0)} · lançamentos: ${saldoEscrito(
              saldo?.lancamentos ?? 0,
            )} · prazo para compensar: ${empresa.validadeBancoMeses} meses.`}
            className="no-print"
          >
            {lancamentos.length > 0 ? (
              <ul className="mb-3 divide-y divide-slate-100 text-xs">
                {lancamentos.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-20 tabular-nums text-slate-500">{l.dia.split("-").reverse().join("/")}</span>
                    <span className={`w-16 text-right font-medium tabular-nums ${cor(l.minutos)}`}>{saldoEscrito(l.minutos)}</span>
                    <span className="flex-1 text-slate-700">{l.descricao}</span>
                    <span className="text-slate-500">{l.criadoPor}</span>
                    <ExcluirLancamento companyId={id} id={l.id} />
                  </li>
                ))}
              </ul>
            ) : null}
            <LancamentoForm companyId={id} colaboradorId={escolhido.id} hoje={hoje} />
          </Painel>
        ) : null}
      </div>
    );

    function DoMes({ dias: doPeriodo, totais }: { dias: DiaNoPonto[]; totais: TotaisDoPonto }) {
      return (
        <div className="border-t border-slate-100">
          <MapaDoMes dias={doPeriodo} />
          <Espelho companyId={id} colaboradorId={escolhido!.id} regime={empresa.regime} dias={doPeriodo} />
          <Totais t={totais} saldoBanco={null} />
          <p className="no-print border-t border-slate-100 px-4 py-2 text-micro text-slate-500">
            Na régua: <span className="inline-block h-2 w-2 rounded-sm bg-slate-200" /> horário previsto,{" "}
            <span className="inline-block h-2 w-2 rounded-sm bg-brand-500" /> trabalhado, <span className="inline-block h-2 w-2 rounded-sm bg-emerald-500" /> hora
            a mais. Passe o mouse no dia para incluir batida ou lançar férias/atestado. Clique numa batida para ver a foto, o local e anular.{" "}
            <span className="rounded bg-amber-50 px-1 text-amber-800">08:00*</span> é batida incluída pelo RH; riscada é anulada. Nada é apagado.
          </p>
        </div>
      );
    }
  }

  /** As colunas dos 6 meses, do mais antigo ao mais novo: o saldo de cada um em barra. */
  function SeisMeses({ porMes }: { porMes: { mes: string; totais: TotaisDoPonto }[] }) {
    const valor = (t: TotaisDoPonto) => (banco ? t.saldo : t.extras50 + t.extras100 - t.debito);
    const maior = Math.max(60, ...porMes.map((p) => Math.abs(valor(p.totais))));
    const soma = porMes.reduce((s, p) => s + valor(p.totais), 0);
    return (
      <Painel
        titulo="Os últimos 6 meses"
        descricao={`${banco ? "Saldo" : "Extras menos atrasos"} somado no período: ${saldoEscrito(soma)}. Clique num mês para abrir o registro dele.`}
        className="no-print"
      >
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {[...porMes].reverse().map((p) => {
            const v = valor(p.totais);
            const altura = `${(Math.abs(v) / maior) * 100}%`;
            return (
              <a key={p.mes} href={`#mes-${p.mes}`} className="group rounded-md border border-slate-100 px-2 py-2 text-center transition hover:border-brand-300 hover:bg-brand-50/40">
                <p className="text-micro font-medium uppercase tracking-wider text-slate-500 group-hover:text-brand-700">{nomeCurto(p.mes)}</p>
                <div className="relative mx-auto my-1.5 h-20 w-6">
                  <span className="absolute inset-x-0 top-1/2 h-px bg-slate-300" />
                  <span
                    className={`absolute inset-x-0 rounded-sm ${v >= 0 ? "bottom-1/2 bg-emerald-500" : "top-1/2 bg-red-500"}`}
                    style={{ height: `calc(${altura} / 2)` }}
                  />
                </div>
                <p className={`text-sm font-semibold tabular-nums ${cor(v)}`}>{saldoEscrito(v)}</p>
                <p className="text-micro tabular-nums text-slate-500">trab. {horas(p.totais.trabalhado)}</p>
                <p className="text-micro tabular-nums text-slate-500">
                  {p.totais.faltas} falta{p.totais.faltas === 1 ? "" : "s"} · {p.totais.alertas} alerta{p.totais.alertas === 1 ? "" : "s"}
                </p>
              </a>
            );
          })}
        </div>
      </Painel>
    );
  }

  /** O mês em calendário: cada dia pintado pelo que aconteceu nele. Clicar leva à linha do dia. */
  function MapaDoMes({ dias: doMes }: { dias: DiaNoPonto[] }) {
    if (doMes.length === 0) return null;
    const vazios = doMes[0].semana;
    const contagem = new Map<Situacao, number>();
    for (const d of doMes) {
      const s = situacao(d, hoje);
      contagem.set(s, (contagem.get(s) ?? 0) + 1);
    }
    return (
      <div className="no-print flex flex-wrap items-start gap-4 border-b border-slate-100 px-4 py-3">
        <div className="grid grid-cols-7 gap-1">
          {DIAS_DA_SEMANA.map((n) => (
            <span key={n} className="w-11 text-center text-micro font-medium uppercase tracking-wider text-slate-400">
              {n}
            </span>
          ))}
          {Array.from({ length: vazios }, (_, i) => (
            <span key={`v${i}`} />
          ))}
          {doMes.map((d) => {
            const s = situacao(d, hoje);
            const baixo =
              s === "ocorrencia" && d.ocorrencia
                ? NOME_NO_CALENDARIO[d.ocorrencia]
                : s === "falta"
                  ? "falta"
                  : s === "fora" || s === "futuro" || s === "livre"
                    ? ""
                    : banco || d.saldo
                      ? saldoEscrito(d.saldo)
                      : horas(d.trabalhado);
            return (
              <a
                key={d.dia}
                href={`#dia-${d.dia}`}
                title={[d.dia.split("-").reverse().join("/"), SITUACAO[s].nome, d.trabalhado ? `trabalhou ${horas(d.trabalhado)}` : null, ...d.alertas]
                  .filter(Boolean)
                  .join(" · ")}
                className={`flex h-11 w-11 flex-col items-center justify-center rounded-md text-center leading-tight transition hover:ring-2 hover:ring-brand-400 ${SITUACAO[s].cor}`}
              >
                <span className="text-xs font-semibold tabular-nums">{Number(d.dia.slice(8))}</span>
                {baixo ? <span className="text-[0.6rem] tabular-nums opacity-90">{baixo}</span> : null}
              </a>
            );
          })}
        </div>
        <ul className="grid gap-1 text-xs text-slate-600">
          {(Object.keys(SITUACAO) as Situacao[])
            .filter((s) => contagem.get(s) && s !== "fora" && s !== "futuro")
            .map((s) => (
              <li key={s} className="flex items-center gap-2">
                <span className={`inline-block h-3.5 w-3.5 rounded ${SITUACAO[s].cor}`} />
                <span>{SITUACAO[s].nome}</span>
                <span className="tabular-nums text-slate-400">{contagem.get(s)}</span>
              </li>
            ))}
        </ul>
      </div>
    );
  }

  // ----------------------------------------------------------- relatório

  async function Relatorio() {
    if (!escolhido) return <Vazio>Cadastre os colaboradores no sistema de ponto para emitir o relatório.</Vazio>;
    const [[calculo], saldo, enviados] = await Promise.all([
      calculosNoPonto(id, primeiroDia, ultimoDia, escolhido.id),
      banco ? saldosNoPonto(id, escolhido.id).then((s) => s[escolhido.id]) : Promise.resolve(null),
      relatoriosNoPonto(id, mes),
    ]);
    const enviado = enviados.find((r) => r.colaboradorId === escolhido.id);
    const quando = (iso: string) =>
      new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

    return (
      <div className="space-y-3">
        {seletorDoColaborador("relatorio", escolhido)}

        <div className="no-print flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
          {enviado ? (
            <span>
              Enviado em {quando(enviado.enviadoEm)}
              {enviado.enviadoPor ? ` por ${enviado.enviadoPor}` : ""} ·{" "}
              {enviado.cienteEm ? (
                <Etiqueta tom="bom">conferido pelo colaborador em {quando(enviado.cienteEm)}</Etiqueta>
              ) : (
                <Etiqueta tom="atencao">aguardando o colaborador conferir</Etiqueta>
              )}
            </span>
          ) : (
            <span>Ainda não enviado ao colaborador.</span>
          )}
          <span className="flex-1" />
          <PrintButton />
          <EnviarRelatorio companyId={id} colaboradorId={escolhido.id} mes={mes} jaEnviado={Boolean(enviado)} />
        </div>

        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-100 px-4 py-3">
            <p className="text-micro font-medium uppercase tracking-wider text-slate-500">Espelho de ponto · {company!.name}</p>
            <h2 className="text-base font-semibold text-slate-900">{escolhido.nome}</h2>
            <p className="text-xs text-slate-500 first-letter:uppercase">{nomeDoMes(mes)}</p>
          </header>
          <table className="w-full text-mini">
            <thead>
              <tr className="border-b border-slate-200 text-left text-micro uppercase tracking-wider text-slate-500">
                <th className="px-3 py-1.5 font-medium">Dia</th>
                <th className="px-3 py-1.5 font-medium">Marcações</th>
                <th className="px-3 py-1.5 text-right font-medium">Trabalhado</th>
                <th className="px-3 py-1.5 text-right font-medium">Extra</th>
                <th className="px-3 py-1.5 text-right font-medium">Atraso/falta</th>
                <th className="px-3 py-1.5 font-medium">Obs.</th>
              </tr>
            </thead>
            <tbody>
              {calculo.dias
                .filter((d) => !d.foraDoPeriodo)
                .map((d) => (
                  <tr key={d.dia} className="border-b border-slate-100">
                    <td className="whitespace-nowrap px-3 py-1 tabular-nums">{d.dia.split("-").reverse().slice(0, 2).join("/")}</td>
                    <td className="px-3 py-1 tabular-nums">
                      {d.marcacoes
                        .filter((m) => !m.anulada)
                        .map((m) => `${relogio(m.minuto)}${m.origem === "MANUAL" ? "*" : ""}`)
                        .join("  ")}
                    </td>
                    <td className="px-3 py-1 text-right tabular-nums">{d.trabalhado ? horas(d.trabalhado) : ""}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{d.emAndamento || !(d.extras50 + d.extras100) ? "" : horas(d.extras50 + d.extras100)}</td>
                    <td className="px-3 py-1 text-right tabular-nums">{d.emAndamento || !d.debito ? "" : horas(d.debito)}</td>
                    <td className="px-3 py-1 text-micro text-slate-600">
                      {[d.ocorrencia ? NOME_DA_OCORRENCIA[d.ocorrencia] : null, ...d.alertas].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
          <Totais t={calculo.totais} saldoBanco={saldo?.total ?? null} />
          <p className="border-t border-slate-100 px-4 py-2 text-micro text-slate-500">* batida incluída pelo RH.</p>
          <div className="hidden grid-cols-2 gap-10 px-6 pb-6 pt-14 text-center text-xs text-slate-600 print:grid">
            <p className="border-t border-slate-400 pt-1">{escolhido.nome}</p>
            <p className="border-t border-slate-400 pt-1">{company!.name}</p>
          </div>
        </section>
      </div>
    );
  }

  // --------------------------------------------------------- ocorrências

  async function Ocorrencias() {
    const lista = await ocorrenciasNoPonto(id, primeiroDia, ultimoDia);
    return (
      <div className="space-y-3">
        <OcorrenciaForm companyId={id} hoje={hoje} pessoas={ativos.map((c) => ({ id: c.id, nome: c.nome }))} />
        <div className="flex items-center justify-between">{navegaMes}</div>
        <Tabela titulo={`Ocorrências de ${nomeDoMes(mes)}`} direita={`${lista.length}`}>
          {lista.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">Nada lançado neste mês.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {lista.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-20 tabular-nums text-slate-500">{o.dia.split("-").reverse().join("/")}</span>
                  <Etiqueta tom={o.tipo === "FERIADO" ? "azul" : "neutro"}>{NOME_DA_OCORRENCIA[o.tipo]}</Etiqueta>
                  <span className="flex-1 text-slate-700">
                    {o.colaborador ?? "Empresa toda"}
                    {o.descricao ? <span className="text-slate-500"> · {o.descricao}</span> : null}
                  </span>
                  <span className="text-slate-500">{o.criadoPor}</span>
                  <ExcluirOcorrencia companyId={id} id={o.id} />
                </li>
              ))}
            </ul>
          )}
        </Tabela>
      </div>
    );
  }

  function Totais({ t, saldoBanco }: { t: Awaited<ReturnType<typeof calculosNoPonto>>[number]["totais"]; saldoBanco: number | null }) {
    return (
      <div className="grid gap-x-6 gap-y-1 border-t border-slate-200 px-4 py-3 text-xs text-slate-600 sm:grid-cols-3">
        <p>Previsto: <b className="tabular-nums">{horas(t.previsto)}</b></p>
        <p>Trabalhado: <b className="tabular-nums">{horas(t.trabalhado)}</b></p>
        <p>Abonado: <b className="tabular-nums">{horas(t.abonado)}</b></p>
        <p>Extras 50%: <b className="tabular-nums text-emerald-700">{horas(t.extras50)}</b></p>
        <p>Extras 100%: <b className="tabular-nums text-emerald-700">{horas(t.extras100)}</b></p>
        <p>Atrasos e saídas antecipadas: <b className="tabular-nums text-red-700">{horas(t.debito)}</b></p>
        <p>Faltas: <b className="tabular-nums">{t.faltas}</b></p>
        {banco ? <p>Saldo do mês: <b className={`tabular-nums ${cor(t.saldo)}`}>{saldoEscrito(t.saldo)}</b></p> : null}
        {saldoBanco !== null ? <p>Banco de horas: <b className={`tabular-nums ${cor(saldoBanco)}`}>{saldoEscrito(saldoBanco)}</b></p> : null}
      </div>
    );
  }
}

function cor(minutos: number) {
  return minutos > 0 ? "text-emerald-700" : minutos < 0 ? "text-red-700" : "text-slate-500";
}

function nomeCurto(mes: string) {
  return nomeDoMes(mes).replace(" de ", "/");
}

function Iniciais({ nome, grande = false }: { nome: string; grande?: boolean }) {
  const partes = nome.trim().split(/\s+/);
  const letras = `${partes[0]?.[0] ?? ""}${partes.length > 1 ? partes.at(-1)![0] : ""}`.toUpperCase();
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-800 ${
        grande ? "h-11 w-11 text-sm" : "h-8 w-8 text-xs"
      }`}
      aria-hidden
    >
      {letras}
    </span>
  );
}

/** A caixa do número grande no topo do ponto da pessoa. */
function Destaque({ rotulo, valor, detalhe }: { rotulo: string; valor: number; detalhe?: string }) {
  const fundo = valor > 0 ? "border-emerald-200 bg-emerald-50/60" : valor < 0 ? "border-red-200 bg-red-50/60" : "border-slate-200 bg-slate-50";
  return (
    <div className={`min-w-[10rem] rounded-lg border px-3 py-2 ${fundo}`}>
      <p className="text-micro font-medium uppercase tracking-wider text-slate-500">{rotulo}</p>
      <p className={`text-2xl font-semibold leading-tight tabular-nums ${cor(valor)}`}>{saldoEscrito(valor)}</p>
      {detalhe ? <p className="text-micro text-slate-500">{detalhe}</p> : null}
    </div>
  );
}

const NOME_NO_CALENDARIO: Record<keyof typeof NOME_DA_OCORRENCIA, string> = {
  FERIADO: "Feriado",
  FERIAS: "Férias",
  FOLGA: "Folga",
  ABONO: "Abono",
  ATESTADO: "Atest.",
};

type Situacao = "ok" | "extra" | "devendo" | "falta" | "alerta" | "ocorrencia" | "livre" | "hoje" | "futuro" | "fora";

const SITUACAO: Record<Situacao, { nome: string; cor: string }> = {
  ok: { nome: "Cumpriu o horário", cor: "bg-emerald-100 text-emerald-800" },
  extra: { nome: "Fez hora a mais", cor: "bg-emerald-500 text-white" },
  devendo: { nome: "Atraso ou saída cedo", cor: "bg-red-100 text-red-800" },
  falta: { nome: "Falta", cor: "bg-red-500 text-white" },
  alerta: { nome: "Batida faltando ou alerta", cor: "bg-amber-200 text-amber-900" },
  ocorrencia: { nome: "Férias, atestado, folga, feriado", cor: "bg-brand-100 text-brand-800" },
  livre: { nome: "Sem expediente", cor: "bg-slate-100 text-slate-400" },
  hoje: { nome: "Hoje", cor: "bg-white text-brand-800 ring-2 ring-brand-500" },
  futuro: { nome: "Ainda não chegou", cor: "border border-dashed border-slate-200 text-slate-300" },
  fora: { nome: "Fora do período", cor: "text-slate-300" },
};

function situacao(d: DiaNoPonto, hoje: string): Situacao {
  if (d.foraDoPeriodo) return "fora";
  if (d.dia > hoje) return d.ocorrencia ? "ocorrencia" : "futuro";
  if (d.emAndamento) return "hoje";
  if (d.falta) return "falta";
  if (d.ocorrencia) return "ocorrencia";
  if (d.alertas.length) return "alerta";
  if (!d.previsto && !d.trabalhado) return "livre";
  if (d.saldo > 0) return "extra";
  if (d.saldo < 0 || d.debito > 0) return "devendo";
  return "ok";
}
