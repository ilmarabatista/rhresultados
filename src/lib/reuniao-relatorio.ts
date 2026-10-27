import { situacaoDoCombinado, type SituacaoDoCombinado } from "./reunioes";

/**
 * O relatório da reunião para a gestão da empresa: o que foi tratado, o que
 * ficou decidido, quem ficou de fazer o quê e até quando, e o que ainda está
 * em aberto de reuniões anteriores.
 *
 * Sai da própria reunião (presença, resumo e ata), sem nada guardado à parte:
 * corrigir a ata corrige o relatório. Daqui sai também o texto que vai pelo
 * WhatsApp, no formato que ele entende (*negrito*). Puro, para ser testado
 * sem banco.
 */

export type CombinadoDoRelatorio = {
  texto: string;
  responsavel: string | null;
  /** "AAAA-MM-DD". */
  prazo: string | null;
  feito: boolean;
};

export type RelatorioDaReuniao = {
  empresa: string;
  titulo: string;
  codigo: string;
  /** "AAAA-MM-DD". */
  dia: string | null;
  hora: string | null;
  presentes: string[];
  ausentes: string[];
  resumo: string;
  conversado: string[];
  decidido: { texto: string; porque: string | null }[];
  combinado: CombinadoDoRelatorio[];
  /** Combinados de reuniões anteriores da empresa que ainda não foram feitos. */
  emAberto: (CombinadoDoRelatorio & { reuniao: string })[];
};

const escrito = (dia: string) => dia.split("-").reverse().join("/");

export const ROTULO_DO_PRAZO: Record<SituacaoDoCombinado, string> = {
  FEITO: "feito",
  ATRASADO: "atrasado",
  HOJE: "vence hoje",
  NO_PRAZO: "no prazo",
  SEM_DATA: "sem data",
};

/** "Ana · até 30/10/2026 · atrasado": o que acompanha cada combinado. */
export function detalheDoCombinado(c: CombinadoDoRelatorio, hoje: string): string {
  const situacao = situacaoDoCombinado({ feito: c.feito, prazo: c.prazo }, hoje);
  return [
    c.responsavel || "sem responsável",
    c.prazo ? `até ${escrito(c.prazo)}` : null,
    situacao === "SEM_DATA" ? null : ROTULO_DO_PRAZO[situacao],
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Os em aberto de antes, os atrasados primeiro e depois pelo prazo. */
export function ordenarEmAberto<T extends { prazo: string | null }>(lista: T[]): T[] {
  return [...lista].sort((a, b) => {
    if (a.prazo && b.prazo) return a.prazo.localeCompare(b.prazo);
    return a.prazo ? -1 : b.prazo ? 1 : 0;
  });
}

/** O relatório em texto, para colar ou mandar pelo WhatsApp. */
export function textoDoRelatorio(r: RelatorioDaReuniao, hoje: string): string {
  const partes: string[] = [];
  const quando = r.dia ? `${escrito(r.dia)}${r.hora ? `, ${r.hora}` : ""}` : "sem data";

  partes.push(`*Relatório de reunião · ${r.empresa}*\n${r.titulo} (${r.codigo})\n${quando}`);

  const total = r.presentes.length + r.ausentes.length;
  if (total) {
    partes.push(
      `*Participantes:* ${r.presentes.length} de ${total} presentes` +
        (r.presentes.length ? `\n${r.presentes.join(", ")}` : "") +
        (r.ausentes.length ? `\nAusentes: ${r.ausentes.join(", ")}` : ""),
    );
  }

  if (r.resumo.trim()) partes.push(`*Resumo*\n${r.resumo.trim()}`);

  if (r.decidido.length) {
    partes.push(
      `*Decisões*\n${r.decidido.map((d) => `• ${d.texto}${d.porque ? ` (${d.porque})` : ""}`).join("\n")}`,
    );
  }

  if (r.combinado.length) {
    partes.push(
      `*Próximos passos*\n${r.combinado.map((c) => `• ${c.texto} — ${detalheDoCombinado(c, hoje)}`).join("\n")}`,
    );
  }

  if (r.conversado.length) {
    partes.push(`*Assuntos tratados*\n${r.conversado.map((t) => `• ${t}`).join("\n")}`);
  }

  if (r.emAberto.length) {
    partes.push(
      `*Ainda em aberto de reuniões anteriores*\n${r.emAberto
        .map((c) => `• ${c.texto} — ${detalheDoCombinado(c, hoje)} (${c.reuniao})`)
        .join("\n")}`,
    );
  }

  if (!r.resumo.trim() && !r.decidido.length && !r.combinado.length && !r.conversado.length) {
    partes.push("A ata desta reunião ainda não foi preenchida.");
  }

  return partes.join("\n\n");
}
