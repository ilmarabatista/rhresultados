import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/session";
import { dateToDayKey } from "@/lib/dates";
import {
  apurar,
  chaveDaDimensao,
  classificar,
  conclusaoSugerida,
  contagemDoPerfil,
  filtrar,
  lerConclusoes,
  lerMediasDigitadas,
  lerStatus,
  lerStatusDaAcao,
  lerTipo,
  NOME_DO_STATUS,
  porDimensao,
  recortePermitido,
  variacao,
} from "@/lib/clima";
import { carregarPesquisa, ciclosDaEmpresa } from "@/lib/clima-dados";
import ClimaMontar, { ClimaSituacao, type DimensaoParaMontar, type PesquisaParaMontar } from "@/components/clima-montar";
import ClimaResultados from "@/components/clima-resultados";
import ClimaSugestoes from "@/components/clima-sugestoes";
import ClimaPlano from "@/components/clima-plano";
import ClimaHistorico from "@/components/clima-historico";
import { Etiqueta } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pesquisa de clima — RH Resultados" };

/** A média do ciclo anterior de cada dimensão desta pesquisa, quando existe. */
function mediasPorNome(nomes: string[], media: (nome: string) => number | null): Map<string, number> {
  const saida = new Map<string, number>();
  for (const nome of nomes) {
    const m = media(nome);
    if (m !== null) saida.set(nome, m);
  }
  return saida;
}

const ABAS = [
  { slug: "montar", rotulo: "Montar" },
  { slug: "resultados", rotulo: "Resultados" },
  { slug: "sugestoes", rotulo: "Sugestões" },
  { slug: "plano", rotulo: "Conclusões e ações" },
] as const;
type Aba = (typeof ABAS)[number]["slug"];

/**
 * Um ciclo da pesquisa de clima. Em rascunho abre na montagem; depois de
 * aberto, nos resultados.
 */
export default async function PesquisaDeClimaPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; pesquisaId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireSession();
  const { id, pesquisaId } = await params;
  const sp = await searchParams;

  const dados = await carregarPesquisa(pesquisaId);
  if (!dados || dados.pesquisa.companyId !== id) notFound();
  const { pesquisa, perfil, regua, perguntas, respostas } = dados;
  const status = lerStatus(pesquisa.status);
  const base = `/empresas/${id}/clima/${pesquisaId}`;

  const cabecalho = (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <Link href={`/empresas/${id}/clima`} className="text-xs text-slate-500 transition hover:text-brand-700">
        ‹ Clima
      </Link>
      <h2 className="text-sm font-semibold text-slate-900">{pesquisa.nome}</h2>
      <Etiqueta tom={status === "ABERTA" ? "azul" : status === "ENCERRADA" ? "bom" : "neutro"}>{NOME_DO_STATUS[status]}</Etiqueta>
    </div>
  );

  if (status === "HISTORICO") {
    const medias = lerMediasDigitadas(pesquisa.mediasDigitadas);
    return (
      <div>
        {cabecalho}
        <ClimaHistorico
          companyId={id}
          pesquisaId={pesquisaId}
          inicial={{
            nome: pesquisa.nome,
            ano: pesquisa.abertaEm?.getUTCFullYear() ?? new Date().getFullYear(),
            medias: medias.map((m) => `${m.dimensao}; ${String(m.media).replace(".", ",")}`).join("\n"),
          }}
        />
      </div>
    );
  }

  const padrao: Aba = status === "RASCUNHO" ? "montar" : "resultados";
  const aba: Aba = ABAS.some((a) => a.slug === sp.aba) ? (sp.aba as Aba) : padrao;

  // O ciclo anterior com resultado, para as setas e para as ações combinadas.
  const ciclos = await ciclosDaEmpresa(id);
  const quando = (pesquisa.abertaEm ?? pesquisa.createdAt).getTime();
  const anterior = [...ciclos].reverse().find((c) => c.id !== pesquisaId && c.quando.getTime() <= quando) ?? null;
  const mediasAnteriores = anterior?.medias ?? new Map<string, number>();
  const mediaAnterior = (dimensao: string) => {
    for (const [nome, m] of mediasAnteriores) if (chaveDaDimensao(nome) === chaveDaDimensao(dimensao)) return m;
    return null;
  };

  const dadosDaPesquisa: PesquisaParaMontar = {
    id: pesquisa.id,
    companyId: id,
    nome: pesquisa.nome,
    status,
    token: pesquisa.token,
    prazo: pesquisa.prazo ? dateToDayKey(pesquisa.prazo) : "",
    convidados: pesquisa.convidados,
    regua,
    introducao: pesquisa.introducao ?? "",
    respostas: respostas.length,
  };

  let conteudo: React.ReactNode;

  if (aba === "montar") {
    const [biblioteca, empresa] = await Promise.all([
      prisma.dimensaoDeClima.findMany({
        where: { ativa: true },
        orderBy: [{ ordem: "asc" }, { nome: "asc" }],
        include: {
          perguntas: {
            where: { ativa: true, OR: [{ companyId: null }, { companyId: id }] },
            orderBy: [{ ordem: "asc" }, { createdAt: "asc" }],
          },
        },
      }),
      prisma.company.findUnique({ where: { id }, select: { id: true } }),
    ]);
    if (!empresa) notFound();

    const naPesquisa = new Map(pesquisa.perguntas.filter((p) => p.perguntaId).map((p) => [p.perguntaId!, p]));
    const usadas = new Set<string>();
    const dimensoes: DimensaoParaMontar[] = biblioteca.map((d) => ({
      id: d.id,
      nome: d.nome,
      perguntas: d.perguntas.map((p) => {
        const copia = naPesquisa.get(p.id);
        if (copia) usadas.add(copia.id);
        return {
          id: p.id,
          enunciado: p.enunciado,
          tipo: lerTipo(p.tipo),
          enps: p.enps,
          propria: p.companyId !== null,
          naPesquisa: copia?.id ?? null,
          enunciadoNaPesquisa: copia?.enunciado ?? null,
        };
      }),
    }));
    // Perguntas da pesquisa cuja origem saiu da biblioteca (desativada ou apagada).
    for (const p of pesquisa.perguntas) {
      if (usadas.has(p.id)) continue;
      let grupo = dimensoes.find((d) => chaveDaDimensao(d.nome) === chaveDaDimensao(p.dimensao));
      if (!grupo) {
        grupo = { id: null, nome: p.dimensao, perguntas: [] };
        dimensoes.push(grupo);
      }
      grupo.perguntas.push({
        id: p.perguntaId ?? p.id,
        enunciado: p.enunciado,
        tipo: lerTipo(p.tipo),
        enps: p.enps,
        propria: false,
        naPesquisa: p.id,
        enunciadoNaPesquisa: p.enunciado,
      });
    }

    conteudo = (
      <ClimaMontar
        pesquisa={dadosDaPesquisa}
        perfil={perfil}
        dimensoes={dimensoes}
      />
    );
  } else if (aba === "resultados") {
    const filtro: Record<string, string> = {};
    for (const p of perfil) {
      const v = sp[`f.${p.chave}`];
      if (v && p.opcoes.includes(v)) {
        filtro[p.chave] = v;
        break; // um recorte por vez
      }
    }
    const recorte = filtrar(respostas, filtro);
    const permitido = recortePermitido(recorte.length, filtro);
    conteudo = (
      <ClimaResultados
        base={base}
        apuracao={apurar(perguntas, permitido ? recorte : [], regua)}
        regua={regua}
        convidados={pesquisa.convidados}
        recortes={contagemDoPerfil(perfil, respostas)}
        filtro={filtro}
        bloqueado={!permitido}
        anteriores={mediasPorNome(porDimensao(perguntas).map((g) => g.dimensao), mediaAnterior)}
        nomeDoAnterior={anterior?.nome ?? null}
      />
    );
  } else if (aba === "sugestoes") {
    const abertas = perguntas.filter((p) => p.tipo === "TEXTO");
    conteudo = (
      <ClimaSugestoes
        grupos={abertas.map((p) => ({
          pergunta: p.enunciado,
          textos: dados.textos
            .filter((t) => t.perguntaId === p.id)
            .map((t) => ({ id: t.id, texto: t.texto, textoRevisado: t.textoRevisado, ocultar: t.ocultar })),
        }))}
      />
    );
  } else {
    const apuracao = apurar(perguntas, respostas, regua);
    const conclusoes = lerConclusoes(pesquisa.conclusoes);
    const acoesAnteriores =
      anterior && anterior.status !== "HISTORICO"
        ? await prisma.acaoDeClima.findMany({ where: { pesquisaId: anterior.id }, orderBy: [{ dimensao: "asc" }, { createdAt: "asc" }] })
        : [];
    const mediaAgora = (dimensao: string) =>
      apuracao.dimensoes.find((d) => chaveDaDimensao(d.dimensao) === chaveDaDimensao(dimensao))?.media ?? null;

    conteudo = (
      <ClimaPlano
        pesquisaId={pesquisaId}
        relatorioHref={`${base}/relatorio`}
        nomeDoAnterior={anterior?.nome ?? null}
        dimensoes={apuracao.dimensoes
          .filter((d) => d.media !== null)
          .map((d) => ({
            dimensao: d.dimensao,
            media: d.media,
            dentro: d.dentro,
            abaixo: d.abaixo,
            classificacao: classificar(d.media, regua),
            variacao: variacao(d.media, mediaAnterior(d.dimensao)),
            conclusao: conclusoes[d.dimensao] ?? "",
            sugerida: conclusaoSugerida(d.media, regua),
          }))}
        acoes={pesquisa.acoes.map((a) => ({
          id: a.id,
          dimensao: a.dimensao,
          descricao: a.descricao,
          responsavel: a.responsavel ?? "",
          prazo: a.prazo ? dateToDayKey(a.prazo) : "",
          status: lerStatusDaAcao(a.status),
        }))}
        anteriores={acoesAnteriores.map((a) => ({
          id: a.id,
          dimensao: a.dimensao,
          descricao: a.descricao,
          responsavel: a.responsavel ?? "",
          prazo: a.prazo ? dateToDayKey(a.prazo) : "",
          status: lerStatusDaAcao(a.status),
          antes: mediaAnterior(a.dimensao),
          agora: mediaAgora(a.dimensao),
        }))}
      />
    );
  }

  return (
    <div>
      {cabecalho}
      <div className="mb-3">
        <ClimaSituacao pesquisa={dadosDaPesquisa} />
      </div>
      <nav aria-label="Partes do ciclo" className="mb-3 flex flex-wrap gap-1 border-b border-slate-200">
        {ABAS.map((a) => (
          <Link
            key={a.slug}
            href={`${base}?aba=${a.slug}`}
            aria-current={aba === a.slug ? "page" : undefined}
            className={`-mb-px border-b-2 px-3 py-1.5 text-xs transition ${
              aba === a.slug ? "border-brand-600 font-semibold text-brand-800" : "border-transparent text-slate-600 hover:text-brand-700"
            }`}
          >
            {a.rotulo}
          </Link>
        ))}
      </nav>
      {conteudo}
    </div>
  );
}
