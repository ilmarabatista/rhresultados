/**
 * O processo seletivo: vagas, etapas e candidatos.
 *
 * A trilha não é fixa. Cada vaga carrega as suas etapas, copiadas de um modelo
 * no dia em que a vaga foi aberta e editáveis ali — mexer no modelo depois não
 * mexe nas vagas abertas. O que o sistema precisa saber de cada etapa é só o
 * tipo: o que ela cobra do candidato (ficha, teste, entrevista) e, por isso, o
 * que pode ficar pendente.
 */

export type EtapaTipo = "TRIAGEM" | "FICHA" | "TESTE" | "ENTREVISTA" | "LIVRE" | "DECISAO";

export const TIPOS_DE_ETAPA: { valor: EtapaTipo; rotulo: string; dica: string }[] = [
  { valor: "TRIAGEM", rotulo: "Triagem", dica: "leitura do currículo, sem nada a cobrar do candidato" },
  { valor: "FICHA", rotulo: "Ficha", dica: "a ficha de solicitação de emprego, respondida pelo link" },
  { valor: "TESTE", rotulo: "Teste", dica: "um ou mais testes enviados por link" },
  { valor: "ENTREVISTA", rotulo: "Entrevista", dica: "conversa marcada, que vai para a agenda" },
  { valor: "LIVRE", rotulo: "Outra", dica: "dinâmica, prova prática, visita — o que você quiser" },
  { valor: "DECISAO", rotulo: "Decisão", dica: "aprovar, reprovar ou encaminhar ao cliente" },
];

export function rotuloDoTipo(tipo: string): string {
  return TIPOS_DE_ETAPA.find((t) => t.valor === tipo)?.rotulo ?? "Outra";
}

export function tipoValido(valor: string): valor is EtapaTipo {
  return TIPOS_DE_ETAPA.some((t) => t.valor === valor);
}

/** As etapas que já vêm prontas ao criar o primeiro modelo. */
export const MODELO_SUGERIDO: { nome: string; tipo: EtapaTipo; prazoDias: number | null }[] = [
  { nome: "Triagem de currículos", tipo: "TRIAGEM", prazoDias: 5 },
  { nome: "Ficha de solicitação", tipo: "FICHA", prazoDias: 3 },
  { nome: "Testes", tipo: "TESTE", prazoDias: 5 },
  { nome: "Entrevista", tipo: "ENTREVISTA", prazoDias: 7 },
  { nome: "Decisão", tipo: "DECISAO", prazoDias: 5 },
];

export type Situacao = "EM_ANDAMENTO" | "APROVADO" | "REPROVADO" | "DESISTIU";

export const SITUACOES: { valor: Situacao; rotulo: string }[] = [
  { valor: "EM_ANDAMENTO", rotulo: "Em andamento" },
  { valor: "APROVADO", rotulo: "Aprovado" },
  { valor: "REPROVADO", rotulo: "Reprovado" },
  { valor: "DESISTIU", rotulo: "Desistiu" },
];

// --------------------------------------------------------------- pendências

/**
 * O que está parado, do ponto de vista de quem conduz.
 *
 * São três coisas diferentes, e misturá-las esconde a que importa: o candidato
 * que recebeu um link e não devolveu (cobrar), o que passou do prazo da etapa
 * (destravar) e o que saiu do processo sem receber retorno (avisar).
 */
export type Pendencia = "ESPERANDO_RESPOSTA" | "PARADO" | "SEM_RETORNO";

export const PENDENCIAS: Record<Pendencia, { rotulo: string; dica: string }> = {
  ESPERANDO_RESPOSTA: { rotulo: "Esperando resposta", dica: "o link foi enviado e ainda não voltou" },
  PARADO: { rotulo: "Parado", dica: "passou do prazo desta etapa" },
  SEM_RETORNO: { rotulo: "Sem retorno", dica: "saiu do processo e ainda não foi avisado" },
};

export type CandidatoParaPendencia = {
  situacao: string;
  etapaTipo: EtapaTipo | null;
  etapaPrazoDias: number | null;
  etapaDesde: Date;
  /** Ficha ou teste enviados e ainda sem resposta. */
  esperandoResposta: boolean;
  avisado: boolean;
};

export function diasDesde(data: Date, agora = new Date()): number {
  return Math.floor((agora.getTime() - data.getTime()) / 86_400_000);
}

/**
 * As pendências de um candidato, na ordem em que valem a pena aparecer.
 *
 * Quem saiu do processo só pende de retorno: cobrar ficha de reprovado seria
 * constrangimento, e é justamente o que o sistema existe para evitar.
 */
export function pendenciasDoCandidato(c: CandidatoParaPendencia, agora = new Date()): Pendencia[] {
  if (c.situacao !== "EM_ANDAMENTO") {
    return c.avisado ? [] : ["SEM_RETORNO"];
  }
  const fora: Pendencia[] = [];
  if (c.esperandoResposta) fora.push("ESPERANDO_RESPOSTA");
  if (c.etapaPrazoDias != null && diasDesde(c.etapaDesde, agora) > c.etapaPrazoDias) fora.push("PARADO");
  return fora;
}

// -------------------------------------------------------------------- funil

export type EtapaDoFunil = {
  id: string;
  nome: string;
  /** Quantos estão nesta etapa agora. */
  agora: number;
  /** Quantos já passaram por ela, em todo o processo. */
  passaram: number;
  /** Quantos pararam aqui: reprovados ou desistentes. */
  pararam: number;
};

/**
 * O funil da vaga: por onde os candidatos passaram e onde pararam.
 *
 * "Passaram" conta pelo histórico, não pela etapa atual: quem foi reprovado na
 * entrevista passou pela triagem, e some do quadro sem sumir da conta.
 */
export function funilDaVaga(
  etapas: { id: string; nome: string }[],
  candidatos: { etapaId: string | null; situacao: string; movimentos: { etapaId: string | null; resultado: string }[] }[],
): EtapaDoFunil[] {
  return etapas.map((e) => {
    const passaram = candidatos.filter((c) => c.movimentos.some((m) => m.etapaId === e.id && m.resultado === "ENTROU")).length;
    const pararam = candidatos.filter((c) =>
      c.movimentos.some((m) => m.etapaId === e.id && (m.resultado === "REPROVADO" || m.resultado === "DESISTIU")),
    ).length;
    const agora = candidatos.filter((c) => c.etapaId === e.id && c.situacao === "EM_ANDAMENTO").length;
    return { id: e.id, nome: e.nome, agora, passaram, pararam };
  });
}

// ------------------------------------------------------- recados ao candidato

/** O primeiro nome, que é como ela fala com o candidato. */
export function primeiroNome(nome: string): string {
  return nome.trim().split(/\s+/)[0] ?? nome;
}

export function recadoDeCobranca(nome: string, oQue: string, link: string | null): string {
  const inicio = `Olá, ${primeiroNome(nome)}! Tudo bem? Estamos aguardando ${oQue} para seguir com o seu processo.`;
  return link ? `${inicio} Segue o link: ${link}` : inicio;
}

export function recadoDeReprovacao(nome: string, vaga: string, empresa: string | null): string {
  const onde = empresa ? ` na ${empresa}` : "";
  return (
    `Olá, ${primeiroNome(nome)}! Obrigada por participar do processo para a vaga de ${vaga}${onde}. ` +
    `Desta vez seguimos com outro candidato, mas o seu currículo fica com a gente para as próximas oportunidades. ` +
    `Desejo sucesso a você!`
  );
}

export function recadoDeAprovacao(nome: string, vaga: string): string {
  return `Olá, ${primeiroNome(nome)}! Tenho uma boa notícia sobre o processo da vaga de ${vaga}. Pode falar agora?`;
}

/** O link do WhatsApp com o recado pronto. Sem telefone, abre a conversa vazia. */
export function linkDoWhatsapp(telefone: string | null, texto: string): string {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const numero = digitos.length >= 10 ? (digitos.startsWith("55") ? digitos : `55${digitos}`) : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}
