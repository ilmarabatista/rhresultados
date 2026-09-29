import Link from "next/link";
import { Plus } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { formatMoment } from "@/lib/dates";
import { lerResultadoDisc, DESCRICOES } from "@/lib/disc";
import { lerResultadoCadastrado } from "@/lib/testes-cadastrados";
import { Etiqueta, Filtros, Numeros, Tabela, TituloDaSecao, Vazio } from "@/components/ui";
import { AcoesDoEnvio, EnviarTeste } from "@/components/testes-painel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Testes — RH Resultados" };

/**
 * A aba Testes: enviar um teste por link e acompanhar quem respondeu. Os
 * testes disponíveis são o DISC da consultoria e os cadastrados aqui mesmo.
 */
export default async function TestesPage({
  searchParams,
}: {
  searchParams: Promise<{ ver?: string; empresa?: string }>;
}) {
  await requireSession();
  const { ver, empresa } = await searchParams;
  const verCadastrados = ver === "cadastrados";

  const [cadastrados, empresas, envios] = await Promise.all([
    prisma.customTest.findMany({
      orderBy: [{ active: "desc" }, { name: "asc" }],
      include: { _count: { select: { testeEnviados: true } } },
    }),
    prisma.company.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.testeEnviado.findMany({
      where: empresa ? { companyId: empresa } : undefined,
      orderBy: { enviadoEm: "desc" },
      take: 300,
      select: {
        id: true,
        token: true,
        tipo: true,
        nomeDoTeste: true,
        pessoa: true,
        telefone: true,
        status: true,
        resultado: true,
        enviadoEm: true,
        respondidoEm: true,
        company: { select: { name: true } },
      },
    }),
  ]);

  const disponiveis = [
    { id: "DISC", nome: "Perfil comportamental (DISC)" },
    ...cadastrados.filter((t) => t.active).map((t) => ({ id: t.id, nome: t.name })),
  ];
  const respondidos = envios.filter((e) => e.status === "RESPONDIDO").length;

  const abas = (
    <Filtros
      itens={[
        { rotulo: "Envios e respostas", href: "/testes", ativo: !verCadastrados, contagem: envios.length },
        { rotulo: "Testes cadastrados", href: "/testes?ver=cadastrados", ativo: verCadastrados, contagem: cadastrados.length + 1 },
      ]}
    />
  );

  return (
    <main className="mx-auto max-w-6xl space-y-3.5 px-4 py-5 sm:px-6">
      <TituloDaSecao antes="Aplicação de" destaque="Testes" />
      {abas}

      {verCadastrados ? (
        <Tabela
          titulo="Testes disponíveis"
          direita={
            <Link href="/testes/cadastro/novo" className="inline-flex items-center gap-1 normal-case tracking-normal text-white hover:underline">
              <Plus size={12} /> Cadastrar teste
            </Link>
          }
        >
          <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2">
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-medium text-slate-800">Perfil comportamental (DISC)</p>
              <p className="text-[11px] text-slate-400">26 questões · gabarito da consultoria · já vem pronto no sistema</p>
            </div>
            <Etiqueta tom="azul">do sistema</Etiqueta>
          </div>
          {cadastrados.map((t) => (
            <div key={t.id} className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-2 last:border-b-0 even:bg-slate-50/60">
              <div className="min-w-0 flex-1">
                <Link href={`/testes/cadastro/${t.id}`} className="text-[13px] font-medium text-slate-800 hover:text-brand-700">
                  {t.name}
                </Link>
                <p className="text-[11px] text-slate-400">
                  {Array.isArray(t.questions) ? t.questions.length : 0} questões ·{" "}
                  {t.mode === "NOTAS" ? "numerar as alternativas" : "escolher uma alternativa"} · enviado {t._count.testeEnviados} vez(es)
                </p>
              </div>
              <Etiqueta tom={t.active ? "bom" : "neutro"}>{t.active ? "ativo" : "desativado"}</Etiqueta>
              <Link href={`/testes/cadastro/${t.id}`} className="text-[11px] text-brand-700 hover:text-brand-900">
                editar ›
              </Link>
            </div>
          ))}
          {cadastrados.length === 0 ? (
            <p className="px-3 py-3 text-xs text-slate-500">
              Nenhum teste cadastrado por você ainda. Use “Cadastrar teste” para colar as questões com a chave de cada alternativa.
            </p>
          ) : null}
        </Tabela>
      ) : (
        <>
          <EnviarTeste testes={disponiveis} empresas={empresas.map((e) => ({ id: e.id, nome: e.name }))} />

          <Numeros
            colunas={3}
            itens={[
              { rotulo: "Enviados", valor: envios.length },
              { rotulo: "Respondidos", valor: respondidos, tom: "bom" },
              { rotulo: "Aguardando resposta", valor: envios.length - respondidos, tom: envios.length - respondidos ? "atencao" : "neutro" },
            ]}
          />

          <form method="get" className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Empresa</span>
            <select name="empresa" defaultValue={empresa ?? ""} className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm">
              <option value="">Todas</option>
              {empresas.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-md bg-brand-700 px-2.5 py-1 font-medium text-white">
              Filtrar
            </button>
          </form>

          {envios.length === 0 ? (
            <Vazio>Nenhum teste enviado ainda. Gere o primeiro link acima.</Vazio>
          ) : (
            <Tabela titulo="Envios" direita={`${envios.length}`}>
              {envios.map((e) => {
                const respondido = e.status === "RESPONDIDO";
                const disc = e.tipo === "DISC" ? lerResultadoDisc(e.resultado) : null;
                const cad = e.tipo !== "DISC" ? lerResultadoCadastrado(e.resultado) : null;
                const resumo = disc
                  ? `Perfil ${disc.perfil} — ${DESCRICOES[disc.principal].nome} e ${DESCRICOES[disc.secundario].nome}`
                  : cad
                    ? cad.tipo
                      ? `Tipo ${cad.tipo}`
                      : `Mais forte: ${cad.fatores.find((f) => f.codigo === cad.ordem[0])?.nome ?? cad.ordem[0]}`
                    : null;
                return (
                  <div key={e.id} className="flex flex-wrap items-center gap-2.5 border-b border-slate-100 px-3 py-2 last:border-b-0 even:bg-slate-50/60">
                    <span aria-hidden className={`h-4 w-1 shrink-0 rounded-full ${respondido ? "bg-emerald-500" : "bg-amber-400"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] text-slate-800">
                        <span className="font-medium">{e.pessoa}</span>
                        <span className="text-slate-400"> · {e.nomeDoTeste}</span>
                        {e.company ? <span className="text-slate-400"> · {e.company.name}</span> : null}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        enviado {formatMoment(e.enviadoEm)}
                        {respondido && e.respondidoEm ? ` · respondido ${formatMoment(e.respondidoEm)}` : ""}
                        {resumo ? <span className="text-brand-700"> · {resumo}</span> : null}
                      </p>
                    </div>
                    <Etiqueta tom={respondido ? "bom" : "atencao"}>{respondido ? "respondido" : "aguardando"}</Etiqueta>
                    {respondido ? (
                      <Link href={`/testes/resultado/${e.id}`} className="text-[11px] font-medium text-brand-700 hover:text-brand-900">
                        ver resultado ›
                      </Link>
                    ) : null}
                    <AcoesDoEnvio
                      id={e.id}
                      token={e.token}
                      pessoa={e.pessoa}
                      teste={e.nomeDoTeste}
                      telefone={e.telefone}
                      respondido={respondido}
                    />
                  </div>
                );
              })}
            </Tabela>
          )}
        </>
      )}
    </main>
  );
}
