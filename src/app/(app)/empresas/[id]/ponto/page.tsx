import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { todayKey } from "@/lib/dates";
import {
  cargaSemanal,
  diasDoMes,
  horarioDaPessoa,
  horas,
  NOME_DA_OCORRENCIA,
  nomeDoMes,
  outroMes,
  relogio,
  saldoEscrito,
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
  searchParams: Promise<{ ver?: string; mes?: string; colaborador?: string }>;
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

  const href = (mudar: Record<string, string | undefined>) => {
    const q = new URLSearchParams();
    const final = { ver: visao, mes, colaborador: sp.colaborador, ...mudar };
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

        <Tabela titulo={`Colaboradores em ${nomeDoMes(mes)}`} minLargura={760}>
          {lista.length === 0 ? (
            <p className="px-3 py-4 text-sm text-slate-500">Ninguém no ponto neste mês.</p>
          ) : (
            <table className="w-full text-mini">
              <thead>
                <tr className="border-b border-slate-200 text-left text-micro uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-1.5 font-medium">Colaborador</th>
                  <th className="px-2 py-1.5 text-right font-medium">Previsto</th>
                  <th className="px-2 py-1.5 text-right font-medium">Trabalhado</th>
                  <th className="px-2 py-1.5 text-right font-medium">Extra 50%</th>
                  <th className="px-2 py-1.5 text-right font-medium">Extra 100%</th>
                  <th className="px-2 py-1.5 text-right font-medium">Atraso/falta</th>
                  {banco ? <th className="px-2 py-1.5 text-right font-medium">Banco</th> : null}
                  <th className="px-2 py-1.5 text-right font-medium">Alertas</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody>
                {lista.map((c) => {
                  const saldo = saldos?.[c.pessoa.id]?.total ?? 0;
                  return (
                    <tr key={c.pessoa.id} className="border-b border-slate-100 last:border-b-0 even:bg-slate-50/60">
                      <td className="px-3 py-1.5">
                        <Link href={href({ ver: "horarios", colaborador: c.pessoa.id })} className="font-medium text-slate-800 hover:text-brand-700">
                          {c.pessoa.nome}
                        </Link>
                        {c.pessoa.nome !== c.pessoa.email ? <span className="ml-1.5 text-micro text-slate-500">{c.pessoa.email}</span> : null}
                        {!c.pessoa.ativo ? (
                          <span className="ml-1.5"><Etiqueta>desativado</Etiqueta></span>
                        ) : c.pessoa.trocarSenha ? (
                          <span className="ml-1.5"><Etiqueta tom="atencao">sem 1º acesso</Etiqueta></span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{horas(c.totais.previsto)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{horas(c.totais.trabalhado)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{horas(c.totais.extras50)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{horas(c.totais.extras100)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-red-700">
                        {horas(c.totais.debito)}
                        {c.totais.faltas ? <span className="ml-1 text-micro">({c.totais.faltas} falta{c.totais.faltas > 1 ? "s" : ""})</span> : null}
                      </td>
                      {banco ? <td className={`px-2 py-1.5 text-right font-semibold tabular-nums ${cor(saldo)}`}>{saldoEscrito(saldo)}</td> : null}
                      <td className={`px-2 py-1.5 text-right tabular-nums ${c.totais.alertas ? "text-amber-700" : "text-slate-500"}`}>{c.totais.alertas}</td>
                      <td className="px-2 py-1.5 text-right">
                        <Link href={href({ ver: "horarios", colaborador: c.pessoa.id })} className="text-micro text-brand-700 hover:text-brand-900">
                          horários ›
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

  // ------------------------------------------------------------ horários

  async function Horarios() {
    if (!escolhido) return <Vazio>Cadastre os colaboradores no sistema de ponto para ver os horários.</Vazio>;

    const [[calculo], saldo, lancamentos] = await Promise.all([
      calculosNoPonto(id, primeiroDia, ultimoDia, escolhido.id),
      banco ? saldosNoPonto(id, escolhido.id).then((s) => s[escolhido.id]) : Promise.resolve(null),
      banco ? lancamentosNoPonto(id, escolhido.id) : Promise.resolve([]),
    ]);
    const t = calculo.totais;
    const horario = horarioDaPessoa(empresa.horario, escolhido.horario);

    return (
      <div className="space-y-3">
        {seletorDoColaborador("horarios", escolhido)}

        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-micro font-medium uppercase tracking-wider text-slate-500">Horários · {company!.name}</p>
              <h2 className="text-base font-semibold text-slate-900">{escolhido.nome}</h2>
              <p className="text-xs text-slate-500">
                {[escolhido.email, `${horas(cargaSemanal(horario))} semanais${escolhido.horario ? " (horário próprio)" : ""}`].join(" · ")}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <HorarioDoColaborador
                companyId={id}
                colaborador={{ id: escolhido.id, horario: escolhido.horario, admissao: escolhido.admissao }}
                horarioDaEmpresa={empresa.horario}
              />
              <Link href={href({ ver: "relatorio", colaborador: escolhido.id })} className="text-xs text-brand-700 underline">
                Relatório do mês
              </Link>
            </div>
          </header>

          <Espelho companyId={id} colaboradorId={escolhido.id} regime={empresa.regime} dias={calculo.dias} />

          <Totais t={t} saldoBanco={saldo?.total ?? null} />

          <p className="no-print border-t border-slate-100 px-4 py-2 text-micro text-slate-500">
            Clique numa batida para ver a foto, o local e anular. <span className="rounded bg-amber-50 px-1 text-amber-800">08:00*</span> é batida
            incluída pelo RH; riscada é anulada. Nada é apagado.
          </p>
        </section>

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
            <p className="text-xs capitalize text-slate-500">{nomeDoMes(mes)}</p>
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

