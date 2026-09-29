import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey, dayKeyToDate, formatFullDate, formatMoment, todayKey } from "@/lib/dates";
import {
  cargaSemanal,
  diasDoMes,
  horas,
  NOME_DA_OCORRENCIA,
  nomeDoMes,
  outroMes,
  saldoEscrito,
  jornadaDaPessoa,
} from "@/lib/ponto";
import {
  calcularPessoas,
  configDoPonto,
  pessoasDoPonto,
  presentesAgora,
  saldosDoBanco,
} from "@/lib/ponto-dados";
import { Aviso, Etiqueta, Filtros, Numeros, Painel, Tabela, TituloDaSecao, Vazio } from "@/components/ui";
import PrintButton from "@/components/print-button";
import {
  AtivarPonto,
  ConfigForm,
  Espelho,
  ExcluirLancamento,
  ExcluirOcorrencia,
  ImportarAfd,
  LancamentoForm,
  LinkDoPonto,
  OcorrenciaForm,
  PessoaPonto,
} from "@/components/ponto-painel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Ponto — RH Resultados" };

const VISOES = [
  ["resumo", "Resumo do mês"],
  ["espelho", "Espelho"],
  ["pessoas", "Pessoas e PIN"],
  ["ocorrencias", "Feriados e ocorrências"],
  ["importar", "Importar AFD"],
  ["regras", "Regras"],
] as const;
type Visao = (typeof VISOES)[number][0];

export default async function PontoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ver?: string; mes?: string; pessoa?: string }>;
}) {
  await requireSession();
  const { id } = await params;
  const sp = await searchParams;

  const company = await prisma.company.findUnique({ where: { id }, select: { id: true, name: true } });
  if (!company) notFound();

  const config = await configDoPonto(id);
  if (!config) {
    return (
      <main className="space-y-3.5">
        <TituloDaSecao antes="Ponto" destaque="Eletrônico" />
        <Vazio acao={<AtivarPonto companyId={id} />}>
          O ponto desta empresa ainda não está ligado. Ao ativar, ela ganha um link próprio de registro
          (para tablet ou celular) e regras próprias: banco de horas ou horas extras, jornada e tolerância.
        </Vazio>
      </main>
    );
  }

  const hoje = todayKey();
  const mes = /^\d{4}-\d{2}$/.test(sp.mes ?? "") ? sp.mes! : hoje.slice(0, 7);
  const visao: Visao = VISOES.some(([v]) => v === sp.ver) ? (sp.ver as Visao) : "resumo";
  const banco = config.regime === "BANCO_DE_HORAS";

  const todas = await pessoasDoPonto(id);
  const noPonto = todas.filter((p) => p.status !== "DESLIGADO" || p.desligamento);
  const habilitadas = todas.filter((p) => p.temPin && p.status !== "DESLIGADO").length;
  const agora = await presentesAgora(id);

  const href = (mudar: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const final = { ver: visao, mes, pessoa: sp.pessoa, ...mudar };
    for (const [k, v] of Object.entries(final)) if (v) q.set(k, v);
    return `/empresas/${id}/ponto?${q.toString()}`;
  };

  const navegaMes = (
    <div className="no-print flex items-center gap-1 text-xs">
      <Link href={href({ mes: outroMes(mes, -1) })} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:text-brand-700">
        ‹
      </Link>
      <span className="min-w-[8.5rem] text-center font-medium capitalize text-slate-700">{nomeDoMes(mes)}</span>
      <Link href={href({ mes: outroMes(mes, 1) })} className="rounded-md border border-slate-200 bg-white px-2 py-1 text-slate-600 hover:text-brand-700">
        ›
      </Link>
    </div>
  );

  const dias = diasDoMes(mes);
  const primeiroDia = dias[0];
  const ultimoDia = dias.at(-1)!;

  return (
    <main className="space-y-3.5">
      <div className="no-print">
        <TituloDaSecao antes="Ponto" destaque="Eletrônico" />
        <Numeros
          colunas={4}
          itens={[
            {
              rotulo: "Regime",
              valor: banco ? "Banco de horas" : "Horas extras",
              detalhe: `${horas(cargaSemanal(config.jornada))} semanais · tolerância ${config.tolerancia} min`,
            },
            {
              rotulo: "Batem ponto",
              valor: habilitadas,
              detalhe: `de ${todas.filter((p) => p.status !== "DESLIGADO").length} na equipe`,
              tom: habilitadas === 0 ? "atencao" : "neutro",
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

      <div className="no-print rounded-lg border border-slate-200 bg-white px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Link do registro</span>
          {config.ativo ? null : <Etiqueta tom="ruim">desligado</Etiqueta>}
          <LinkDoPonto companyId={id} caminho={`/ponto/${config.token}`} />
        </div>
        <p className="mt-1 text-[11px] text-slate-400">
          Deixe aberto num tablet na entrada ou mande para cada pessoa abrir no celular. Ela entra com CPF e PIN.
        </p>
      </div>

      {habilitadas === 0 ? (
        <div className="no-print">
          <Aviso rotulo="Para começar">
            Ninguém tem PIN ainda. Em <Link className="underline" href={href({ ver: "pessoas" })}>Pessoas e PIN</Link>, libere o
            ponto de cada pessoa (CPF + PIN). As pessoas vêm da aba Equipe.
          </Aviso>
        </div>
      ) : null}

      <div className="no-print">
        <Filtros itens={VISOES.map(([v, rotulo]) => ({ rotulo, href: href({ ver: v }), ativo: v === visao }))} />
      </div>

      {visao === "resumo" ? (
        <Resumo />
      ) : visao === "espelho" ? (
        <EspelhoDaPessoa />
      ) : visao === "pessoas" ? (
        <Pessoas />
      ) : visao === "ocorrencias" ? (
        <Ocorrencias />
      ) : visao === "importar" ? (
        <ImportarAfd companyId={id} />
      ) : (
        <ConfigForm
          companyId={id}
          config={{
            regime: config.regime,
            jornada: config.jornada,
            tolerancia: config.tolerancia,
            intervaloMinimo: config.intervaloMinimo,
            validadeBancoMeses: config.validadeBancoMeses,
            inicio: dateToDayKey(config.inicio),
            ativo: config.ativo,
          }}
        />
      )}
    </main>
  );

  // ------------------------------------------------------------- resumo

  async function Resumo() {
    const calculos = await calcularPessoas(id, config!, noPonto, primeiroDia, ultimoDia);
    const comDados = calculos.filter((c) => c.dias.some((d) => !d.foraDoPeriodo));
    const saldos = banco ? await saldosDoBanco(id, config!, noPonto) : null;

    const soma = comDados.reduce(
      (s, c) => ({
        trabalhado: s.trabalhado + c.totais.trabalhado,
        extras50: s.extras50 + c.totais.extras50,
        extras100: s.extras100 + c.totais.extras100,
        debito: s.debito + c.totais.debito,
        faltas: s.faltas + c.totais.faltas,
        alertas: s.alertas + c.totais.alertas,
      }),
      { trabalhado: 0, extras50: 0, extras100: 0, debito: 0, faltas: 0, alertas: 0 },
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
            banco
              ? { rotulo: "Saldo do mês", valor: saldoEscrito(comDados.reduce((s, c) => s + c.totais.saldo, 0)) }
              : { rotulo: "Extras 50% / 100%", valor: `${horas(soma.extras50)} / ${horas(soma.extras100)}` },
            { rotulo: "Faltas", valor: soma.faltas, tom: soma.faltas ? "ruim" : "neutro", detalhe: `atrasos e saídas: ${horas(soma.debito)}` },
            { rotulo: "Alertas", valor: soma.alertas, tom: soma.alertas ? "atencao" : "bom", detalhe: "batida ímpar, intervalo, descanso" },
          ]}
        />

        <Tabela titulo={`Resumo de ${nomeDoMes(mes)}`} minLargura={760}>
          {comDados.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">Ninguém no ponto neste mês.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-3 py-1.5 font-medium">Pessoa</th>
                  <th className="px-2 py-1.5 text-right font-medium">Previsto</th>
                  <th className="px-2 py-1.5 text-right font-medium">Trabalhado</th>
                  {banco ? (
                    <>
                      <th className="px-2 py-1.5 text-right font-medium">Saldo do mês</th>
                      <th className="px-2 py-1.5 text-right font-medium">Banco até ontem</th>
                    </>
                  ) : (
                    <>
                      <th className="px-2 py-1.5 text-right font-medium">Extra 50%</th>
                      <th className="px-2 py-1.5 text-right font-medium">Extra 100%</th>
                      <th className="px-2 py-1.5 text-right font-medium">Atraso/saída</th>
                    </>
                  )}
                  <th className="px-2 py-1.5 text-right font-medium">Faltas</th>
                  <th className="px-2 py-1.5 text-right font-medium">Alertas</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {comDados.map((c) => {
                  const saldo = saldos?.get(c.pessoa.id)?.total ?? 0;
                  return (
                    <tr key={c.pessoa.id} className="border-b border-slate-100 last:border-b-0 even:bg-slate-50/60">
                      <td className="px-3 py-1.5">
                        <span className="font-medium text-slate-800">{c.pessoa.nome}</span>
                        {!c.pessoa.temPin ? <span className="ml-1.5"><Etiqueta tom="atencao">sem PIN</Etiqueta></span> : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{horas(c.totais.previsto)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{horas(c.totais.trabalhado)}</td>
                      {banco ? (
                        <>
                          <td className={`px-2 py-1.5 text-right tabular-nums ${cor(c.totais.saldo)}`}>{saldoEscrito(c.totais.saldo)}</td>
                          <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${cor(saldo)}`}>{saldoEscrito(saldo)}</td>
                        </>
                      ) : (
                        <>
                          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{horas(c.totais.extras50)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{horas(c.totais.extras100)}</td>
                          <td className="px-2 py-1.5 text-right tabular-nums text-red-700">{horas(c.totais.debito)}</td>
                        </>
                      )}
                      <td className={`px-2 py-1.5 text-right tabular-nums ${c.totais.faltas ? "text-red-700" : "text-slate-400"}`}>{c.totais.faltas}</td>
                      <td className={`px-2 py-1.5 text-right tabular-nums ${c.totais.alertas ? "text-amber-700" : "text-slate-400"}`}>{c.totais.alertas}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Link href={href({ ver: "espelho", pessoa: c.pessoa.id })} className="text-[11px] text-brand-700 hover:text-brand-900">
                          espelho ›
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Tabela>

        {agora.presentes.length > 0 ? (
          <Painel titulo="Dentro agora">
            <ul className="flex flex-wrap gap-2 text-xs text-slate-600">
              {agora.presentes.map((p) => (
                <li key={p.nome} className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">
                  {p.nome} · desde {new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }).format(p.desde)}
                </li>
              ))}
            </ul>
          </Painel>
        ) : null}
      </div>
    );
  }

  // ------------------------------------------------------------ espelho

  async function EspelhoDaPessoa() {
    const escolhida = noPonto.find((p) => p.id === sp.pessoa) ?? noPonto.find((p) => p.temPin) ?? noPonto[0];
    if (!escolhida) {
      return <Vazio>Cadastre as pessoas na aba Equipe para ver o espelho de ponto.</Vazio>;
    }

    const [calculo] = await calcularPessoas(id, config!, [escolhida], primeiroDia, ultimoDia);
    const saldo = banco ? (await saldosDoBanco(id, config!, [escolhida])).get(escolhida.id) : null;
    const lancamentos = banco
      ? await prisma.pontoLancamento.findMany({
          where: { employeeId: escolhida.id },
          orderBy: { dia: "desc" },
          take: 20,
        })
      : [];
    const t = calculo.totais;
    const jornada = jornadaDaPessoa(config!.jornada, escolhida.jornada);

    return (
      <div className="space-y-3">
        <form method="get" className="no-print flex flex-wrap items-center gap-2">
          <input type="hidden" name="ver" value="espelho" />
          <input type="hidden" name="mes" value={mes} />
          <select name="pessoa" defaultValue={escolhida.id} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm">
            {noPonto.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nome}
                {p.status === "DESLIGADO" ? " (desligado)" : ""}
              </option>
            ))}
          </select>
          <button type="submit" className="rounded-md bg-brand-700 px-2.5 py-1 text-xs font-medium text-white">
            Ver
          </button>
          <span className="flex-1" />
          {navegaMes}
          <PrintButton />
        </form>

        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Espelho de ponto · {company!.name}</p>
              <h2 className="text-base font-semibold text-slate-900">{escolhida.nome}</h2>
              <p className="text-xs text-slate-500">
                {[escolhida.cargo, escolhida.documento ? `CPF ${escolhida.documento}` : null, `jornada de ${horas(cargaSemanal(jornada))}/semana`]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <p className="text-sm font-medium capitalize text-slate-700">{nomeDoMes(mes)}</p>
          </header>

          <Espelho
            companyId={id}
            employeeId={escolhida.id}
            regime={config!.regime}
            dias={calculo.dias.map((d) => ({
              dia: d.dia,
              semana: d.semana,
              marcacoes: d.marcacoes,
              ocorrencia: d.ocorrencia,
              ocorrenciaId: d.ocorrenciaId,
              ocorrenciaDescricao: d.ocorrenciaDescricao,
              previsto: d.previsto,
              trabalhado: d.trabalhado,
              abonado: d.abonado,
              saldo: d.saldo,
              extras50: d.extras50,
              extras100: d.extras100,
              alertas: d.alertas,
              emAndamento: d.emAndamento,
              foraDoPeriodo: d.foraDoPeriodo,
            }))}
          />

          <div className="grid gap-x-6 gap-y-1 border-t border-slate-200 px-4 py-3 text-xs text-slate-600 sm:grid-cols-3">
            <p>Previsto: <b className="tabular-nums">{horas(t.previsto)}</b></p>
            <p>Trabalhado: <b className="tabular-nums">{horas(t.trabalhado)}</b></p>
            <p>Abonado: <b className="tabular-nums">{horas(t.abonado)}</b></p>
            {banco ? (
              <>
                <p>Saldo do mês: <b className={`tabular-nums ${cor(t.saldo)}`}>{saldoEscrito(t.saldo)}</b></p>
                <p>
                  Banco de horas até ontem:{" "}
                  <b className={`tabular-nums ${cor(saldo?.total ?? 0)}`}>{saldoEscrito(saldo?.total ?? 0)}</b>
                </p>
              </>
            ) : (
              <>
                <p>Extras 50%: <b className="tabular-nums text-emerald-700">{horas(t.extras50)}</b></p>
                <p>Extras 100%: <b className="tabular-nums text-emerald-700">{horas(t.extras100)}</b></p>
                <p>Atrasos e saídas antecipadas: <b className="tabular-nums text-red-700">{horas(t.debito)}</b></p>
              </>
            )}
            <p>Faltas: <b className="tabular-nums">{t.faltas}</b></p>
          </div>

          <p className="no-print border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            Passe o mouse numa batida para ver a origem e anular. <span className="rounded bg-amber-50 px-1 text-amber-800">08:00*</span> é
            batida incluída pelo RH; riscada é anulada. Nada é apagado.
          </p>

          <div className="hidden grid-cols-2 gap-10 px-6 pb-6 pt-14 text-center text-xs text-slate-600 print:grid">
            <p className="border-t border-slate-400 pt-1">{escolhida.nome}</p>
            <p className="border-t border-slate-400 pt-1">{company!.name}</p>
          </div>
        </section>

        {banco ? (
          <Painel
            titulo="Banco de horas"
            descricao={`Saldo dos dias desde ${formatFullDate(config!.inicio)}: ${saldoEscrito(saldo?.dias ?? 0)} · lançamentos: ${saldoEscrito(
              saldo?.lancamentos ?? 0,
            )} · prazo para compensar: ${config!.validadeBancoMeses} meses.`}
            className="no-print"
          >
            {lancamentos.length > 0 ? (
              <ul className="mb-3 divide-y divide-slate-100 text-xs">
                {lancamentos.map((l) => (
                  <li key={l.id} className="flex items-center gap-3 py-1.5">
                    <span className="w-20 tabular-nums text-slate-500">{formatFullDate(l.dia)}</span>
                    <span className={`w-16 text-right font-medium tabular-nums ${cor(l.minutos)}`}>{saldoEscrito(l.minutos)}</span>
                    <span className="flex-1 text-slate-700">{l.descricao}</span>
                    <span className="text-slate-400">{l.criadoPor}</span>
                    <ExcluirLancamento id={l.id} />
                  </li>
                ))}
              </ul>
            ) : null}
            <LancamentoForm employeeId={escolhida.id} hoje={hoje} />
          </Painel>
        ) : null}
      </div>
    );
  }

  // ------------------------------------------------------------- pessoas

  function Pessoas() {
    const ativos = todas.filter((p) => p.status !== "DESLIGADO");
    if (ativos.length === 0) {
      return (
        <Vazio acao={<Link href={`/empresas/${id}/equipe`} className="text-sm text-brand-700 underline">Ir para Equipe</Link>}>
          Ninguém na equipe desta empresa ainda.
        </Vazio>
      );
    }
    return (
      <Tabela titulo="Quem bate ponto" direita={`${habilitadas} com PIN`}>
        {ativos.map((p) => (
          <PessoaPonto
            key={p.id}
            jornadaDaEmpresa={config!.jornada}
            pessoa={{ id: p.id, nome: p.nome, cargo: p.cargo, documento: p.documento, status: p.status, temPin: p.temPin, jornada: p.jornada }}
          />
        ))}
      </Tabela>
    );
  }

  // --------------------------------------------------------- ocorrências

  async function Ocorrencias() {
    const lista = await prisma.pontoOcorrencia.findMany({
      where: { companyId: id, dia: { gte: dayKeyToDate(primeiroDia), lte: dayKeyToDate(ultimoDia) } },
      orderBy: [{ dia: "asc" }],
      include: { employee: { select: { name: true } } },
    });

    return (
      <div className="space-y-3">
        <OcorrenciaForm
          companyId={id}
          hoje={hoje}
          pessoas={todas.filter((p) => p.status !== "DESLIGADO").map((p) => ({ id: p.id, nome: p.nome }))}
        />
        <div className="flex items-center justify-between">{navegaMes}</div>
        <Tabela titulo={`Ocorrências de ${nomeDoMes(mes)}`} direita={`${lista.length}`}>
          {lista.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">Nada lançado neste mês.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-xs">
              {lista.map((o) => (
                <li key={o.id} className="flex items-center gap-3 px-3 py-1.5">
                  <span className="w-20 tabular-nums text-slate-500">{formatFullDate(o.dia)}</span>
                  <Etiqueta tom={o.tipo === "FERIADO" ? "azul" : "neutro"}>{NOME_DA_OCORRENCIA[o.tipo]}</Etiqueta>
                  <span className="flex-1 text-slate-700">
                    {o.employee?.name ?? "Empresa toda"}
                    {o.descricao ? <span className="text-slate-400"> · {o.descricao}</span> : null}
                  </span>
                  <span className="text-slate-400">{o.criadoPor ? `${o.criadoPor}, ${formatMoment(o.createdAt)}` : null}</span>
                  <ExcluirOcorrencia id={o.id} />
                </li>
              ))}
            </ul>
          )}
        </Tabela>
      </div>
    );
  }
}

function cor(minutos: number) {
  return minutos > 0 ? "text-emerald-700" : minutos < 0 ? "text-red-700" : "text-slate-400";
}
