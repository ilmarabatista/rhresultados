import Link from "next/link";
import { redirect } from "next/navigation";
import { sessaoAtual } from "@/lib/sessao";
import { jornadaAtual } from "@/lib/batidas";
import { proximaBatida, relogio } from "@/lib/calculo";
import { todayKey } from "@/lib/dates";
import { nomeDoMes } from "@/lib/calculo";
import { mesesParaAprovar } from "@/lib/relatorio";
import { Registrar } from "@/components/registrar";
import { Cartao, Etiqueta, Topo } from "@/components/ui";

export const dynamic = "force-dynamic";

/** O painel do colaborador: as batidas do dia e o botão de registrar. */
export default async function InicioPage() {
  const s = await sessaoAtual();
  if (!s) redirect("/entrar");
  if (s.tipo === "admin") redirect("/admin");
  if (s.trocarSenha) redirect("/trocar-senha");

  const { dia, batidas } = await jornadaAtual(s.id);
  const pendentes = await mesesParaAprovar(s.id);
  const proxima = proximaBatida(batidas.length);
  const dataEscrita = new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(
    new Date(`${dia}T00:00:00Z`),
  );

  return (
    <>
      <Topo
        titulo="Ponto"
        nome={s.nome}
        links={[
          { href: "/folgas", rotulo: "Folgas" },
          { href: "/pedidos", rotulo: "Atestado e correção" },
          { href: "/meu-ponto", rotulo: pendentes.length ? `Meu ponto (${pendentes.length})` : "Meu ponto" },
          { href: "/trocar-senha", rotulo: "Senha" },
        ]}
      />
      <main className="mx-auto max-w-md space-y-4 px-4 py-6">
        <div>
          <p className="text-sm text-slate-500">{s.empresa.nome}</p>
          <h1 className="text-xl font-semibold text-slate-900 first-letter:uppercase">
            {dataEscrita}
            {dia !== todayKey() ? <span className="ml-2 align-middle text-sm font-normal normal-case text-slate-500">(turno de ontem)</span> : null}
          </h1>
        </div>

        <Cartao titulo="Pontos de hoje">
          {batidas.length === 0 ? (
            <p className="text-sm text-slate-500">Nenhum ponto registrado ainda.</p>
          ) : (
            <ol className="divide-y divide-slate-100">
              {batidas.map((b, i) => (
                <li key={b.id} className="flex items-center justify-between py-2">
                  <span className="text-sm text-slate-600">{proximaBatida(i)}</span>
                  <span className="flex items-center gap-2">
                    {b.origem === "MANUAL" ? <Etiqueta tom="atencao">corrigida *</Etiqueta> : null}
                    <span className="text-lg font-semibold tabular-nums text-slate-900">
                      {relogio(b.minuto)}
                      {b.minuto >= 1440 ? <sup className="text-xs">+1</sup> : null}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Cartao>

        <Cartao>
          {s.empresa.ativo ? (
            <Registrar proxima={proxima} />
          ) : (
            <p className="text-sm text-slate-600">O ponto da sua empresa está desativado. Fale com o RH.</p>
          )}
        </Cartao>

        <Link href="/pedidos" className="block rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm hover:border-marca-400">
          Esqueceu de bater, bateu errado ou tem atestado? <span className="font-medium text-marca-700">Peça ao RH por aqui.</span>
        </Link>

        {pendentes.length ? (
          <Link href={`/meu-ponto?mes=${pendentes[0]}`} className="block rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            {pendentes.length === 1 ? (
              <>
                O espelho de <b>{nomeDoMes(pendentes[0])}</b> está pronto. Confira e aprove.
              </>
            ) : (
              <>Você tem {pendentes.length} meses de ponto para conferir e aprovar.</>
            )}
          </Link>
        ) : (
          <Link href="/meu-ponto" className="block text-center text-sm text-marca-700 underline">
            Ver meu espelho de ponto e banco de horas
          </Link>
        )}
      </main>
    </>
  );
}
