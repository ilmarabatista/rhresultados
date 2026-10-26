import { textoSeguro } from "./texto-seguro";

/**
 * A reunião online: o link da videochamada, o convite por WhatsApp e a ata
 * que a IA monta a partir do que foi gravado e transcrito.
 *
 * A gravação é feita pela própria página da reunião (o microfone de quem
 * conduz e o som da aba do Meet), em trechos de poucos minutos; cada trecho
 * vira texto no servidor. Daqui sai o que é puro: o convite, a limpeza do
 * texto transcrito, o pedido à IA e a leitura do que ela devolve. A chamada
 * em si fica em `ai-reuniao.ts`, e a transcrição em `transcricao.ts`.
 */

/** Quanto tempo de gravação vai em cada trecho. Dois minutos dão menos de 1 MB. */
export const SEGUNDOS_POR_TRECHO = 120;

/** O maior trecho de áudio aceito: o servidor publicado recusa acima de 4,5 MB. */
export const TAMANHO_MAXIMO_DO_TRECHO = 4 * 1024 * 1024;

/** Quanto texto de transcrição vai para a IA: umas três horas de conversa. */
export const TETO_DA_TRANSCRICAO = 150_000;

/** Endereço que abre uma reunião nova no Google Meet, já com o link pronto. */
export const NOVO_MEET = "https://meet.google.com/new";

/**
 * O link da videochamada, se parecer um. Aceita o do Meet com ou sem
 * "https://" e qualquer outro https (Zoom, Teams); o resto é recusado.
 */
export function lerLinkDaChamada(cru: string): string | null | "invalido" {
  const t = cru.trim();
  if (!t) return null;
  const comEsquema = /^https?:\/\//i.test(t) ? t : `https://${t}`;
  try {
    const url = new URL(comEsquema);
    if (url.protocol !== "https:" && url.protocol !== "http:") return "invalido";
    if (!url.hostname.includes(".")) return "invalido";
    return url.toString();
  } catch {
    return "invalido";
  }
}

/** O convite que vai pelo WhatsApp: quando, o link e o aviso de gravação. */
export function conviteDaReuniao(c: {
  nome?: string | null;
  titulo: string;
  /** "AAAA-MM-DD". */
  dia: string | null;
  hora: string | null;
  link: string;
  gravada: boolean;
}): string {
  const primeiro = (c.nome ?? "").trim().split(/\s+/)[0] ?? "";
  const quando = c.dia
    ? ` no dia ${c.dia.split("-").reverse().join("/")}${c.hora ? `, às ${c.hora}` : ""}`
    : "";
  return [
    `${primeiro ? `Olá, ${primeiro}!` : "Olá!"} Você está convidado(a) para a reunião "${c.titulo}"${quando}.`,
    `Para entrar, é só abrir este link: ${c.link}`,
    c.gravada
      ? "Aviso: a reunião será gravada e transcrita para o registro da ata."
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Frases que o modelo de transcrição inventa quando o trecho é silêncio ou
 * ruído (aprendeu com legendas de vídeo). Um trecho que é só isso é jogado
 * fora.
 */
const ALUCINACOES = [
  /legendas? pela comunidade amara\.org/gi,
  /legendado por .{0,40}$/gim,
  /obrigad[oa] por assistir!?/gi,
  /inscreva-se no canal!?/gi,
  /tchau,? tchau!?$/gim,
];

/** O texto de um trecho transcrito, sem as frases de silêncio e sem espaço sobrando. */
export function limparTrecho(cru: string): string {
  let t = textoSeguro(cru);
  for (const r of ALUCINACOES) t = t.replace(r, " ");
  return t.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();
}

/** A transcrição inteira, trecho a trecho, com a hora de cada um ("HH:MM"). */
export function juntarTranscricao(trechos: { hora: string; texto: string }[]): string {
  return trechos
    .filter((t) => t.texto.trim())
    .map((t) => `[${t.hora}] ${t.texto.trim()}`)
    .join("\n\n");
}

// ------------------------------------------------------------- pedido à IA

export const SYSTEM_DA_REUNIAO = [
  "Você organiza a ata de reuniões de uma consultoria de RH, a partir da transcrição automática do que foi falado.",
  "A transcrição pode ter erros de reconhecimento de voz e não diz quem falou: use o contexto, sem inventar nada que não esteja nela.",
  "Escreva em português do Brasil, com frases curtas e claras, sem emoji.",
  "Responda só com um objeto JSON, sem texto antes ou depois, no formato:",
  '{"resumo": "...", "conversado": ["..."], "decidido": [{"texto": "...", "porque": "..."}], "combinado": [{"texto": "...", "responsavel": "...", "prazo": "AAAA-MM-DD"}]}',
  "resumo: um parágrafo de 3 a 6 frases com o objetivo e o desfecho da reunião.",
  "conversado: os assuntos tratados, um por item, que servem de contexto.",
  "decidido: o que ficou decidido, com o motivo quando ele foi dito (senão, porque vazio).",
  "combinado: as tarefas e próximos passos, com quem faz e a data, só quando foram ditos (senão, vazios). Datas relativas (\"sexta que vem\") viram data a partir do dia da reunião.",
  "Se a transcrição não tiver nada de uma parte, devolva a lista vazia.",
].join("\n");

export function pedidoDaReuniao(c: {
  titulo: string;
  /** "AAAA-MM-DD". */
  dia: string | null;
  participantes: string[];
  pauta: string;
  transcricao: string;
}): string {
  return [
    `Reunião: ${c.titulo}`,
    c.dia ? `Dia da reunião: ${c.dia}` : "",
    c.participantes.length ? `Participantes convocados: ${c.participantes.join(", ")}` : "",
    c.pauta.trim() ? `Pauta prevista:\n${c.pauta.trim()}` : "",
    `Transcrição (cada trecho começa com a hora em que foi gravado):\n${c.transcricao.slice(0, TETO_DA_TRANSCRICAO)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

export type AtaDaIA = {
  resumo: string;
  conversado: string[];
  decidido: { texto: string; porque: string }[];
  combinado: { texto: string; responsavel: string; prazo: string | null }[];
};

function texto(v: unknown, max: number): string {
  return typeof v === "string" ? textoSeguro(v).trim().slice(0, max) : "";
}

function lista(v: unknown): unknown[] {
  return Array.isArray(v) ? v.slice(0, 40) : [];
}

/** Só uma data de verdade "AAAA-MM-DD"; o resto vira sem data. */
function dataOuNada(v: unknown): string | null {
  const t = texto(v, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const d = new Date(`${t}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== t ? null : t;
}

/** Lê o que a IA devolveu, descartando o que vier fora do formato. */
export function ataDaIA(lido: unknown): AtaDaIA {
  const o = (lido && typeof lido === "object" ? lido : {}) as Record<string, unknown>;
  const obj = (v: unknown) => (v && typeof v === "object" ? (v as Record<string, unknown>) : {});

  return {
    resumo: texto(o.resumo, 4_000),
    conversado: lista(o.conversado)
      .map((v) => texto(typeof v === "string" ? v : obj(v).texto, 1_000))
      .filter(Boolean),
    decidido: lista(o.decidido)
      .map((v) =>
        typeof v === "string"
          ? { texto: texto(v, 1_000), porque: "" }
          : { texto: texto(obj(v).texto, 1_000), porque: texto(obj(v).porque, 1_000) },
      )
      .filter((d) => d.texto),
    combinado: lista(o.combinado)
      .map((v) =>
        typeof v === "string"
          ? { texto: texto(v, 1_000), responsavel: "", prazo: null }
          : {
              texto: texto(obj(v).texto, 1_000),
              responsavel: texto(obj(v).responsavel, 120),
              prazo: dataOuNada(obj(v).prazo),
            },
      )
      .filter((c) => c.texto),
  };
}
