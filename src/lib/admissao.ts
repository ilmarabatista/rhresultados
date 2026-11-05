/**
 * Assinatura de carteira: a lista de documentos, as mensagens de WhatsApp e as
 * conferências que valem no navegador e no servidor.
 *
 * O caminho: o RH preenche os dados iniciais e manda ao médico do trabalho;
 * o funcionário, pelo link, manda a foto do atestado admissional (ASO) e os
 * outros documentos; o RH baixa o pacote para a contabilidade, com um PDF dos
 * dados e um PDF por documento, na ordem desta lista.
 */

/** O médico do trabalho que recebe os dados para o exame admissional. */
export const MEDICO_DO_TRABALHO = { nome: "Dr. Eduardo", telefone: "83996801400" };

export type DocumentoAdmissional = {
  chave: string;
  nome: string;
  /** O que mostrar ao funcionário para ele saber o que mandar. */
  dica: string;
  obrigatorio: boolean;
};

/**
 * Os documentos, na ordem em que vão para a contabilidade. O ASO vem primeiro
 * porque é o que libera a contratação.
 */
export const DOCUMENTOS_ADMISSIONAIS: DocumentoAdmissional[] = [
  { chave: "ASO", nome: "Atestado de saúde ocupacional (ASO)", dica: "Foto do atestado admissional que o médico entregou, com a assinatura dele.", obrigatorio: true },
  { chave: "RG", nome: "RG ou CNH", dica: "Frente e verso. Se for a CNH digital, pode ser o PDF do aplicativo.", obrigatorio: true },
  { chave: "CPF", nome: "CPF", dica: "Só se o número do CPF não estiver no RG ou na CNH.", obrigatorio: false },
  { chave: "CTPS", nome: "Carteira de trabalho digital", dica: "Print da tela do aplicativo Carteira de Trabalho Digital, com o número e a série.", obrigatorio: true },
  { chave: "PIS", nome: "PIS / NIS", dica: "Cartão ou documento com o número do PIS, se você tiver.", obrigatorio: false },
  { chave: "TITULO", nome: "Título de eleitor", dica: "Pode ser o print do aplicativo e-Título.", obrigatorio: true },
  { chave: "RESERVISTA", nome: "Certificado de reservista", dica: "Só para homens de 18 a 45 anos.", obrigatorio: false },
  { chave: "RESIDENCIA", nome: "Comprovante de residência", dica: "Conta de luz, água ou internet dos últimos 3 meses.", obrigatorio: true },
  { chave: "ESCOLARIDADE", nome: "Comprovante de escolaridade", dica: "Diploma, certificado ou declaração da escola.", obrigatorio: true },
  { chave: "CERTIDAO", nome: "Certidão de nascimento ou casamento", dica: "A de casamento, se você for casado(a).", obrigatorio: true },
  { chave: "FOTO", nome: "Foto 3x4", dica: "Pode ser uma foto de rosto, de frente, com fundo claro.", obrigatorio: true },
  { chave: "BANCO", nome: "Dados bancários", dica: "Cartão ou print do aplicativo do banco com agência e conta.", obrigatorio: false },
  { chave: "FILHOS", nome: "Certidão e CPF dos filhos", dica: "Só para filhos menores de 14 anos.", obrigatorio: false },
  { chave: "VACINA", nome: "Cartão de vacina dos filhos", dica: "Só para filhos menores de 7 anos.", obrigatorio: false },
  { chave: "OUTRO", nome: "Outros documentos", dica: "Qualquer outro documento que o RH pediu.", obrigatorio: false },
];

export function documentoDaChave(chave: string): DocumentoAdmissional | undefined {
  return DOCUMENTOS_ADMISSIONAIS.find((d) => d.chave === chave);
}

// ------------------------------------------------------------------ arquivos

/** Teto de um arquivo: o corpo da Vercel é 4,5 MB, com folga para o resto. */
export const TAMANHO_DO_ARQUIVO = 4 * 1024 * 1024;
/** Teto de arquivos por admissão, para um link vazado não encher o banco. */
export const ARQUIVOS_POR_ADMISSAO = 80;

/** O tipo do arquivo pelos primeiros bytes, ou null se não for foto nem PDF. */
export function tipoDoArquivo(inicio: Uint8Array): "image/jpeg" | "image/png" | "application/pdf" | null {
  if (inicio[0] === 0xff && inicio[1] === 0xd8 && inicio[2] === 0xff) return "image/jpeg";
  if (inicio[0] === 0x89 && inicio[1] === 0x50 && inicio[2] === 0x4e && inicio[3] === 0x47) return "image/png";
  const pdf = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
  const ate = Math.min(inicio.length - pdf.length, 1024);
  for (let i = 0; i <= ate; i++) {
    if (pdf.every((b, k) => inicio[i + k] === b)) return "application/pdf";
  }
  return null;
}

/** "foto.jpg", sem caminho nem caractere estranho. */
export function nomeDoArquivo(nome: string, mime: string): string {
  const base = (nome.split(/[\\/]/).pop() ?? "").replace(/[\u0000-\u001f"<>|*?:]/g, "").trim().slice(0, 120);
  const ext = mime === "application/pdf" ? ".pdf" : mime === "image/png" ? ".png" : ".jpg";
  const semExt = base.replace(/\.[a-z0-9]{1,5}$/i, "");
  return `${semExt || "documento"}${ext}`;
}

// ---------------------------------------------------------------- dados

/** Só os números. */
export function soNumeros(valor: string | null | undefined): string {
  return (valor ?? "").replace(/\D/g, "");
}

/** O CPF confere pelos dígitos verificadores? */
export function cpfValido(valor: string): boolean {
  const d = soNumeros(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  for (const n of [9, 10]) {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const digito = ((soma * 10) % 11) % 10;
    if (digito !== Number(d[n])) return false;
  }
  return true;
}

export function formatarCpf(valor: string): string {
  const d = soNumeros(valor);
  return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : valor;
}

export function formatarCnpj(valor: string): string {
  const d = soNumeros(valor);
  return d.length === 14 ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}` : valor;
}

/** Data guardada em UTC 00:00 → "05/11/1990". */
export function dataBR(data: Date | string | null | undefined): string {
  if (!data) return "";
  const d = typeof data === "string" ? new Date(data) : data;
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}

// ------------------------------------------------------------- mensagens

export type DadosIniciais = {
  empresa: string;
  /** Razão social, quando cadastrada: é o que vai ao médico. */
  razaoSocial?: string | null;
  cnpj: string;
  nome: string;
  cpf: string;
  dataNascimento: Date | string;
  funcao: string;
};

/** A mensagem que vai ao médico do trabalho pedindo o exame admissional. */
export function mensagemAoMedico(d: DadosIniciais): string {
  return [
    `Olá, ${MEDICO_DO_TRABALHO.nome}! Segue funcionário para exame admissional:`,
    "",
    `Empresa: ${d.razaoSocial || d.empresa}`,
    `CNPJ: ${formatarCnpj(d.cnpj)}`,
    `Nome: ${d.nome}`,
    `CPF: ${formatarCpf(d.cpf)}`,
    `Data de nascimento: ${dataBR(d.dataNascimento)}`,
    `Função: ${d.funcao}`,
    "",
    "Obrigada!",
  ].join("\n");
}

/** A mensagem com o link para o funcionário mandar os documentos. */
export function mensagemAoFuncionario(nome: string, empresa: string, link: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  return `Olá, ${primeiro}! Para assinarmos a sua carteira na ${empresa}, mande por este link a foto do atestado admissional (ASO) e dos seus documentos. Dá para tirar as fotos pelo celular mesmo: ${link}`;
}

export function whatsapp(telefone: string | null | undefined, mensagem: string): string {
  const d = soNumeros(telefone).replace(/^0+/, "");
  const numero = d.length === 10 || d.length === 11 ? `55${d}` : (d.length === 12 || d.length === 13) && d.startsWith("55") ? d : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

// ----------------------------------------------------------------- etapas

export type EtapaDaAdmissao = "MEDICO" | "ASO" | "DOCUMENTOS" | "PACOTE" | "PRONTA";

/** Em que pé está: o próximo passo que falta. */
export function etapaDaAdmissao(a: {
  enviadoAoMedicoEm: Date | null;
  documentosEnviadosEm: Date | null;
  pacoteGeradoEm: Date | null;
  tipos: string[];
}): EtapaDaAdmissao {
  if (!a.enviadoAoMedicoEm) return "MEDICO";
  if (!a.tipos.includes("ASO")) return "ASO";
  const faltam = DOCUMENTOS_ADMISSIONAIS.some((d) => d.obrigatorio && !a.tipos.includes(d.chave));
  if (faltam && !a.documentosEnviadosEm) return "DOCUMENTOS";
  if (!a.pacoteGeradoEm) return "PACOTE";
  return "PRONTA";
}

export const ROTULO_DA_ETAPA: Record<EtapaDaAdmissao, string> = {
  MEDICO: "Mandar ao médico",
  ASO: "Esperando o ASO",
  DOCUMENTOS: "Esperando documentos",
  PACOTE: "Pronta para a contabilidade",
  PRONTA: "Enviada à contabilidade",
};

/** Nome de arquivo do pacote: "01 - RG ou CNH.pdf". */
export function nomeNoPacote(ordem: number, nome: string): string {
  const limpo = nome.replace(/[\\/:*?"<>|]/g, "-");
  return `${String(ordem).padStart(2, "0")} - ${limpo}.pdf`;
}
