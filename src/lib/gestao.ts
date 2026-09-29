/**
 * A estrutura do painel de gestão da consultoria.
 *
 * Fica aqui, como dado, porque é o que precisa ser conferido e corrigido: os
 * grupos do plano de contas, as etapas do funil e a definição de cada número
 * são decisões do negócio, não do software.
 *
 * O contrato da consultoria é de dois tipos — mensalidade e projeto —, e o
 * painel separa os dois em todo lugar. Sem essa separação, um mês fraco de
 * vendas novas parece queda de faturamento, e um mês bom esconde carteira
 * encolhendo.
 */

export type Painel = "comercial" | "gerenciamento" | "despesas" | "metas";

export const PAINEIS: { valor: Painel; label: string; resumo: string }[] = [
  {
    valor: "comercial",
    label: "Comercial",
    resumo: "Propostas enviadas contra contratos fechados, mês a mês.",
  },
  {
    valor: "gerenciamento",
    label: "Gerenciamento",
    resumo: "Receitas, despesas e lucro, com mensalidade e projeto separados.",
  },
  {
    valor: "despesas",
    label: "Despesas",
    resumo: "Lançamento mês a mês, e as linhas do plano de contas.",
  },
  {
    valor: "metas",
    label: "Metas e tráfego",
    resumo: "O funil pago, do lead ao contrato, e o retorno de cada real.",
  },
];

/** Os grupos em que as linhas de despesa se organizam, na ordem da tabela. */
export const GRUPOS: { valor: string; label: string }[] = [
  { valor: "PESSOAS", label: "Pessoas" },
  { valor: "ENTREGA", label: "Custo de entrega" },
  { valor: "ESTRUTURA", label: "Estrutura" },
  { valor: "IMPOSTOS", label: "Impostos" },
  { valor: "FUNDOS", label: "Fundos e reservas" },
];

export function rotuloDoGrupo(valor: string | null): string {
  if (!valor) return "Sem grupo";
  return GRUPOS.find((g) => g.valor === valor)?.label ?? valor;
}

/**
 * As linhas sugeridas quando o plano de contas ainda está vazio.
 * São ponto de partida: tudo aqui é editável na tela.
 */
export const LINHAS_SUGERIDAS: {
  name: string;
  group: string;
  notes?: string;
}[] = [
  { name: "Pró-labore", group: "PESSOAS" },
  { name: "Folha de pagamento (equipe interna)", group: "PESSOAS" },
  { name: "FGTS / GPS", group: "PESSOAS" },
  { name: "Comissões e bonificações", group: "PESSOAS" },
  {
    name: "Consultores parceiros (PJ)",
    group: "PESSOAS",
    notes: "Quem entrega e não está na folha.",
  },
  {
    name: "Testes e avaliações compradas",
    group: "ENTREGA",
    notes: "Perfil comportamental, avaliação psicológica, teste técnico.",
  },
  {
    name: "Publicação de vagas e banco de currículos",
    group: "ENTREGA",
    notes: "Varia com o número de vagas abertas.",
  },
  { name: "Material de treinamento e locação de sala", group: "ENTREGA" },
  {
    name: "Deslocamento e viagem até o cliente",
    group: "ENTREGA",
    notes: "Custo direto de quem vai até a empresa.",
  },
  {
    name: "Garantia — reposição de candidato",
    group: "ENTREGA",
    notes: "Recolocação dentro do prazo: entrega refeita sem receita nova.",
  },
  { name: "Aluguel + IPTU + condomínio", group: "ESTRUTURA" },
  {
    name: "Ferramentas e assinaturas",
    group: "ESTRUTURA",
    notes: "Software de RH, plataforma de testes, este sistema.",
  },
  { name: "Marketing — impulsionamento e agência", group: "ESTRUTURA" },
  { name: "Contabilidade e jurídico", group: "ESTRUTURA" },
  { name: "Mentoria e associações", group: "ESTRUTURA" },
  { name: "Demais despesas", group: "ESTRUTURA" },
  { name: "Impostos (DAS / DARF)", group: "IMPOSTOS" },
  { name: "Fundo de reserva", group: "FUNDOS" },
  { name: "Fundo de melhorias", group: "FUNDOS" },
  { name: "Fundo 13º e férias", group: "FUNDOS" },
];

export type Metrica = { rotulo: string; definicao: string };

export const CARTOES_COMERCIAL: Metrica[] = [
  {
    rotulo: "Propostas",
    definicao: "Quantas propostas saíram no mês.",
  },
  {
    rotulo: "Oportunidade",
    definicao: "Soma do valor das propostas enviadas, com o ticket médio.",
  },
  {
    rotulo: "Fechado",
    definicao: "Soma das propostas assinadas, com a quantidade e o ticket.",
  },
  {
    rotulo: "Conversão",
    definicao:
      "Contratos sobre propostas, em quantidade e em reais — os dois, porque uma proposta grande perdida não aparece na contagem.",
  },
  {
    rotulo: "Em negociação",
    definicao: "Valor em aberto, e há quantos dias a proposta mais antiga está parada.",
  },
  {
    rotulo: "Recusado",
    definicao: "Valor e quantidade das propostas recusadas, com o motivo.",
  },
];

export const TABELAS_COMERCIAL: Metrica[] = [
  {
    rotulo: "Por consultor comercial",
    definicao: "Quem enviou a proposta: propostas, fechou, oportunidade e conversão.",
  },
  {
    rotulo: "Por consultor responsável",
    definicao:
      "Quem vai entregar. Vender bem sem olhar esta tabela é como se fecha mais do que se consegue entregar.",
  },
  {
    rotulo: "Por serviço",
    definicao:
      "Diagnóstico, recrutamento, avaliação de desempenho, treinamento, clima, cultura, análise de cargo — do catálogo que o sistema já tem.",
  },
  {
    rotulo: "Por tipo de contrato",
    definicao: "Mensalidade e projeto lado a lado, em quantidade e em valor.",
  },
  {
    rotulo: "Por origem",
    definicao: "Orgânico, Meta Ads, Google, indicação, base própria, evento.",
  },
  {
    rotulo: "Por forma de pagamento",
    definicao: "Boleto, Pix, cartão, transferência, com o parcelamento médio.",
  },
  {
    rotulo: "Linha a linha",
    definicao:
      "Cada proposta: data, cliente, quem vendeu, quem entrega, origem, forma, parcelas, valor, situação e entrada.",
  },
];

export const CARTOES_GERENCIAMENTO: Metrica[] = [
  {
    rotulo: "Receita recorrente (MRR)",
    definicao: "Soma das mensalidades ativas — o que já está resolvido do mês que vem.",
  },
  {
    rotulo: "Receita de projeto",
    definicao: "Recrutamento, treinamento fechado, diagnóstico avulso.",
  },
  {
    rotulo: "Total de receitas",
    definicao: "Entradas confirmadas no mês, por forma de pagamento.",
  },
  {
    rotulo: "Despesas",
    definicao: "Pagamentos efetuados, com o peso de cada linha sobre a receita.",
  },
  { rotulo: "Lucro e margem", definicao: "Receitas menos despesas, com a margem do mês." },
  {
    rotulo: "Peso das pessoas",
    definicao:
      "Folha, pró-labore e parceiros sobre a receita. Numa consultoria, é o que mais aperta a margem.",
  },
  {
    rotulo: "Carteira",
    definicao: "Clientes ativos, entradas e saídas do mês, e o ticket médio mensal.",
  },
  {
    rotulo: "Churn",
    definicao: "Contratos encerrados no mês, em quantidade e em mensalidade perdida.",
  },
  {
    rotulo: "Inadimplência",
    definicao: "Vencido e não pago, e o que está em aberto há mais de três dias.",
  },
];

/**
 * O funil do tráfego pago, com cinco etapas.
 *
 * A proposta é etapa própria porque, em venda para empresa, é entre a reunião
 * e o fechamento que a maior parte das oportunidades morre.
 */
export const ETAPAS_DO_FUNIL = [
  "Lead",
  "Reunião marcada",
  "Reunião realizada",
  "Proposta enviada",
  "Contrato assinado",
];

export const CARTOES_METAS: Metrica[] = [
  {
    rotulo: "Faturamento no ano",
    definicao: "O que os clientes vindos de tráfego faturaram, pela data do fechamento.",
  },
  { rotulo: "Funil", definicao: "As cinco etapas e a taxa de passagem entre elas." },
  { rotulo: "Investimento e CPL", definicao: "Quanto foi investido e o custo por lead." },
  {
    rotulo: "CAC",
    definicao: "Investimento dividido por contratos assinados.",
  },
  {
    rotulo: "Payback",
    definicao:
      "Quantos meses de mensalidade pagam o CAC. Num contrato recorrente, é ele que diz se o anúncio compensa — não o retorno do primeiro mês.",
  },
  { rotulo: "Retorno", definicao: "Faturamento sobre investimento, no mês e no ano." },
];

export const COLUNAS_TRAFEGO = [
  "Mês",
  "Leads",
  "Reuniões marcadas",
  "Realizadas",
  "Propostas",
  "Contratos",
  "Faturamento",
  "Entrada",
  "Oportunidade",
  "Investimento",
  "CPL",
  "CAC",
  "Retorno",
];

// ------------------------------------------------------------ o dinheiro

export const MESES_CURTOS = [
  "jan",
  "fev",
  "mar",
  "abr",
  "mai",
  "jun",
  "jul",
  "ago",
  "set",
  "out",
  "nov",
  "dez",
];

/** Ano válido para o painel? */
export function anoValido(valor: unknown): boolean {
  const n = Number(valor);
  return Number.isInteger(n) && n >= 2000 && n <= 2100;
}

/** O primeiro dia de cada um dos doze meses do ano, em UTC. */
export function mesesDoAno(ano: number): Date[] {
  return Array.from({ length: 12 }, (_, m) => new Date(Date.UTC(ano, m, 1)));
}

/** "2026-03" a partir de um Date, para casar lançamento com coluna. */
export function chaveDoMes(data: Date): string {
  return `${data.getUTCFullYear()}-${String(data.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Lê um valor digitado em português e devolve centavos inteiros.
 *
 * Aceita "1.234,56", "1234,56", "1234.56", "3.200" e "R$ 1.234,56". Devolve
 * null quando não dá para ler — inclusive para texto vazio, que significa
 * apagar o lançamento.
 *
 * O ponto é ambíguo: em "3.200" é separador de milhar, em "3.20" é decimal.
 * A regra que desempata é a do formato brasileiro — ponto seguido de
 * exatamente três dígitos é milhar. Foi um erro real: "3.200" virava R$ 3,20.
 */
export function lerValor(bruto: string): number | null {
  const limpo = bruto.replace(/[R$\s]/gi, "").trim();
  if (limpo === "") return null;

  let normalizado: string;

  if (limpo.includes(",")) {
    // Com vírgula não há dúvida: ela é o decimal, o ponto é milhar.
    normalizado = limpo.replace(/\./g, "").replace(",", ".");
  } else if (limpo.includes(".")) {
    const partes = limpo.split(".");
    const milhar = partes
      .slice(1)
      .every((p) => p.length === 3 && /^\d{3}$/.test(p));
    normalizado = milhar ? partes.join("") : limpo;
  } else {
    normalizado = limpo;
  }

  if (!/^-?\d+(\.\d+)?$/.test(normalizado)) return null;

  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return null;

  return Math.round(n * 100);
}

/** Centavos em texto brasileiro, sem o símbolo. */
export function formatarValor(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Centavos em texto curto para a tabela densa: "12,3 mil", "1,2 mi". */
export function valorCurto(centavos: number): string {
  const reais = centavos / 100;
  if (reais === 0) return "—";
  if (Math.abs(reais) >= 1_000_000) {
    return `${(reais / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (Math.abs(reais) >= 1_000) {
    return `${(reais / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  }
  return reais.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}

/** Quanto a linha pesa sobre o total, em porcentagem inteira. */
export function peso(valor: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((valor / total) * 100);
}
