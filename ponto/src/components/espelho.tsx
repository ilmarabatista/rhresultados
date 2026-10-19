import { DIAS_DA_SEMANA, horas, NOME_DA_OCORRENCIA, nomeDoMes, relogio, saldoEscrito } from "@/lib/calculo";
import type { DadosDoRelatorio } from "@/lib/relatorio";

const MES_CURTO = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/** O espelho do mês como o colaborador recebe: só leitura, pronto para imprimir. */
export function EspelhoDoRelatorio({ d }: { d: DadosDoRelatorio }) {
  const banco = d.regime === "BANCO_DE_HORAS";
  const t = d.totais;
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm print:border-0 print:shadow-none">
      <header className="border-b border-slate-100 px-4 py-3">
        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">Espelho de ponto · {d.empresa}</p>
        <h2 className="text-lg font-semibold text-slate-900">{d.pessoa.nome}</h2>
        <p className="text-sm text-slate-600 first-letter:uppercase">
          {nomeDoMes(d.mes)} · {horas(d.cargaSemanal)} semanais
        </p>
      </header>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-medium">Dia</th>
              <th className="px-3 py-2 font-medium">Marcações</th>
              <th className="px-3 py-2 text-right font-medium">Trabalhado</th>
              <th className="px-3 py-2 text-right font-medium">{banco ? "Saldo" : "Extra / falta"}</th>
              <th className="px-3 py-2 font-medium">Obs.</th>
            </tr>
          </thead>
          <tbody>
            {d.dias
              .filter((x) => !x.foraDoPeriodo)
              .map((x) => {
                const [, m, dia] = x.dia.split("-").map(Number);
                return (
                  <tr key={x.dia} className={`border-b border-slate-100 align-top ${x.semana === 0 || x.semana === 6 ? "bg-slate-50" : ""}`}>
                    <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">
                      {String(dia).padStart(2, "0")}/{MES_CURTO[m - 1]} <span className="text-slate-500">{DIAS_DA_SEMANA[x.semana]}</span>
                    </td>
                    <td className="px-3 py-1.5 tabular-nums">
                      {x.batidas.length
                        ? x.batidas.map((b) => `${relogio(b.minuto)}${b.manual ? "*" : ""}`).join("  ")
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{x.trabalhado ? horas(x.trabalhado) : ""}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums ${x.saldo > 0 ? "text-emerald-700" : x.saldo < 0 ? "text-red-700" : "text-slate-400"}`}>
                      {x.emAndamento ? "" : banco ? saldoEscrito(x.saldo) : [x.extras50 + x.extras100 ? `+${horas(x.extras50 + x.extras100)}` : "", x.debito ? `-${horas(x.debito)}` : ""].filter(Boolean).join(" ") || "0:00"}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-slate-600">
                      {[x.ocorrencia ? NOME_DA_OCORRENCIA[x.ocorrencia] : null, ...x.alertas].filter(Boolean).join(" · ")}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <div className="grid gap-x-6 gap-y-1 border-t border-slate-200 px-4 py-3 text-sm text-slate-700 sm:grid-cols-3">
        <p>Previsto: <b className="tabular-nums">{horas(t.previsto)}</b></p>
        <p>Trabalhado: <b className="tabular-nums">{horas(t.trabalhado)}</b></p>
        <p>Abonado: <b className="tabular-nums">{horas(t.abonado)}</b></p>
        <p>Extras 50%: <b className="tabular-nums">{horas(t.extras50)}</b></p>
        <p>Extras 100%: <b className="tabular-nums">{horas(t.extras100)}</b></p>
        <p>Atrasos e faltas: <b className="tabular-nums">{horas(t.debito)}</b> ({t.faltas} falta{t.faltas === 1 ? "" : "s"})</p>
        {banco ? <p>Saldo do mês: <b className="tabular-nums">{saldoEscrito(t.saldo)}</b></p> : null}
        {d.saldoBanco !== null ? <p>Banco de horas: <b className="tabular-nums">{saldoEscrito(d.saldoBanco)}</b></p> : null}
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">* batida incluída pelo RH.</p>
    </section>
  );
}
