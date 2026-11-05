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
export const MEDICO_DO_TRABALHO = {
  nome: "Dr. Eduardo",
  telefone: "83996801400",
  /** Como chegar ao consultório, do jeito que a Ilmara passa aos funcionários. */
  comoChegar:
    "Entre na rua do posto Dois Irmãos e siga em frente. Depois da escola Antônio Cândido, é a quarta casa do lado esquerdo, número 395.",
  mapa: "https://maps.google.com/maps?q=-6.490975379943848%2C-37.44379806518555&z=17&hl=pt-BR",
};

export type DocumentoAdmissional = {
  chave: string;
  nome: string;
  /** O que mostrar ao funcionário para ele saber o que mandar. */
  dica: string;
  /** "Outros documentos" é extra: não conta como faltando. */
  extra?: boolean;
};

/**
 * Os documentos, na ordem em que vão para a contabilidade. O ASO vem primeiro
 * porque é o que libera a contratação.
 */
export const DOCUMENTOS_ADMISSIONAIS: DocumentoAdmissional[] = [
  { chave: "ASO", nome: "Atestado de saúde ocupacional (ASO)", dica: "Foto do atestado admissional que o médico entregou, com a assinatura dele." },
  { chave: "RG", nome: "RG ou CNH", dica: "Frente e verso. Se for a CNH digital, pode ser o PDF do aplicativo." },
  { chave: "CPF", nome: "CPF", dica: "Frente e verso, se for o cartão." },
  { chave: "CTPS", nome: "Carteira de trabalho digital", dica: "Print da tela do aplicativo Carteira de Trabalho Digital, com o número e a série." },
  { chave: "PIS", nome: "PIS / NIS", dica: "Cartão ou documento com o número do PIS." },
  { chave: "TITULO", nome: "Título de eleitor", dica: "Pode ser o print do aplicativo e-Título." },
  { chave: "RESERVISTA", nome: "Certificado de reservista", dica: "Frente e verso." },
  { chave: "RESIDENCIA", nome: "Comprovante de residência", dica: "Conta de luz, água ou internet dos últimos 3 meses." },
  { chave: "ESCOLARIDADE", nome: "Comprovante de escolaridade", dica: "Diploma, certificado ou declaração da escola." },
  { chave: "CERTIDAO", nome: "Certidão de nascimento ou casamento", dica: "A de casamento, se você for casado(a)." },
  { chave: "FOTO", nome: "Foto 3x4", dica: "Pode ser uma foto de rosto, de frente, com fundo claro." },
  { chave: "BANCO", nome: "Dados bancários", dica: "Cartão ou print do aplicativo do banco com agência e conta." },
  { chave: "FILHOS", nome: "Certidão e CPF dos filhos", dica: "A certidão de nascimento e o CPF de cada filho." },
  { chave: "VACINA", nome: "Cartão de vacina dos filhos", dica: "A página com as vacinas e o nome de cada filho." },
  { chave: "OUTRO", nome: "Outros documentos", dica: "Qualquer outro documento que o RH pediu.", extra: true },
];

export type SituacaoDoDocumento = "ENVIADO" | "NAO_SE_APLICA" | "FALTA";

export function situacaoDoDocumento(doc: DocumentoAdmissional, tipos: string[], naoSeAplica: string[]): SituacaoDoDocumento {
  if (tipos.includes(doc.chave)) return "ENVIADO";
  // Quem decide o que não se aplica é a pessoa ou o RH, em qualquer documento.
  if (naoSeAplica.includes(doc.chave)) return "NAO_SE_APLICA";
  return "FALTA";
}

/** Os documentos que nem chegaram nem foram marcados "Não se aplica". */
export function documentosQueFaltam(tipos: string[], naoSeAplica: string[]): DocumentoAdmissional[] {
  return DOCUMENTOS_ADMISSIONAIS.filter((d) => !d.extra && situacaoDoDocumento(d, tipos, naoSeAplica) === "FALTA");
}

/** Quantos estão resolvidos (enviados ou "Não se aplica") de quantos contam. */
export function contagemDosDocumentos(tipos: string[], naoSeAplica: string[]) {
  const contam = DOCUMENTOS_ADMISSIONAIS.filter((d) => !d.extra);
  return { prontos: contam.length - documentosQueFaltam(tipos, naoSeAplica).length, total: contam.length };
}

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
  cpf: string | null;
  dataNascimento: Date | string | null;
  funcao: string | null;
};

/** O que ainda falta dos dados que o médico pede. */
export function dadosQueFaltam(d: { cpf: string | null; dataNascimento: Date | string | null; funcao: string | null }): string[] {
  return [!d.cpf && "CPF", !d.dataNascimento && "data de nascimento", !d.funcao && "função"].filter(Boolean) as string[];
}

/** A mensagem que vai ao médico do trabalho pedindo o exame admissional. */
export function mensagemAoMedico(d: DadosIniciais): string {
  return [
    `Olá, ${MEDICO_DO_TRABALHO.nome}! Segue funcionário para exame admissional:`,
    "",
    `Empresa: ${d.razaoSocial || d.empresa}`,
    `CNPJ: ${formatarCnpj(d.cnpj)}`,
    `Nome: ${d.nome}`,
    `CPF: ${d.cpf ? formatarCpf(d.cpf) : ""}`,
    `Data de nascimento: ${dataBR(d.dataNascimento)}`,
    `Função: ${d.funcao ?? ""}`,
    "",
    "Obrigada!",
  ].join("\n");
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/)[0] ?? "";
}

/** A mensagem com o link para o funcionário responder CPF, nascimento e função. */
export function mensagemDosDados(nome: string, empresa: string, link: string): string {
  return `Olá, ${primeiroNome(nome)}! Para começarmos a sua admissão na ${empresa}, responda por este link o seu CPF, a sua data de nascimento e a sua função. É rapidinho: ${link}`;
}

export type Consulta = { data: Date | string | null; hora: string | null; local: string | null };

const DIAS = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];

/** "quinta-feira, 06/11/2026, às 08:00, no Centro Médico X, com o Dr. Eduardo" */
export function textoDaConsulta(c: Consulta): string | null {
  if (!c.data) return null;
  const d = typeof c.data === "string" ? new Date(c.data) : c.data;
  if (Number.isNaN(d.getTime())) return null;
  return [
    `${DIAS[d.getUTCDay()]}, ${dataBR(d)}`,
    c.hora ? `às ${c.hora}` : null,
    c.local ? `em ${c.local}` : null,
    `com o ${MEDICO_DO_TRABALHO.nome}`,
  ]
    .filter(Boolean)
    .join(", ");
}

/** A mensagem com o link dos documentos e, se já tem, a consulta marcada. */
export function mensagemAoFuncionario(nome: string, empresa: string, link: string, consulta?: Consulta): string {
  const quando = consulta ? textoDaConsulta(consulta) : null;
  const exame = quando
    ? `o seu exame admissional está marcado para ${quando}. Leve um documento com foto. Depois do exame, mande a foto do atestado (ASO) e dos seus documentos por este link`
    : "mande por este link a foto do atestado admissional (ASO), depois do exame, e dos seus documentos";
  const texto = `Olá, ${primeiroNome(nome)}! Para assinarmos a sua carteira na ${empresa}: ${exame}. Dá para tirar as fotos pelo celular mesmo: ${link}`;
  // Sem outro local anotado, o exame é no consultório do médico: vai como chegar.
  if (!quando || consulta?.local?.trim()) return texto;
  return `${texto}\n\nComo chegar ao consultório do ${MEDICO_DO_TRABALHO.nome}: ${MEDICO_DO_TRABALHO.comoChegar}\nMapa: ${MEDICO_DO_TRABALHO.mapa}`;
}

export function whatsapp(telefone: string | null | undefined, mensagem: string): string {
  const d = soNumeros(telefone).replace(/^0+/, "");
  const numero = d.length === 10 || d.length === 11 ? `55${d}` : (d.length === 12 || d.length === 13) && d.startsWith("55") ? d : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
}

// ----------------------------------------------------------------- etapas

export type EtapaDaAdmissao = "DADOS" | "MEDICO" | "CONSULTA" | "ASO" | "DOCUMENTOS" | "PACOTE" | "PRONTA";

/** Em que pé está: o próximo passo que falta. */
export function etapaDaAdmissao(a: {
  cpf: string | null;
  dataNascimento: Date | null;
  funcao: string | null;
  exameData: Date | null;
  enviadoAoMedicoEm: Date | null;
  documentosEnviadosEm: Date | null;
  pacoteGeradoEm: Date | null;
  tipos: string[];
  naoSeAplica: string[];
}): EtapaDaAdmissao {
  if (dadosQueFaltam(a).length > 0) return "DADOS";
  if (!a.enviadoAoMedicoEm) return "MEDICO";
  if (!a.tipos.includes("ASO") && !a.exameData) return "CONSULTA";
  if (!a.tipos.includes("ASO")) return "ASO";
  const faltam = documentosQueFaltam(a.tipos, a.naoSeAplica).length > 0;
  if (faltam && !a.documentosEnviadosEm) return "DOCUMENTOS";
  if (!a.pacoteGeradoEm) return "PACOTE";
  return "PRONTA";
}

export const ROTULO_DA_ETAPA: Record<EtapaDaAdmissao, string> = {
  DADOS: "Esperando os dados",
  MEDICO: "Mandar ao médico",
  CONSULTA: "Marcar a consulta",
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
