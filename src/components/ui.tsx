import Link from "next/link";

/**
 * As peças de tela do sistema.
 *
 * Todas as telas montam a partir daqui, para o sistema inteiro ter a mesma
 * organização. O padrão, na ordem em que aparece numa página:
 *
 *   TituloDaSecao   →  duas palavras, a segunda em azul
 *   Numeros         →  faixa de caixas: rótulo miúdo, número grande, detalhe
 *   Aviso           →  tarja com barra colorida à esquerda, para o que urge
 *   Filtros         →  pílulas com contagem
 *   Tabela          →  cabeçalho azul-escuro, linhas com ação à direita
 *   Painel          →  cartão branco de conteúdo
 *
 * A regra de cor: azul carrega a hierarquia; verde é o que foi feito; âmbar é
 * o que pede atenção; vermelho é o que apaga. Nada além disso.
 *
 * A regra de espaço: apertado. Cabe mais na tela e evita rolar — texto miúdo,
 * respiro curto, e nada de cartão inflado. Se uma peça nova parecer folgada ao
 * lado das outras, é ela que está errada.
 */

// ------------------------------------------------------------- títulos

/**
 * Título de seção em duas partes: a primeira em cinza, a segunda em azul.
 * "Plano de **Tratamento**", "Evolução **Clínica**".
 */
export function TituloDaSecao({
  antes,
  destaque,
  acao,
  className = "",
}: {
  antes: string;
  destaque: string;
  acao?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-2 flex flex-wrap items-center justify-between gap-2 ${className}`}
    >
      <h2 className="text-sm font-medium text-slate-500">
        {antes} <span className="font-semibold text-brand-700">{destaque}</span>
      </h2>
      {acao ? <div className="shrink-0">{acao}</div> : null}
    </div>
  );
}

// -------------------------------------------------------------- números

export type Numero = {
  rotulo: string;
  valor: React.ReactNode;
  /** Linha miúda embaixo do número. */
  detalhe?: React.ReactNode;
  /** Destaca em âmbar quando pede atenção, em verde quando está bom. */
  tom?: "neutro" | "bom" | "atencao" | "ruim";
};

const TOM_DO_NUMERO: Record<string, string> = {
  neutro: "text-brand-800",
  bom: "text-emerald-700",
  atencao: "text-amber-700",
  ruim: "text-red-700",
};

/** A faixa de caixas com os números do período. */
export function Numeros({
  itens,
  colunas = 4,
}: {
  itens: Numero[];
  colunas?: 2 | 3 | 4 | 5 | 6;
}) {
  const grade: Record<number, string> = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
    5: "sm:grid-cols-3 lg:grid-cols-5",
    6: "sm:grid-cols-3 lg:grid-cols-6",
  };

  return (
    <div className={`grid gap-2 ${grade[colunas]}`}>
      {itens.map((n) => (
        <div
          key={n.rotulo}
          className="rounded-lg border border-slate-200 bg-white px-3 py-2"
        >
          <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
            {n.rotulo}
          </p>
          <p
            className={`mt-0.5 text-lg font-semibold leading-tight tabular-nums ${
              TOM_DO_NUMERO[n.tom ?? "neutro"]
            }`}
          >
            {n.valor}
          </p>
          {n.detalhe ? (
            <p className="mt-0.5 text-[11px] leading-snug text-slate-400">
              {n.detalhe}
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------------- aviso

const TOM_DO_AVISO: Record<string, string> = {
  atencao: "border-l-amber-400 bg-amber-50/70 text-amber-900",
  informacao: "border-l-brand-400 bg-brand-50/70 text-brand-900",
  bom: "border-l-emerald-400 bg-emerald-50/70 text-emerald-900",
  ruim: "border-l-red-400 bg-red-50/70 text-red-900",
};

/**
 * A tarja de barra colorida: o que precisa ser visto antes do resto.
 * No print de origem é o "para a próxima consulta".
 */
export function Aviso({
  rotulo,
  children,
  tom = "atencao",
}: {
  rotulo?: string;
  children: React.ReactNode;
  tom?: "atencao" | "informacao" | "bom" | "ruim";
}) {
  return (
    <div
      className={`rounded-lg border border-transparent border-l-4 px-3 py-1.5 ${TOM_DO_AVISO[tom]}`}
    >
      {rotulo ? (
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
          {rotulo}
        </p>
      ) : null}
      <div className="text-xs leading-relaxed">{children}</div>
    </div>
  );
}

// -------------------------------------------------------------- filtros

export type Filtro = {
  rotulo: string;
  href: string;
  contagem?: number;
  ativo?: boolean;
};

/** Pílulas de filtro com contagem, como as especialidades do print. */
export function Filtros({
  rotulo,
  itens,
}: {
  rotulo?: string;
  itens: Filtro[];
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {rotulo ? (
        <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
          {rotulo}
        </span>
      ) : null}

      {itens.map((f) => (
        <Link
          key={f.href}
          href={f.href}
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition ${
            f.ativo
              ? "border-brand-700 bg-brand-700 font-medium text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700"
          }`}
        >
          {f.rotulo}
          {f.contagem !== undefined ? (
            <span
              className={`tabular-nums ${f.ativo ? "text-white/70" : "text-slate-400"}`}
            >
              {f.contagem}
            </span>
          ) : null}
        </Link>
      ))}
    </div>
  );
}

// -------------------------------------------------------------- painel

/** Cartão branco de conteúdo, com cabeçalho opcional. */
export function Painel({
  titulo,
  descricao,
  acao,
  children,
  className = "",
}: {
  titulo?: string;
  descricao?: string;
  acao?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-lg border border-slate-200 bg-white ${className}`}
    >
      {titulo ? (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-100 px-4 py-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{titulo}</h3>
            {descricao ? (
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {descricao}
              </p>
            ) : null}
          </div>
          {acao ? <div className="shrink-0">{acao}</div> : null}
        </div>
      ) : null}
      <div className="p-3.5">{children}</div>
    </section>
  );
}

// -------------------------------------------------------------- tabela

/**
 * Tabela de cabeçalho azul-escuro.
 *
 * `direita` é o canto do cabeçalho — no print, o total da comissão. A tabela
 * rola sozinha quando não cabe, para a página nunca rolar de lado.
 */
export function Tabela({
  titulo,
  direita,
  children,
  minLargura = 0,
}: {
  titulo: string;
  direita?: React.ReactNode;
  children: React.ReactNode;
  minLargura?: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-brand-900 px-3 py-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-wider text-white">
          {titulo}
        </h3>
        {direita ? (
          <span className="text-[11px] font-medium uppercase tracking-wider text-brand-200">
            {direita}
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto">
        <div style={minLargura ? { minWidth: minLargura } : undefined}>
          {children}
        </div>
      </div>
    </div>
  );
}

const BARRA_DA_LINHA: Record<string, string> = {
  neutro: "bg-slate-300",
  azul: "bg-brand-500",
  bom: "bg-emerald-500",
  atencao: "bg-amber-400",
  ruim: "bg-red-400",
};

/**
 * Linha de tabela: barrinha de cor à esquerda, conteúdo, ações à direita.
 * As linhas alternam um fundo levíssimo, como no print.
 */
export function Linha({
  tom = "neutro",
  acoes,
  children,
}: {
  tom?: "neutro" | "azul" | "bom" | "atencao" | "ruim";
  acoes?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-100 px-3 py-1.5 last:border-b-0 even:bg-slate-50/60 hover:bg-brand-50/40">
      <span
        aria-hidden
        className={`h-4 w-1 shrink-0 rounded-full ${BARRA_DA_LINHA[tom]}`}
      />
      <div className="min-w-0 flex-1 text-[13px] leading-snug text-slate-700">{children}</div>
      {acoes ? (
        <div className="flex shrink-0 items-center gap-1.5">{acoes}</div>
      ) : null}
    </div>
  );
}

/** Etiqueta miúda, para tipo, situação e afins. */
export function Etiqueta({
  children,
  tom = "neutro",
}: {
  children: React.ReactNode;
  tom?: "neutro" | "azul" | "bom" | "atencao" | "ruim";
}) {
  const cores: Record<string, string> = {
    neutro: "bg-slate-100 text-slate-600",
    azul: "bg-brand-50 text-brand-700",
    bom: "bg-emerald-50 text-emerald-700",
    atencao: "bg-amber-50 text-amber-800",
    ruim: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cores[tom]}`}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------- progresso

/** Barra de progresso com rótulo e fração, como no painel do print. */
export function Progresso({
  rotulo,
  feito,
  total,
  sufixo,
}: {
  rotulo: string;
  feito: number;
  total: number;
  /** Texto no lugar de "3/8", quando a unidade não é contagem. */
  sufixo?: string;
}) {
  const pct = total > 0 ? Math.round((feito / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-slate-500">{rotulo}</span>
        <span className="text-[11px] tabular-nums text-slate-400">
          {sufixo ?? `${feito}/${total}`}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-brand-600 transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- vazio

/** O que aparece quando não há nada — sempre com a saída à mão. */
export function Vazio({
  children,
  acao,
}: {
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 px-4 py-6 text-center">
      <p className="text-sm text-slate-500">{children}</p>
      {acao ? <div className="mt-3">{acao}</div> : null}
    </div>
  );
}
