import Link from "next/link";
import {
  CARTOES_COMERCIAL,
  CARTOES_GERENCIAMENTO,
  CARTOES_METAS,
  COLUNAS_TRAFEGO,
  ETAPAS_DO_FUNIL,
  formatarValor,
  MESES_CURTOS,
  PAINEIS,
  type Metrica,
  type Painel,
} from "@/lib/gestao";
import ExpenseGrid, { type LinhaDespesa } from "./expense-grid";

/**
 * Painel de gestão da consultoria.
 *
 * Denso de propósito: a leitura é de fechamento mensal, e quem olha quer ver
 * o ano inteiro sem rolar. Só a aba Despesas tem dado de verdade; as outras
 * três mostram a estrutura enquanto a origem dos números não existe.
 */

const CARTAO =
  "rounded-lg border border-slate-200 bg-white px-3 py-2";

function Cartao({ metrica }: { metrica: Metrica }) {
  return (
    <div className={CARTAO}>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">
        {metrica.rotulo}
      </p>
      <p className="mt-0.5 text-lg font-semibold text-slate-300">—</p>
      <p className="mt-0.5 text-[10px] leading-snug text-slate-400">
        {metrica.definicao}
      </p>
    </div>
  );
}

function Grafico({ titulo, nota }: { titulo: string; nota: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-3">
      <h3 className="text-xs font-semibold text-slate-800">{titulo}</h3>
      <p className="mt-0.5 text-[10px] text-slate-400">{nota}</p>
      <div className="mt-2 flex h-24 items-end gap-1">
        {MESES_CURTOS.map((m, i) => (
          <div key={m} className="flex flex-1 flex-col items-center gap-1">
            <div
              className="w-full rounded-t bg-slate-100"
              style={{ height: `${20 + ((i * 37) % 60)}%` }}
              aria-hidden
            />
            <span className="text-[9px] text-slate-300">{m}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function TabelaVazia({
  titulo,
  colunas,
  linhas,
}: {
  titulo: string;
  colunas: string[];
  linhas: string[];
}) {
  return (
    <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-3 py-1.5">
        <h3 className="text-[11px] font-semibold text-slate-800">{titulo}</h3>
      </div>
      <table className="w-full min-w-[420px] text-[11px]">
        <thead>
          <tr className="bg-slate-50/70 text-[10px] uppercase tracking-wide text-slate-400">
            <th className="px-3 py-1.5 text-left font-medium">{colunas[0]}</th>
            {colunas.slice(1).map((c) => (
              <th key={c} className="px-3 py-1.5 text-right font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {/* Linhas de exemplo se repetem ("—", "—"), então quem
              identifica é a posição, e não o texto. */}
          {linhas.map((l, i) => (
            <tr key={i}>
              <td className="px-3 py-1 text-slate-600">{l}</td>
              {colunas.slice(1).map((c) => (
                <td key={c} className="px-3 py-1 text-right text-slate-300">
                  —
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ---------------------------------------------------------------- painéis

function Comercial() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Grafico
          titulo="Proposto × fechado"
          nota="Duas barras por mês: o que foi proposto e o que virou contrato."
        />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
          {[
            "Fechado no ano",
            "Média mensal",
            "Oportunidade no ano",
            "Ticket médio do contrato",
          ].map((r) => (
            <div key={r} className={CARTAO}>
              <p className="text-[10px] uppercase tracking-wide text-slate-400">
                {r}
              </p>
              <p className="mt-0.5 text-base font-semibold text-slate-300">—</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CARTOES_COMERCIAL.map((m) => (
          <Cartao key={m.rotulo} metrica={m} />
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <TabelaVazia
          titulo="Por consultor comercial"
          colunas={["Consultor", "Propostas", "Fechou", "Oportunidade", "Fechado", "Conv."]}
          linhas={["—", "—", "Total"]}
        />
        <TabelaVazia
          titulo="Por consultor responsável"
          colunas={["Consultor", "Contratos", "Carteira", "Valor", "Conv."]}
          linhas={["—", "—", "Total"]}
        />
        <TabelaVazia
          titulo="Por serviço"
          colunas={["Serviço", "Propostas", "Fechou", "Valor", "Conv."]}
          linhas={[
            "Diagnóstico geral",
            "Recrutamento e seleção",
            "Avaliação de desempenho",
            "Treinamento",
            "Análise de clima",
            "Total",
          ]}
        />
        <TabelaVazia
          titulo="Por origem"
          colunas={["Origem", "Propostas", "Fechou", "Valor", "Conv."]}
          linhas={[
            "Orgânico",
            "Meta Ads",
            "Google Ads",
            "Indicação",
            "Base própria",
            "Total",
          ]}
        />
        <TabelaVazia
          titulo="Por tipo de contrato"
          colunas={["Tipo", "Contratos", "Valor", "Ticket"]}
          linhas={["Mensalidade", "Projeto", "Total"]}
        />
        <TabelaVazia
          titulo="Por forma de pagamento"
          colunas={["Forma", "Contratos", "Valor", "Parcelas"]}
          linhas={["Boleto", "Pix", "Cartão", "Transferência", "Total"]}
        />
      </div>

      <TabelaVazia
        titulo="Linha a linha"
        colunas={[
          "Data",
          "Cliente",
          "Vendeu",
          "Entrega",
          "Origem",
          "Tipo",
          "Valor",
          "Situação",
        ]}
        linhas={["—", "—", "—"]}
      />

      <p className="text-[11px] leading-relaxed text-slate-400">
        As tabelas ficam vazias porque a proposta ainda não é registrada no
        sistema. Ela é o próximo passo: hoje o funil vai do lead
        (aba <strong>Leads</strong>) direto para a empresa cadastrada, sem a
        proposta no meio.
      </p>
    </div>
  );
}

function Gerenciamento() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-3">
        <Grafico titulo="Receitas" nota="Mensalidade e projeto, mês a mês." />
        <Grafico titulo="Despesas" nota="Vem da aba Despesas, já com dado real." />
        <Grafico titulo="Lucro" nota="Receitas menos despesas, com a margem." />
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-5">
        {CARTOES_GERENCIAMENTO.map((m) => (
          <Cartao key={m.rotulo} metrica={m} />
        ))}
      </div>

      <TabelaVazia
        titulo="Receitas por forma de pagamento"
        colunas={[...MESES_CURTOS.map((m) => m), "Ano"]}
        linhas={["Boleto", "Pix", "Cartão", "Transferência", "Total"]}
      />

      <p className="text-[11px] leading-relaxed text-slate-400">
        A despesa já é real e vem da aba <strong>Despesas</strong>. Falta o
        outro lado: a receita, que depende de registrar contrato e recebimento.
        Enquanto isso, lucro e margem ficam sem base.
      </p>
    </div>
  );
}

function Metas() {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[2fr_1fr]">
        <Grafico
          titulo="Faturamento vindo de tráfego pago"
          nota="Pela data em que o contrato foi assinado."
        />
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <h3 className="text-xs font-semibold text-slate-800">O funil</h3>
          <ol className="mt-2 space-y-1">
            {ETAPAS_DO_FUNIL.map((e, i) => (
              <li
                key={e}
                className="flex items-center justify-between rounded bg-slate-50 px-2 py-1 text-[11px] text-slate-600"
              >
                <span>
                  <span className="mr-1.5 text-slate-300">{i + 1}</span>
                  {e}
                </span>
                <span className="text-slate-300">—</span>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {CARTOES_METAS.map((m) => (
          <Cartao key={m.rotulo} metrica={m} />
        ))}
      </div>

      <TabelaVazia
        titulo="Mês a mês"
        colunas={COLUNAS_TRAFEGO}
        linhas={[...MESES_CURTOS, "Total"]}
      />

      <p className="text-[11px] leading-relaxed text-slate-400">
        Depende das abas <strong>Leads</strong> e <strong>Tráfego pago</strong>:
        o funil sai do CRM, o investimento sai da conta de anúncios.
        <strong className="font-medium text-slate-500">
          {" "}
          Payback
        </strong>{" "}
        é o número que decide o anúncio num contrato de mensalidade — o retorno
        do primeiro mês engana.
      </p>
    </div>
  );
}

// ------------------------------------------------------------ a página

export default function ManagementPanel({
  painel,
  ano,
  linhas,
  totalDoAno,
}: {
  painel: Painel;
  ano: number;
  linhas: LinhaDespesa[];
  totalDoAno: number;
}) {
  const atual = PAINEIS.find((p) => p.valor === painel) ?? PAINEIS[0];
  const link = (p: Painel, a: number) => `/gestao?painel=${p}&ano=${a}`;

  return (
    <div className="min-h-screen bg-slate-50/60">
      {/* Barra escura: ano à esquerda, painéis no meio. */}
      <header className="sticky top-0 z-20 bg-slate-900 text-slate-200">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-1.5 sm:px-6">
          <div className="flex items-center gap-1.5">
            <Link
              href={link(painel, ano - 1)}
              className="rounded px-1 text-slate-400 transition hover:text-white"
              aria-label="Ano anterior"
            >
              ‹
            </Link>
            <span className="text-xs font-medium tabular-nums text-white">
              {ano}
            </span>
            <Link
              href={link(painel, ano + 1)}
              className="rounded px-1 text-slate-400 transition hover:text-white"
              aria-label="Próximo ano"
            >
              ›
            </Link>
          </div>

          <nav className="flex flex-wrap items-center gap-x-4">
            {PAINEIS.map((p) => (
              <Link
                key={p.valor}
                href={link(p.valor, ano)}
                className={`border-b-2 py-1 text-[11px] uppercase tracking-wide transition ${
                  p.valor === painel
                    ? "border-amber-400 text-white"
                    : "border-transparent text-slate-400 hover:text-slate-100"
                }`}
              >
                {p.label}
              </Link>
            ))}
          </nav>

          <span className="ml-auto text-[11px] text-slate-400">
            {painel === "despesas" && totalDoAno > 0
              ? `R$ ${formatarValor(totalDoAno)} no ano`
              : atual.resumo}
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-4 py-4 sm:px-6">
        {painel === "despesas" ? (
          <>
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <h1 className="text-sm font-semibold text-slate-900">
                  Despesas de {ano}
                </h1>
                <p className="mt-0.5 text-[11px] text-slate-500">
                  Cada linha é uma conta; cada coluna, um mês. As linhas são
                  suas: renomeie, reordene e crie as que faltarem.
                </p>
              </div>
            </div>
            <ExpenseGrid ano={ano} linhas={linhas} />
          </>
        ) : (
          <>
            {painel === "comercial" ? <Comercial /> : null}
            {painel === "gerenciamento" ? <Gerenciamento /> : null}
            {painel === "metas" ? <Metas /> : null}
          </>
        )}
      </main>
    </div>
  );
}
