import { exigirColaborador } from "@/lib/sessao";
import { limitesDoPedido, pedidosDoColaborador, resumoDoPedido } from "@/lib/pedidos";
import { CancelarPedido, FormPedido } from "@/components/pedidos";
import { Cartao, Etiqueta, Topo } from "@/components/ui";

export const dynamic = "force-dynamic";

const SITUACAO = {
  PENDENTE: { nome: "Esperando o RH", tom: "atencao" },
  APROVADO: { nome: "Aprovado", tom: "bom" },
  RECUSADO: { nome: "Recusado", tom: "ruim" },
} as const;

/** O colaborador justifica falta com atestado e pede correção da própria batida. O RH aprova. */
export default async function PedidosPage({ searchParams }: { searchParams: Promise<{ dia?: string; tipo?: string }> }) {
  const s = await exigirColaborador();
  const sp = await searchParams;
  const { hoje, de, ateAtestado } = limitesDoPedido();
  const pedidos = await pedidosDoColaborador(s.id);
  const dia = /^\d{4}-\d{2}-\d{2}$/.test(sp.dia ?? "") && sp.dia! >= de && sp.dia! <= ateAtestado ? sp.dia! : hoje;
  const quando = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });

  return (
    <>
      <Topo
        titulo="Ponto"
        nome={s.nome}
        links={[
          { href: "/", rotulo: "Registrar" },
          { href: "/folgas", rotulo: "Folgas" },
          { href: "/meu-ponto", rotulo: "Meu ponto" },
          { href: "/trocar-senha", rotulo: "Senha" },
        ]}
      />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <div>
          <p className="text-sm text-slate-500">{s.empresa.nome}</p>
          <h1 className="text-xl font-semibold text-slate-900">Atestado e correção</h1>
          <p className="mt-1 text-sm text-slate-600">
            Mande o atestado para justificar uma falta, ou peça para corrigir uma batida. O ponto só muda quando o RH aprovar.
          </p>
        </div>

        <Cartao>
          <FormPedido abaInicial={sp.tipo === "correcao" ? "CORRECAO" : "ATESTADO"} diaInicial={dia} hoje={hoje} de={de} ateAtestado={ateAtestado} />
        </Cartao>

        <Cartao titulo="Seus pedidos">
          {pedidos.length === 0 ? (
            <p className="text-sm text-slate-500">Você ainda não fez nenhum pedido.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {pedidos.map((p) => (
                <li key={p.id} className="space-y-1 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="flex-1 text-sm font-medium text-slate-800">{resumoDoPedido(p)}</span>
                    <Etiqueta tom={SITUACAO[p.situacao].tom}>{SITUACAO[p.situacao].nome}</Etiqueta>
                  </div>
                  {p.motivo ? <p className="text-sm text-slate-600">{p.motivo}</p> : null}
                  {p.situacao === "RECUSADO" && p.resposta ? (
                    <p className="rounded-lg bg-red-50 px-3 py-1.5 text-sm text-red-700">RH: {p.resposta}</p>
                  ) : null}
                  <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Enviado em {quando.format(new Date(p.criadoEm))}
                      {p.anexo ? " · com anexo" : ""}
                      {p.decididoEm ? ` · decidido em ${quando.format(new Date(p.decididoEm))}` : ""}
                    </span>
                    {p.situacao === "PENDENTE" ? <CancelarPedido id={p.id} /> : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Cartao>
      </main>
    </>
  );
}
