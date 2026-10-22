import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { textoDoFormulario } from "./texto-seguro";
import { BIBLIOTECA_INICIAL } from "./clima-biblioteca";
import {
  apurar,
  lerMediasDigitadas,
  lerOpcoes,
  lerPerfil,
  lerTipo,
  opcoesDoTexto,
  type PerguntaAplicada,
  type RespostaGuardada,
} from "./clima";

/**
 * As leituras da pesquisa de clima que tocam o banco, usadas pelas telas, pelo
 * link público e pelo relatório.
 */

/** Os campos de uma pergunta, comuns à biblioteca e às perguntas próprias. */
export async function lerPerguntaDoFormulario(formData: FormData): Promise<
  | { error: string }
  | { dados: { enunciado: string; tipo: string; opcoes: Prisma.InputJsonValue | undefined; maxEscolhas: number | null } }
> {
  const enunciado = textoDoFormulario(formData.get("enunciado"), 400);
  const tipo = lerTipo(formData.get("tipo"));
  if (enunciado.length < 5) return { error: "Escreva a pergunta." };

  let opcoes: string[] = [];
  let maxEscolhas: number | null = null;
  if (tipo === "ESCOLHA" || tipo === "MULTIPLA") {
    opcoes = opcoesDoTexto(textoDoFormulario(formData.get("opcoes"), 4000)).map((o) => o.slice(0, 120)).slice(0, 30);
    if (opcoes.length < 2) return { error: "Escreva pelo menos duas opções, uma por linha." };
    if (tipo === "MULTIPLA") {
      const n = Number(formData.get("maxEscolhas"));
      maxEscolhas = Number.isInteger(n) && n >= 1 ? Math.min(n, opcoes.length) : null;
    }
  }
  return { dados: { enunciado, tipo, opcoes: opcoes.length ? opcoes : undefined, maxEscolhas } };
}

type LinhaDaPergunta = {
  id: string;
  perguntaId: string | null;
  dimensao: string;
  dimensaoOrdem: number;
  enunciado: string;
  tipo: string;
  opcoes: Prisma.JsonValue;
  maxEscolhas: number | null;
  enps: boolean;
  ordem: number;
};

export function paraAplicada(p: LinhaDaPergunta): PerguntaAplicada {
  return {
    id: p.id,
    origem: p.perguntaId,
    dimensao: p.dimensao,
    dimensaoOrdem: p.dimensaoOrdem,
    enunciado: p.enunciado,
    tipo: lerTipo(p.tipo),
    opcoes: lerOpcoes(p.opcoes),
    maxEscolhas: p.maxEscolhas,
    enps: p.enps,
    ordem: p.ordem,
  };
}

/** A pesquisa com as perguntas e todas as respostas, pronta para apurar. */
export async function carregarPesquisa(pesquisaId: string) {
  const pesquisa = await prisma.pesquisaDeClima.findUnique({
    where: { id: pesquisaId },
    include: {
      perguntas: true,
      respostas: { select: { perfil: true, itens: { select: { id: true, perguntaId: true, nota: true, escolhas: true, texto: true, textoRevisado: true, ocultar: true } } } },
      acoes: { orderBy: [{ dimensao: "asc" }, { createdAt: "asc" }] },
    },
  });
  if (!pesquisa) return null;

  const perguntas = pesquisa.perguntas.map(paraAplicada);
  const respostas: RespostaGuardada[] = pesquisa.respostas.map((r) => ({
    perfil: lerPerfilRespondido(r.perfil),
    itens: r.itens.map((i) => ({ perguntaId: i.perguntaId, nota: i.nota, escolhas: i.escolhas, texto: i.texto })),
  }));
  const textos = pesquisa.respostas.flatMap((r) =>
    r.itens
      .filter((i) => i.texto)
      .map((i) => ({ id: i.id, perguntaId: i.perguntaId, texto: i.texto ?? "", textoRevisado: i.textoRevisado, ocultar: i.ocultar })),
  );

  return {
    pesquisa,
    perfil: lerPerfil(pesquisa.perfil),
    regua: Number(pesquisa.regua),
    perguntas,
    respostas,
    textos,
  };
}

export function lerPerfilRespondido(valor: Prisma.JsonValue): Record<string, string> {
  if (!valor || typeof valor !== "object" || Array.isArray(valor)) return {};
  const saida: Record<string, string> = {};
  for (const [k, v] of Object.entries(valor)) if (typeof v === "string") saida[k] = v;
  return saida;
}

/**
 * As médias por dimensão de cada ciclo da empresa que já tem resultado, do mais
 * antigo ao mais novo: os encerrados, os abertos e os de histórico.
 */
export async function ciclosDaEmpresa(companyId: string) {
  const pesquisas = await prisma.pesquisaDeClima.findMany({
    where: { companyId, status: { in: ["ABERTA", "ENCERRADA", "HISTORICO"] } },
    orderBy: [{ abertaEm: "asc" }, { createdAt: "asc" }],
    select: { id: true },
  });

  const ciclos: { id: string; nome: string; status: string; quando: Date; medias: Map<string, number>; geral: number | null; enps: number | null; respostas: number }[] = [];
  for (const { id } of pesquisas) {
    const dados = await carregarPesquisa(id);
    if (!dados) continue;
    const { pesquisa } = dados;
    const quando = pesquisa.abertaEm ?? pesquisa.createdAt;
    if (pesquisa.status === "HISTORICO") {
      const lista = lerMediasDigitadas(pesquisa.mediasDigitadas);
      const geral = lista.length ? lista.reduce((a, b) => a + b.media, 0) / lista.length : null;
      ciclos.push({ id, nome: pesquisa.nome, status: pesquisa.status, quando, medias: new Map(lista.map((l) => [l.dimensao, l.media])), geral, enps: null, respostas: 0 });
      continue;
    }
    const ap = apurar(dados.perguntas, dados.respostas, dados.regua);
    if (ap.respostas === 0) continue;
    const medias = new Map<string, number>();
    for (const d of ap.dimensoes) if (d.media !== null) medias.set(d.dimensao, d.media);
    ciclos.push({ id, nome: pesquisa.nome, status: pesquisa.status, quando, medias, geral: ap.geral, enps: ap.enps?.valor ?? null, respostas: ap.respostas });
  }
  // Os de histórico guardam em abertaEm o ano em que foram aplicados.
  return ciclos.sort((a, b) => a.quando.getTime() - b.quando.getTime());
}

/**
 * Com a biblioteca vazia, carrega a inicial. Assim o primeiro ciclo de uma
 * empresa nunca nasce sem perguntas, mesmo que ninguém tenha passado antes
 * pela tela da biblioteca. Devolve true quando carregou.
 */
export async function garantirBiblioteca(): Promise<boolean> {
  if (await prisma.dimensaoDeClima.count()) return false;
  await prisma.$transaction(
    BIBLIOTECA_INICIAL.map((d, i) =>
      prisma.dimensaoDeClima.create({
        data: {
          nome: d.nome,
          descricao: d.descricao,
          ordem: (i + 1) * 10,
          perguntas: {
            create: d.perguntas.map((p, j) => ({
              enunciado: p.enunciado,
              tipo: p.tipo ?? "NOTA",
              opcoes: p.opcoes ?? undefined,
              maxEscolhas: p.maxEscolhas ?? null,
              enps: p.enps ?? false,
              padrao: p.padrao ?? false,
              ordem: (j + 1) * 10,
            })),
          },
        },
      }),
    ),
  );
  return true;
}

/** As perguntas padrão da biblioteca, prontas para entrar num ciclo. */
export async function perguntasPadrao(): Promise<Prisma.PerguntaDaPesquisaCreateWithoutPesquisaInput[]> {
  await garantirBiblioteca();
  const padrao = await prisma.perguntaDeClima.findMany({
    where: { padrao: true, ativa: true, companyId: null, dimensao: { ativa: true } },
    include: { dimensao: { select: { nome: true, ordem: true } } },
  });
  return padrao.map((p) => ({
    pergunta: { connect: { id: p.id } },
    dimensao: p.dimensao.nome,
    dimensaoOrdem: p.dimensao.ordem,
    enunciado: p.enunciado,
    tipo: p.tipo,
    opcoes: p.opcoes ?? undefined,
    maxEscolhas: p.maxEscolhas,
    enps: p.enps,
    ordem: p.ordem,
  }));
}
