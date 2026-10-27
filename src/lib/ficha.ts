import { textoSeguro } from "./texto-seguro";

/**
 * A ficha de solicitação de emprego, preenchida pelo candidato no link.
 *
 * O desenho segue o papel que a consultoria usa: dados pessoais, documentos,
 * família e filhos, formação, experiência, redes sociais, indicação e
 * redação. Os dados de família e documentos são opcionais no link (a
 * consultoria pediu que estivessem na ficha, como no papel). Igreja, ONG e
 * sindicato viraram "trabalho voluntário", e as experiências não têm número
 * fixo.
 *
 * A ficha de papel passada para o sistema leva origem "PAPEL" e a data em que
 * foi preenchida à mão.
 *
 * Tudo aqui é puro, para valer igual no navegador (o rascunho) e no servidor
 * (a conferência antes de gravar).
 */

export const NIVEIS_DE_FORMACAO = [
  "Fundamental incompleto",
  "Fundamental completo",
  "Médio incompleto",
  "Médio completo",
  "Técnico",
  "Superior incompleto",
  "Superior completo",
  "Pós-graduação",
] as const;

export const SITUACOES_DO_CURSO = [
  { valor: "CONCLUIDO", rotulo: "Concluído" },
  { valor: "CURSANDO", rotulo: "Cursando" },
  { valor: "TRANCADO", rotulo: "Trancado ou parado" },
] as const;

/** Quanto a redação pede, em caracteres, em cada uma das duas perguntas. */
export const MINIMO_DA_REDACAO = 300;

export const PERGUNTAS_DA_REDACAO = {
  qualidades:
    "Fale sobre as suas qualidades, os pontos que ainda quer desenvolver e as competências que mais pesam no seu trabalho.",
  expectativas: "O que você espera deste trabalho agora e daqui a alguns anos?",
} as const;

export type Experiencia = {
  empresa: string;
  cargo: string;
  /** "2023-04" */
  entrada: string;
  /** "2024-10", ou vazio quando é o emprego atual. */
  saida: string;
  salario: string;
  motivoSaida: string;
  contato: string;
};

export type Parente = { nome: string; profissao: string };

export type Filho = {
  nome: string;
  /** Como a pessoa escreveu ("5 anos"), quando não deu a data. */
  idade: string;
  /** "2019-03-21" */
  nascimento: string;
};

export type Ficha = {
  versao: 1;
  /** "PAPEL" quando foi passada da ficha preenchida à mão. */
  origem: "" | "PAPEL";
  vaga: { cargo: string; pretensao: string; inicio: string; horarios: string; viagens: "" | "SIM" | "NAO" };
  pessoal: {
    nome: string;
    /** "1995-03-21" */
    nascimento: string;
    naturalidade: string;
    endereco: string;
    bairro: string;
    cep: string;
    cidade: string;
    celular: string;
    email: string;
    sexo: string;
    estadoCivil: string;
    comQuemMora: string;
  };
  documentos: { rg: string; orgao: string; cpf: string };
  familia: { pai: Parente; mae: Parente; conjuge: Parente; filhos: Filho[] };
  formacao: { nivel: string; curso: string; situacao: string; conclusao: string; outrosCursos: string; idiomas: string };
  primeiroEmprego: boolean;
  experiencias: Experiencia[];
  voluntariado: string;
  perfilProfissional: string;
  /** Redes sociais: quais usa e o nome que usa nelas. */
  redes: { quais: string; nome: string };
  indicacao: { indicado: "" | "SIM" | "NAO"; nome: string; cargo: string; proximidade: string };
  redacao: { qualidades: string; expectativas: string };
  /** O que a página mediu enquanto a pessoa escrevia a redação. */
  medidas: { segundosNaRedacao: number; colouNaRedacao: boolean };
  aceite: boolean;
};

export function experienciaVazia(): Experiencia {
  return { empresa: "", cargo: "", entrada: "", saida: "", salario: "", motivoSaida: "", contato: "" };
}

export function filhoVazio(): Filho {
  return { nome: "", idade: "", nascimento: "" };
}

const parenteVazio = (): Parente => ({ nome: "", profissao: "" });

export function fichaVazia(cargo = ""): Ficha {
  return {
    versao: 1,
    origem: "",
    vaga: { cargo, pretensao: "", inicio: "", horarios: "", viagens: "" },
    pessoal: {
      nome: "",
      nascimento: "",
      naturalidade: "",
      endereco: "",
      bairro: "",
      cep: "",
      cidade: "",
      celular: "",
      email: "",
      sexo: "",
      estadoCivil: "",
      comQuemMora: "",
    },
    documentos: { rg: "", orgao: "", cpf: "" },
    familia: { pai: parenteVazio(), mae: parenteVazio(), conjuge: parenteVazio(), filhos: [] },
    formacao: { nivel: "", curso: "", situacao: "", conclusao: "", outrosCursos: "", idiomas: "" },
    primeiroEmprego: false,
    experiencias: [experienciaVazia()],
    voluntariado: "",
    perfilProfissional: "",
    redes: { quais: "", nome: "" },
    indicacao: { indicado: "", nome: "", cargo: "", proximidade: "" },
    redacao: { qualidades: "", expectativas: "" },
    medidas: { segundosNaRedacao: 0, colouNaRedacao: false },
    aceite: false,
  };
}

// ------------------------------------------------------------------- leitura

/** Texto curto: aparado, sem o que o banco não aceita e com teto. */
function curto(v: unknown, max = 200): string {
  return typeof v === "string" ? textoSeguro(v).trim().slice(0, max) : "";
}

function longo(v: unknown, max = 6_000): string {
  return curto(v, max);
}

function objeto(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function umDe<T extends string>(v: unknown, opcoes: readonly T[]): T | "" {
  return typeof v === "string" && (opcoes as readonly string[]).includes(v) ? (v as T) : "";
}

/** Data "AAAA-MM-DD" ou "AAAA-MM", conferida; o resto vira vazio. */
function data(v: unknown, mes = false): string {
  const s = typeof v === "string" ? v.trim() : "";
  return (mes ? /^\d{4}-(0[1-9]|1[0-2])$/ : /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/).test(s) ? s : "";
}

/**
 * Lê uma ficha de qualquer origem — o JSON que o navegador mandou, o rascunho
 * guardado, o que está no banco — sem confiar no formato.
 */
export function lerFicha(cru: unknown): Ficha {
  const o = objeto(cru);
  const vaga = objeto(o.vaga);
  const p = objeto(o.pessoal);
  const f = objeto(o.formacao);
  const ind = objeto(o.indicacao);
  const red = objeto(o.redacao);
  const med = objeto(o.medidas);
  const doc = objeto(o.documentos);
  const fam = objeto(o.familia);
  const redes = objeto(o.redes);
  const parente = (v: unknown): Parente => {
    const x = objeto(v);
    return { nome: curto(x.nome), profissao: curto(x.profissao) };
  };
  const filhos = (Array.isArray(fam.filhos) ? fam.filhos : []).slice(0, 10).map((x) => {
    const f = objeto(x);
    return { nome: curto(f.nome), idade: curto(f.idade, 20), nascimento: data(f.nascimento) };
  });

  const experiencias = (Array.isArray(o.experiencias) ? o.experiencias : []).slice(0, 15).map((x) => {
    const e = objeto(x);
    return {
      empresa: curto(e.empresa),
      cargo: curto(e.cargo),
      entrada: data(e.entrada, true),
      saida: data(e.saida, true),
      salario: curto(e.salario, 40),
      motivoSaida: curto(e.motivoSaida, 500),
      contato: curto(e.contato),
    };
  });

  const segundos = Number(med.segundosNaRedacao);

  return {
    versao: 1,
    origem: o.origem === "PAPEL" ? "PAPEL" : "",
    vaga: {
      cargo: curto(vaga.cargo),
      pretensao: curto(vaga.pretensao, 40),
      inicio: curto(vaga.inicio, 100),
      horarios: curto(vaga.horarios, 300),
      viagens: umDe(vaga.viagens, ["SIM", "NAO"] as const),
    },
    pessoal: {
      nome: curto(p.nome),
      nascimento: data(p.nascimento),
      naturalidade: curto(p.naturalidade),
      endereco: curto(p.endereco, 300),
      bairro: curto(p.bairro),
      cep: curto(p.cep, 9).replace(/[^\d-]/g, ""),
      cidade: curto(p.cidade),
      celular: curto(p.celular, 30),
      email: curto(p.email),
      sexo: curto(p.sexo, 40),
      estadoCivil: curto(p.estadoCivil, 40),
      comQuemMora: curto(p.comQuemMora),
    },
    documentos: { rg: curto(doc.rg, 30), orgao: curto(doc.orgao, 30), cpf: curto(doc.cpf, 20) },
    familia: { pai: parente(fam.pai), mae: parente(fam.mae), conjuge: parente(fam.conjuge), filhos },
    formacao: {
      nivel: umDe(f.nivel, NIVEIS_DE_FORMACAO),
      curso: curto(f.curso),
      situacao: umDe(f.situacao, SITUACOES_DO_CURSO.map((s) => s.valor)),
      conclusao: curto(f.conclusao, 40),
      outrosCursos: longo(f.outrosCursos, 2_000),
      idiomas: curto(f.idiomas, 300),
    },
    primeiroEmprego: o.primeiroEmprego === true,
    experiencias,
    voluntariado: longo(o.voluntariado, 1_000),
    perfilProfissional: curto(o.perfilProfissional, 300),
    redes: { quais: curto(redes.quais), nome: curto(redes.nome) },
    indicacao: {
      indicado: umDe(ind.indicado, ["SIM", "NAO"] as const),
      nome: curto(ind.nome),
      cargo: curto(ind.cargo),
      proximidade: curto(ind.proximidade),
    },
    redacao: { qualidades: longo(red.qualidades), expectativas: longo(red.expectativas) },
    medidas: {
      segundosNaRedacao: Number.isFinite(segundos) && segundos > 0 ? Math.min(Math.round(segundos), 24 * 3600) : 0,
      colouNaRedacao: med.colouNaRedacao === true,
    },
    aceite: o.aceite === true,
  };
}

// ---------------------------------------------------------------- conferência

/** A experiência que a pessoa começou a preencher (a vazia é ignorada). */
export function experienciaPreenchida(e: Experiencia): boolean {
  return Object.values(e).some((v) => v.trim() !== "");
}

/** Os passos da ficha, na ordem em que aparecem. */
export const PASSOS = ["A vaga", "Sobre você", "Família", "Formação", "Experiência", "Indicação", "Redação", "Conferir e enviar"] as const;

/**
 * O que falta em cada passo. Lista vazia: o passo está bom.
 *
 * O navegador usa para não deixar avançar; o servidor usa de novo, porque o
 * que vem do navegador não é garantia de nada.
 */
export function problemasDoPasso(ficha: Ficha, passo: number): string[] {
  const erros: string[] = [];
  const falta = (cond: boolean, msg: string) => {
    if (cond) erros.push(msg);
  };

  if (passo === 0) {
    falta(!ficha.vaga.cargo, "Diga o cargo pretendido.");
    falta(!ficha.vaga.pretensao, "Diga a sua pretensão salarial.");
  }
  if (passo === 1) {
    const p = ficha.pessoal;
    falta(p.nome.length < 3, "Escreva o seu nome completo.");
    falta(!p.nascimento, "Informe a data de nascimento.");
    const idade = p.nascimento ? idadeEm(p.nascimento) : null;
    falta(idade !== null && (idade < 14 || idade > 100), "Confira a data de nascimento.");
    falta(!p.endereco, "Informe o endereço.");
    falta(!p.cidade, "Informe a cidade.");
    falta(p.celular.replace(/\D/g, "").length < 10, "Informe o celular com DDD.");
    falta(p.email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email), "Confira o e-mail.");
  }
  if (passo === 3) {
    falta(!ficha.formacao.nivel, "Escolha o seu último nível de formação.");
    falta(!ficha.formacao.situacao, "Diga se concluiu, se está cursando ou se parou.");
  }
  if (passo === 4 && !ficha.primeiroEmprego) {
    const preenchidas = ficha.experiencias.filter(experienciaPreenchida);
    falta(preenchidas.length === 0, "Conte a sua última experiência, ou marque que este é o seu primeiro emprego.");
    preenchidas.forEach((e, i) => {
      const n = preenchidas.length > 1 ? ` (experiência ${i + 1})` : "";
      falta(!e.empresa, `Diga o nome da empresa${n}.`);
      falta(!e.cargo, `Diga o cargo${n}.`);
      falta(!e.entrada, `Informe o mês e ano de entrada${n}.`);
      falta(Boolean(e.entrada && e.saida && e.saida < e.entrada), `A saída vem antes da entrada${n}.`);
    });
  }
  if (passo === 5) {
    const ind = ficha.indicacao;
    falta(!ind.indicado, "Responda se foi indicado por alguém.");
    falta(ind.indicado === "SIM" && !ind.nome, "Diga o nome de quem indicou.");
    falta(ind.indicado === "SIM" && !ind.proximidade, "Diga o grau de proximidade com quem indicou.");
  }
  if (passo === 6) {
    falta(ficha.redacao.qualidades.trim().length < MINIMO_DA_REDACAO, `Escreva pelo menos ${MINIMO_DA_REDACAO} caracteres na primeira pergunta.`);
    falta(ficha.redacao.expectativas.trim().length < MINIMO_DA_REDACAO, `Escreva pelo menos ${MINIMO_DA_REDACAO} caracteres na segunda pergunta.`);
  }
  if (passo === 7) {
    falta(!ficha.aceite, "Para enviar, confirme que leu o aviso de privacidade.");
  }
  return erros;
}

/** Tudo o que falta na ficha inteira; vazio quando pode ser gravada. */
export function problemasDaFicha(ficha: Ficha): string[] {
  return PASSOS.flatMap((_, i) => problemasDoPasso(ficha, i));
}

/** O filho que a pessoa começou a preencher (a linha vazia é ignorada). */
export function filhoPreenchido(f: Filho): boolean {
  return Object.values(f).some((v) => v.trim() !== "");
}

/** A ficha como vai para o banco: sem as experiências e os filhos deixados em branco. */
export function fichaParaGravar(ficha: Ficha): Ficha {
  return {
    ...ficha,
    experiencias: ficha.primeiroEmprego ? [] : ficha.experiencias.filter(experienciaPreenchida),
    familia: { ...ficha.familia, filhos: ficha.familia.filhos.filter(filhoPreenchido) },
  };
}

// --------------------------------------------------------------------- contas

/** A idade em anos completos numa data ("AAAA-MM-DD"). */
export function idadeEm(nascimento: string, hoje = new Date()): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento);
  if (!m) return null;
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])];
  let idade = hoje.getFullYear() - ano;
  const mesHoje = hoje.getMonth() + 1;
  if (mesHoje < mes || (mesHoje === mes && hoje.getDate() < dia)) idade--;
  return idade;
}

/** "2023-04" → "04/2023". */
export function mesAno(valor: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(valor);
  return m ? `${m[2]}/${m[1]}` : "";
}

/** "1995-03-21" → "21/03/1995". */
export function dataBr(valor: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "";
}

/** Quanto tempo ficou na empresa, em palavras: "1 ano e 3 meses". */
export function tempoNaEmpresa(entrada: string, saida: string, hoje = new Date()): string {
  const a = /^(\d{4})-(\d{2})$/.exec(entrada);
  if (!a) return "";
  const b = /^(\d{4})-(\d{2})$/.exec(saida);
  const fimAno = b ? Number(b[1]) : hoje.getFullYear();
  const fimMes = b ? Number(b[2]) : hoje.getMonth() + 1;
  const meses = (fimAno - Number(a[1])) * 12 + (fimMes - Number(a[2]));
  if (meses < 0) return "";
  if (meses < 1) return "menos de 1 mês";
  const anos = Math.floor(meses / 12);
  const resto = meses % 12;
  const partes = [anos ? `${anos} ano${anos > 1 ? "s" : ""}` : "", resto ? `${resto} ${resto > 1 ? "meses" : "mês"}` : ""].filter(Boolean);
  return partes.join(" e ");
}

/** "754" segundos → "12 min". */
export function duracao(segundos: number): string {
  if (segundos < 60) return `${segundos} s`;
  const min = Math.round(segundos / 60);
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${min % 60} min`;
}
