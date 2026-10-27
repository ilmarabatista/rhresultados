import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";
import { todayKey } from "@/lib/dates";
import { diasDoMes, mesLiberado, nomeDoMes, saldoEscrito } from "@/lib/calculo";
import { montarRelatorio, mesesDoColaborador, type DadosDoRelatorio } from "@/lib/relatorio";
import { EspelhoDoRelatorio } from "@/components/espelho";
import { AprovarMes } from "@/components/aprovar";
import { Cartao, Etiqueta, Topo } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Meu ponto — Ponto" };

const FORMATO = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

/**
 * O espelho de ponto e o banco de horas do próprio colaborador, a qualquer
 * momento. No último dia do mês ele aprova o mês com uma foto.
 */
export default async function MeuPontoPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const s = await exigirColaborador();
  const sp = await searchParams;
  const hoje = todayKey();
  const meses = await mesesDoColaborador(s.id);
  const mes = sp.mes && meses.includes(sp.mes) ? sp.mes : (meses[0] ?? hoje.slice(0, 7));
  const i = meses.indexOf(mes);
  const anterior = meses[i + 1];
  const seguinte = i > 0 ? meses[i - 1] : undefined;

  const [empresa, relatorio, aprovacoes] = await Promise.all([
    prisma.empresa.findUniqueOrThrow({ where: { id: s.empresa.id } }),
    prisma.relatorio.findUnique({ where: { colaboradorId_mes: { colaboradorId: s.id, mes } }, select: { dados: true, cienteEm: true, enviadoEm: true } }),
    prisma.relatorio.findMany({ where: { colaboradorId: s.id, mes: { in: meses } }, select: { mes: true, cienteEm: true } }),
  ]);
  const aprovado = relatorio?.cienteEm ?? null;
  // Mês aprovado mostra o que a pessoa aprovou; os outros, o ponto de agora.
  const atual = await montarRelatorio(empresa, s.id, mes);
  const espelho = aprovado ? (relatorio!.dados as unknown as DadosDoRelatorio) : atual;
  const podeAprovar = !aprovado && (mesLiberado(mes, hoje) || Boolean(relatorio));
  const ultimoDia = diasDoMes(mes).at(-1)!.split("-").reverse().slice(0, 2).join("/");
  const statusDo = new Map(aprovacoes.map((r) => [r.mes, r.cienteEm]));

  return (
    <>
      <div className="print:hidden">
        <Topo
          titulo="Ponto"
          nome={s.nome}
          links={[
            { href: "/", rotulo: "Registrar" },
            { href: "/folgas", rotulo: "Folgas" },
            { href: "/trocar-senha", rotulo: "Senha" },
          ]}
        />
      </div>
      <main className="mx-auto max-w-3xl space-y-4 px-4 py-6 print:p-0">
        <div className="print:hidden">
          <p className="text-sm text-slate-500">{s.empresa.nome}</p>
          <h1 className="text-xl font-semibold text-slate-900">Meu ponto</h1>
        </div>

        {atual?.saldoBanco !== null && atual?.saldoBanco !== undefined ? (
          <Cartao className="print:hidden">
            <p className="text-sm text-slate-600">Meu banco de horas hoje</p>
            <p className={`text-3xl font-semibold tabular-nums ${atual.saldoBanco > 0 ? "text-emerald-700" : atual.saldoBanco < 0 ? "text-red-700" : "text-slate-900"}`}>
              {saldoEscrito(atual.saldoBanco)}
            </p>
            <p className="mt-1 text-xs text-slate-500">Positivo são horas a mais que você tem para folgar; negativo, horas que faltam.</p>
          </Cartao>
        ) : null}

        <nav className="flex items-center justify-between gap-2 print:hidden" aria-label="Escolher o mês">
          {anterior ? (
            <Link href={`/meu-ponto?mes=${anterior}`} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:text-marca-700">
              ‹ <span className="inline-block first-letter:uppercase">{nomeDoMes(anterior).split(" ")[0]}</span>
            </Link>
          ) : (
            <span />
          )}
          <span className="text-center font-medium text-slate-800 first-letter:uppercase">{nomeDoMes(mes)}</span>
          {seguinte ? (
            <Link href={`/meu-ponto?mes=${seguinte}`} className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-600 hover:text-marca-700">
              <span className="inline-block first-letter:uppercase">{nomeDoMes(seguinte).split(" ")[0]}</span> ›
            </Link>
          ) : (
            <span />
          )}
        </nav>

        <Cartao className="print:hidden">
          {aprovado ? (
            <div className="flex flex-wrap items-center gap-2">
              <Etiqueta tom="bom">aprovado</Etiqueta>
              <p className="text-sm text-emerald-800">Você conferiu e aprovou este mês em {FORMATO.format(aprovado)}, com foto.</p>
            </div>
          ) : podeAprovar ? (
            <div className="space-y-3">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Confira e aprove o seu mês</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Confira os dias e as horas abaixo. Estando tudo certo, toque em Conferi e aprovo e tire uma foto sua: ela fica com o RH como
                  comprovante. Se algo estiver errado, fale com o RH antes de aprovar.
                </p>
              </div>
              <AprovarMes mes={mes} />
            </div>
          ) : (
            <p className="text-sm text-slate-600">
              Mês em andamento. No dia {ultimoDia}, último dia do mês, ele fica disponível para você conferir e aprovar.
            </p>
          )}
        </Cartao>

        {espelho ? <EspelhoDoRelatorio d={espelho} /> : null}

        {meses.length > 1 ? (
          <Cartao titulo="Meses" className="print:hidden">
            <ul className="divide-y divide-slate-100">
              {meses.map((m) => {
                const ok = statusDo.get(m);
                return (
                  <li key={m}>
                    <Link href={`/meu-ponto?mes=${m}`} className="flex items-center justify-between py-2.5 hover:text-marca-700">
                      <span className={`inline-block first-letter:uppercase ${m === mes ? "font-semibold" : ""}`}>{nomeDoMes(m)}</span>
                      {ok ? (
                        <Etiqueta tom="bom">aprovado</Etiqueta>
                      ) : mesLiberado(m, hoje) || statusDo.has(m) ? (
                        <Etiqueta tom="atencao">aprovar</Etiqueta>
                      ) : (
                        <Etiqueta>em andamento</Etiqueta>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Cartao>
        ) : null}
      </main>
    </>
  );
}
