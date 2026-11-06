import { formatFullDate } from "@/lib/dates";
import { lerStatusDaMeta, ROTULO_DA_META } from "@/lib/pdi";

/**
 * O que foi combinado num PDI, para quem lê fora do sistema: as metas com as
 * ações e os combinados das conversas. Usado no link do colaborador e no link
 * da gerente. Sem as notas da avaliação, que ficam só no RH.
 */

export const SELECT_DO_COMBINADO = {
  metas: {
    where: { status: { not: "CANCELADA" } },
    orderBy: { ordem: "asc" },
    select: {
      id: true,
      titulo: true,
      competencia: true,
      indicador: true,
      recursos: true,
      relevancia: true,
      prazo: true,
      status: true,
      progresso: true,
      acoes: {
        orderBy: { order: "asc" },
        select: { id: true, title: true, done: true, responsavel: true, dueDate: true },
      },
    },
  },
  conversas: { orderBy: { data: "asc" }, select: { id: true, data: true, combinados: true } },
} as const;

type Meta = {
  id: string;
  titulo: string;
  competencia: string | null;
  indicador: string | null;
  recursos: string | null;
  relevancia: string | null;
  prazo: Date | null;
  status: string;
  acoes: { id: string; title: string; done: boolean; responsavel: string | null; dueDate: Date | null }[];
};

export const CAIXA = "rounded-lg border border-slate-200 bg-white p-4 shadow-sm break-inside-avoid";

export function MetaCombinada({ m, n, pessoa }: { m: Meta; n: number; pessoa: "eu" | "ela" }) {
  return (
    <div className="break-inside-avoid">
      <p className="text-sm font-semibold text-slate-900">
        {n}. {m.titulo}
      </p>
      {m.competencia ? <p className="text-xs text-slate-500">{m.competencia}</p> : null}
      <dl className="mt-2 space-y-1 text-sm text-slate-700">
        {m.relevancia ? (
          <div>
            <dt className="inline font-medium">Por que importa: </dt>
            <dd className="inline">{m.relevancia}</dd>
          </div>
        ) : null}
        {m.indicador ? (
          <div>
            <dt className="inline font-medium">Como vamos saber que deu certo: </dt>
            <dd className="inline">{m.indicador}</dd>
          </div>
        ) : null}
        {m.recursos ? (
          <div>
            <dt className="inline font-medium">{pessoa === "eu" ? "Apoio que você vai ter: " : "Apoio combinado: "}</dt>
            <dd className="inline">{m.recursos}</dd>
          </div>
        ) : null}
        <div>
          <dt className="inline font-medium">Prazo: </dt>
          <dd className="inline">
            {m.prazo ? formatFullDate(m.prazo) : "—"} · {ROTULO_DA_META[lerStatusDaMeta(m.status)]}
          </dd>
        </div>
      </dl>
      {m.acoes.length > 0 ? (
        <>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {pessoa === "eu" ? "O que vou fazer" : "O que a pessoa vai fazer"}
          </p>
          <ul className="mt-1 space-y-1 text-sm text-slate-700">
            {m.acoes.map((a) => (
              <li key={a.id} className="flex gap-2">
                <span className={a.done ? "text-emerald-600" : "text-slate-400"}>{a.done ? "☑" : "☐"}</span>
                <span>
                  {a.title}
                  {a.responsavel || a.dueDate ? (
                    <span className="text-slate-500">
                      {a.responsavel ? ` · com ${a.responsavel}` : ""}
                      {a.dueDate ? ` · até ${formatFullDate(a.dueDate)}` : ""}
                    </span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </div>
  );
}

export function CombinadosDasConversas({ conversas }: { conversas: { id: string; data: Date; combinados: string | null }[] }) {
  const lista = conversas.filter((c) => c.combinados?.trim());
  if (lista.length === 0) return null;
  return (
    <ul className="space-y-2 text-sm text-slate-700">
      {lista.map((c) => (
        <li key={c.id}>
          <span className="font-medium">{formatFullDate(c.data)}:</span>{" "}
          <span className="whitespace-pre-wrap">{c.combinados}</span>
        </li>
      ))}
    </ul>
  );
}

export function BarraDeAndamento({ progresso, rotulo = "Andamento do plano" }: { progresso: number; rotulo?: string }) {
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-500">
        <span>{rotulo}</span>
        <span>{progresso}%</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-slate-100">
        <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${progresso}%` }} />
      </div>
    </div>
  );
}
