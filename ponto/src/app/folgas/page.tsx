import { prisma } from "@/lib/prisma";
import { exigirColaborador } from "@/lib/sessao";
import { dateToDayKey, dayKeyToDate, todayKey } from "@/lib/dates";
import { NOME_DA_OCORRENCIA, type TipoOcorrencia } from "@/lib/calculo";
import { JANELA_DA_FOLGA, limitesDaFolga, MARCADA_PELO_COLABORADOR } from "@/lib/folgas";
import { DesmarcarFolga, FormFolga } from "@/components/folgas";
import { Cartao, Etiqueta, Topo } from "@/components/ui";

export const dynamic = "force-dynamic";

/** O colaborador informa os dias em que estava de folga, para não contarem como falta. */
export default async function FolgasPage() {
  const s = await exigirColaborador();
  const { de, ate } = limitesDaFolga();
  const lista = await prisma.ocorrencia.findMany({
    where: { colaboradorId: s.id, dia: { gte: dayKeyToDate(de), lte: dayKeyToDate(ate) } },
    orderBy: { dia: "desc" },
    select: { id: true, dia: true, tipo: true, descricao: true, criadoPor: true },
  });
  const semana = new Intl.DateTimeFormat("pt-BR", { weekday: "short", timeZone: "UTC" });

  return (
    <>
      <Topo
        titulo="Ponto"
        nome={s.nome}
        links={[
          { href: "/", rotulo: "Registrar" },
          { href: "/meu-ponto", rotulo: "Meu ponto" },
          { href: "/trocar-senha", rotulo: "Senha" },
        ]}
      />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <div>
          <p className="text-sm text-slate-500">{s.empresa.nome}</p>
          <h1 className="text-xl font-semibold text-slate-900">Folgas</h1>
          <p className="mt-1 text-sm text-slate-600">
            Marque aqui os dias em que você estava de folga. O dia deixa de contar como falta, e o RH vê o que você marcou.
          </p>
        </div>

        <Cartao>
          <FormFolga de={de} ate={ate} hoje={todayKey()} />
          <p className="mt-3 text-xs text-slate-500">
            Dá para marcar dos últimos {JANELA_DA_FOLGA} dias até os próximos {JANELA_DA_FOLGA}.
          </p>
        </Cartao>

        <Cartao titulo="Seus dias marcados">
          {lista.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhuma folga ou ausência neste período.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {lista.map((o) => {
                const dia = dateToDayKey(o.dia);
                const sua = o.criadoPor === MARCADA_PELO_COLABORADOR;
                return (
                  <li key={o.id} className="flex items-center gap-3 py-2">
                    <span className="w-24 text-sm tabular-nums text-slate-700">
                      {dia.split("-").reverse().join("/")}
                      <span className="ml-1 text-xs text-slate-500">{semana.format(o.dia).replace(".", "")}</span>
                    </span>
                    <span className="flex-1 text-sm text-slate-600">
                      <Etiqueta>{NOME_DA_OCORRENCIA[o.tipo as TipoOcorrencia]}</Etiqueta>
                      {o.descricao ? <span className="ml-2">{o.descricao}</span> : null}
                      {sua ? null : <span className="ml-2 text-xs text-slate-500">lançada pelo RH</span>}
                    </span>
                    {sua ? <DesmarcarFolga id={o.id} /> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </main>
    </>
  );
}
