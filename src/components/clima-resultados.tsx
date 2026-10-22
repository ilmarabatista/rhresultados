import Link from "next/link";
import {
  classificar,
  formatarNota,
  MIN_GRUPO,
  porcentagem,
  variacao,
  type Apuracao,
  type ResultadoDaPergunta,
} from "@/lib/clima";
import { Aviso, Numeros, Painel, Tabela } from "./ui";
import { Faixa } from "./clima-faixa";

/**
 * Os resultados de um ciclo: os números do alto, os recortes por perfil e a
 * tabela das dimensões, cada uma abrindo as suas perguntas.
 *
 * Tela de servidor: os recortes são links, e nada aqui precisa de JavaScript.
 */

export type RecorteDoPerfil = { chave: string; rotulo: string; opcoes: { opcao: string; vezes: number }[] };

function Seta({ valor }: { valor: number | null }) {
  if (valor === null) return <span className="text-slate-400">—</span>;
  if (valor === 0) return <span className="text-slate-500">=</span>;
  return (
    <span className={valor > 0 ? "text-emerald-700" : "text-red-700"}>
      {valor > 0 ? "▲" : "▼"} {formatarNota(Math.abs(valor))}
    </span>
  );
}

/**
 * Um recorte por vez: cruzar dois (gestão e mulheres, por exemplo) deixa
 * grupos pequenos demais e facilita descobrir quem respondeu o quê.
 */
function hrefDoFiltro(base: string, chave: string, valor: string | null) {
  const qs = new URLSearchParams({ aba: "resultados" });
  if (valor) qs.set(`f.${chave}`, valor);
  return `${base}?${qs.toString()}`;
}

function Escolhas({ r }: { r: ResultadoDaPergunta }) {
  const maior = Math.max(1, ...r.opcoes.map((o) => o.vezes));
  return (
    <ul className="mt-1 space-y-0.5">
      {r.opcoes.map((o) => (
        <li key={o.opcao} className="grid grid-cols-[minmax(0,12rem)_minmax(0,1fr)_3.5rem] items-center gap-2">
          <span className="truncate text-slate-600" title={o.opcao}>{o.opcao}</span>
          <span className="h-2 rounded-full bg-brand-100">
            <span className="block h-full rounded-full bg-brand-500" style={{ width: `${(o.vezes / maior) * 100}%` }} />
          </span>
          <span className="text-right tabular-nums text-slate-500">
            {o.vezes} · {porcentagem(o.vezes, r.respostas)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ClimaResultados({
  base,
  apuracao,
  regua,
  convidados,
  recortes,
  filtro,
  bloqueado,
  anteriores,
  nomeDoAnterior,
}: {
  base: string;
  apuracao: Apuracao;
  regua: number;
  convidados: number | null;
  recortes: RecorteDoPerfil[];
  filtro: Record<string, string>;
  /** O recorte escolhido tem menos de MIN_GRUPO respostas. */
  bloqueado: boolean;
  /** A média de cada dimensão no ciclo anterior, para a seta. */
  anteriores: Map<string, number>;
  nomeDoAnterior: string | null;
}) {
  const comNota = apuracao.dimensoes.filter((d) => d.media !== null);
  const abaixo = comNota.filter((d) => classificar(d.media, regua) === "ABAIXO");
  const filtrado = Object.keys(filtro).length > 0;

  return (
    <div className="space-y-3.5">
      <div className="space-y-1.5 rounded-lg border border-slate-200 bg-white p-3">
        {recortes.map((r) => (
          <div key={r.chave} className="flex flex-wrap items-center gap-1.5">
            <span className="w-full text-micro font-medium uppercase tracking-wider text-slate-500 sm:w-40">{r.rotulo}</span>
            <Link
              href={hrefDoFiltro(base, r.chave, null)}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                !filtro[r.chave] ? "border-brand-700 bg-brand-700 font-medium text-white" : "border-slate-200 text-slate-600 hover:border-brand-300"
              }`}
            >
              Todos
            </Link>
            {r.opcoes.map((o) => (
              <Link
                key={o.opcao}
                href={hrefDoFiltro(base, r.chave, o.opcao)}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                  filtro[r.chave] === o.opcao
                    ? "border-brand-700 bg-brand-700 font-medium text-white"
                    : "border-slate-200 text-slate-600 hover:border-brand-300"
                }`}
              >
                {o.opcao} <span className="tabular-nums opacity-70">{o.vezes}</span>
              </Link>
            ))}
          </div>
        ))}
        <p className="text-micro text-slate-500">
          Para proteger o anonimato, os recortes são um por vez e só mostram resultado com pelo menos {MIN_GRUPO} respostas.
        </p>
      </div>

      {bloqueado ? (
        <Aviso tom="atencao" rotulo="Recorte oculto">
          Este grupo tem menos de {MIN_GRUPO} respostas. Escolha um recorte maior para ver o resultado sem expor ninguém.
        </Aviso>
      ) : apuracao.respostas === 0 ? (
        <Aviso tom="informacao">Ainda não há respostas{filtrado ? " neste recorte" : ""}.</Aviso>
      ) : (
        <>
          <Numeros
            colunas={4}
            itens={[
              {
                rotulo: "Respostas",
                valor: apuracao.respostas,
                detalhe: !filtrado && convidados ? `${porcentagem(apuracao.respostas, convidados)} de ${convidados} convidados` : filtrado ? "neste recorte" : undefined,
              },
              {
                rotulo: "Média geral",
                valor: formatarNota(apuracao.geral),
                tom: classificar(apuracao.geral, regua) === "ABAIXO" ? "atencao" : "bom",
                detalhe: `régua ${formatarNota(regua)}`,
              },
              {
                rotulo: "eNPS",
                valor: apuracao.enps ? apuracao.enps.valor : "—",
                tom: apuracao.enps ? (apuracao.enps.valor >= 30 ? "bom" : apuracao.enps.valor < 0 ? "ruim" : "atencao") : "neutro",
                detalhe: apuracao.enps
                  ? `${apuracao.enps.promotores} promotores · ${apuracao.enps.neutros} neutros · ${apuracao.enps.detratores} críticos`
                  : "sem a pergunta de recomendação",
              },
              {
                rotulo: "Abaixo da régua",
                valor: `${abaixo.length} de ${comNota.length}`,
                tom: abaixo.length ? "atencao" : "bom",
                detalhe: abaixo.length ? abaixo.map((d) => d.dimensao).join(", ") : "todas as dimensões dentro do esperado",
              },
            ]}
          />

          <Tabela titulo="Dimensões" direita={nomeDoAnterior ? `seta: comparado a ${nomeDoAnterior}` : undefined} minLargura={560}>
            <div className="divide-y divide-slate-100 text-xs">
              {apuracao.dimensoes.map((d) => {
                const c = classificar(d.media, regua);
                return (
                  <details key={d.dimensao} className="group">
                    <summary className="grid cursor-pointer list-none grid-cols-[minmax(0,1fr)_3.5rem_4rem_9rem_6rem] items-center gap-2 px-3 py-1.5 hover:bg-slate-50/60">
                      <span className="font-medium text-slate-800">
                        <span className="mr-1 inline-block text-slate-400 transition group-open:rotate-90">›</span>
                        {d.dimensao}
                      </span>
                      <span className="text-right font-semibold tabular-nums text-slate-800">{formatarNota(d.media)}</span>
                      <span className="text-right tabular-nums">
                        <Seta valor={variacao(d.media, anteriores.get(d.dimensao) ?? null)} />
                      </span>
                      <Faixa dentro={d.dentro} abaixo={d.abaixo} />
                      <span className={c === "ABAIXO" ? "text-amber-700" : c === "DENTRO" ? "text-emerald-700" : "text-slate-400"}>
                        {c === "ABAIXO" ? "Abaixo" : c === "DENTRO" ? "Dentro" : "sem nota"}
                      </span>
                    </summary>
                    <ul className="space-y-2 bg-slate-50/60 px-3 py-2 pl-7">
                      {d.perguntas.map((r) => (
                        <li key={r.pergunta.id}>
                          {r.pergunta.tipo === "NOTA" ? (
                            <div className="grid grid-cols-[minmax(0,1fr)_3.5rem_9rem] items-center gap-2">
                              <span className="text-slate-700">
                                {r.pergunta.enunciado}
                                {r.pergunta.enps ? <span className="ml-1 text-micro text-brand-700">(eNPS, de 0 a 10)</span> : null}
                              </span>
                              <span className="text-right tabular-nums text-slate-800">{formatarNota(r.media)}</span>
                              {r.pergunta.enps ? <span /> : <Faixa dentro={r.dentro} abaixo={r.abaixo} />}
                            </div>
                          ) : r.pergunta.tipo === "TEXTO" ? (
                            <span className="text-slate-700">
                              {r.pergunta.enunciado} <span className="text-slate-500">· {r.respostas} respostas, na aba Sugestões</span>
                            </span>
                          ) : (
                            <div>
                              <span className="text-slate-700">{r.pergunta.enunciado}</span>
                              <Escolhas r={r} />
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  </details>
                );
              })}
            </div>
          </Tabela>

          <Painel>
            <p className="text-xs leading-relaxed text-slate-500">
              A média da dimensão é a média das médias das suas perguntas de nota. A faixa mostra a parte das notas que ficou
              na régua ({formatarNota(regua)}) ou acima, em verde, e abaixo dela, em vermelho. O eNPS é a parte de quem dá 9
              ou 10 à recomendação menos a de quem dá de 0 a 6.
            </p>
          </Painel>
        </>
      )}
    </div>
  );
}
