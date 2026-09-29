import { DESCRICOES, FATORES, type ResultadoDisc } from "@/lib/disc";
import type { ResultadoCadastrado } from "@/lib/testes-cadastrados";

/**
 * O resultado de um teste respondido: o perfil DISC com a ficha dos dois
 * fatores mais fortes, ou a apuração de um teste cadastrado.
 */

function Barra({ rotulo, valor, detalhe, forte }: { rotulo: React.ReactNode; valor: number; detalhe: string; forte?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-44 shrink-0 text-[12px] text-slate-700">{rotulo}</span>
      <div className="h-3 flex-1 rounded-sm bg-slate-100">
        <div className={`h-full rounded-sm ${forte ? "bg-brand-700" : "bg-brand-400"}`} style={{ width: `${valor}%` }} />
      </div>
      <span className="w-14 shrink-0 text-right text-[12px] tabular-nums text-slate-600">{detalhe}</span>
    </div>
  );
}

export function ResultadoDoDisc({ disc }: { disc: ResultadoDisc }) {
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {FATORES.map((f) => (
          <Barra
            key={f}
            rotulo={
              <>
                <strong>{f}</strong> · {DESCRICOES[f].nome}
              </>
            }
            valor={disc.percentuais[f]}
            detalhe={`${disc.percentuais[f]}%`}
            forte={f === disc.principal || f === disc.secundario}
          />
        ))}
      </div>
      <p className="text-[12px] text-slate-700">
        Perfil <strong>{disc.perfil}</strong>: predomina {DESCRICOES[disc.principal].nome}, seguida de {DESCRICOES[disc.secundario].nome}.
      </p>
      <div className="grid gap-2 md:grid-cols-2">
        {[disc.principal, disc.secundario].map((f) => {
          const d = DESCRICOES[f];
          return (
            <div key={f} className="rounded-md border border-slate-200 p-2.5 text-[11px] leading-snug text-slate-600">
              <p className="text-[12px] font-semibold text-slate-800">{d.nome}</p>
              <p className="mt-0.5">{d.resumo}</p>
              <p className="mt-1.5 font-medium text-slate-700">Pontos fortes</p>
              <ul className="list-disc pl-4">
                {d.pontosFortes.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="mt-1.5 font-medium text-slate-700">Pontos de atenção</p>
              <ul className="list-disc pl-4">
                {d.pontosDeAtencao.map((p) => (
                  <li key={p}>{p}</li>
                ))}
              </ul>
              <p className="mt-1.5">
                <span className="font-medium text-slate-700">Comunicação:</span> {d.comunicacao}
              </p>
              <p>
                <span className="font-medium text-slate-700">Ambiente ideal:</span> {d.ambiente}
              </p>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-slate-400">O DISC descreve comportamento. Serve para orientar a conversa, não para reprovar ninguém sozinho.</p>
    </div>
  );
}

/** Os fatores que venceram cada par — ou o mais forte, sem pares. Mesma regra da apuração. */
function vencedores(r: ResultadoCadastrado): Set<string> {
  if (r.pares.length === 0) return new Set(r.ordem.slice(0, 1));
  return new Set(
    r.pares.map(([a, b]) =>
      r.percentuais[b] > r.percentuais[a] || (r.percentuais[b] === r.percentuais[a] && r.pontos[b] > r.pontos[a]) ? b : a,
    ),
  );
}


export function ResultadoDoTesteCadastrado({ r }: { r: ResultadoCadastrado }) {
  const fortes = vencedores(r);
  const descricoes = r.fatores.filter((f) => fortes.has(f.codigo) && f.descricao);

  return (
    <div className="space-y-2">
      {r.tipo ? (
        <p className="text-[12px] text-slate-700">
          Tipo <strong className="text-brand-800">{r.tipo}</strong>
        </p>
      ) : null}
      <div className="space-y-1.5">
        {r.ordem.map((codigo) => {
          const f = r.fatores.find((x) => x.codigo === codigo);
          const valor = r.percentuais[codigo] ?? 0;
          return (
            <div key={codigo} className="flex items-center gap-2">
              <span className="w-40 shrink-0 truncate text-[12px] text-slate-700" title={f?.nome}>
                <strong>{codigo}</strong> · {f?.nome ?? codigo}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full ${fortes.has(codigo) ? "bg-brand-600" : "bg-brand-300"}`}
                  style={{ width: `${Math.max(0, Math.min(100, valor))}%` }}
                />
              </div>
              <span className="w-20 shrink-0 text-right text-[12px] tabular-nums text-slate-600">
                {valor}% · {r.pontos[codigo] ?? 0}
              </span>
            </div>
          );
        })}
      </div>
      {descricoes.length > 0 ? (
        <ul className="space-y-0.5 text-[11px] leading-snug text-slate-600">
          {descricoes.map((f) => (
            <li key={f.codigo}>
              <strong>{f.nome}:</strong> {f.descricao}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

