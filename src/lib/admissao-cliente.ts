"use client";

import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { zipSync } from "fflate";
import { DOCUMENTOS_ADMISSIONAIS, dataBR, formatarCnpj, formatarCpf, nomeNoPacote } from "./admissao";

/**
 * O que roda no navegador: deixar a foto do celular leve antes de mandar, e
 * montar o pacote da contabilidade (um PDF de dados e um PDF por documento,
 * num .zip).
 */

// ------------------------------------------------------------ foto leve

const LADO_MAXIMO = 1800;

/**
 * A foto do celular passa de 4 MB fácil. Aqui ela vira um JPEG de até 1800
 * pixels no lado maior, legível para documento e com poucas centenas de KB.
 * PDF segue como veio.
 */
export async function prepararArquivo(arquivo: File): Promise<File> {
  if (arquivo.type === "application/pdf" || /\.pdf$/i.test(arquivo.name)) return arquivo;
  if (!arquivo.type.startsWith("image/") && !/\.(jpe?g|png|heic|heif|webp)$/i.test(arquivo.name)) return arquivo;

  try {
    const bitmap = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * escala);
    canvas.height = Math.round(bitmap.height * escala);
    const ctx = canvas.getContext("2d");
    if (!ctx) return arquivo;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.8));
    if (!blob) return arquivo;
    const nome = arquivo.name.replace(/\.[a-z0-9]+$/i, "") || "foto";
    return new File([blob], `${nome}.jpg`, { type: "image/jpeg" });
  } catch {
    // Formato que o navegador não abre (HEIC no computador, por exemplo):
    // segue como veio e o servidor diz se não serve.
    return arquivo;
  }
}

// ---------------------------------------------------------------- pacote

type DadosDoPacote = {
  nome: string;
  cnpj: string;
  cpf: string;
  dataNascimento: string;
  funcao: string;
  telefone: string | null;
  dataAdmissao: string | null;
  observacoes: string | null;
  enviadoAoMedicoEm: string | null;
  company: { name: string; legalName: string | null };
  documentos: { id: string; tipo: string; mime: string; nome: string }[];
};

const A4: [number, number] = [595.28, 841.89];
const MARGEM = 48;

/** Quebra o texto em linhas que cabem na largura. */
function linhas(texto: string, fonte: PDFFont, tamanho: number, largura: number): string[] {
  const saida: string[] = [];
  for (const paragrafo of texto.split(/\r?\n/)) {
    let atual = "";
    for (const palavra of paragrafo.split(/\s+/)) {
      const teste = atual ? `${atual} ${palavra}` : palavra;
      if (fonte.widthOfTextAtSize(teste, tamanho) > largura && atual) {
        saida.push(atual);
        atual = palavra;
      } else {
        atual = teste;
      }
    }
    saida.push(atual);
  }
  return saida;
}

/** O PDF só aceita o que a fonte padrão desenha (Latin-1); o resto vira "?". */
function latin(texto: string): string {
  return texto.replace(/[–—]/g, "-").replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[^\u0000-ÿ]/g, "?");
}

async function pdfDosDados(d: DadosDoPacote, incluidos: string[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Admissão - ${d.nome}`);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const negrito = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page: PDFPage = pdf.addPage(A4);
  const azul = rgb(0.07, 0.2, 0.42);
  const cinza = rgb(0.4, 0.43, 0.48);
  let y = A4[1] - MARGEM;

  page.drawText("RH Resultados", { x: MARGEM, y, size: 9, font: negrito, color: azul });
  y -= 26;
  page.drawText(latin("Admissão de funcionário"), { x: MARGEM, y, size: 18, font: negrito, color: rgb(0.1, 0.1, 0.12) });
  y -= 18;
  page.drawText(latin(d.company.legalName || d.company.name), { x: MARGEM, y, size: 10, font: normal, color: cinza });
  y -= 28;

  const campos: [string, string][] = [
    ["Empresa", d.company.legalName || d.company.name],
    ["CNPJ", formatarCnpj(d.cnpj)],
    ["Nome do funcionário", d.nome],
    ["CPF", formatarCpf(d.cpf)],
    ["Data de nascimento", dataBR(d.dataNascimento)],
    ["Função", d.funcao],
  ];
  if (d.dataAdmissao) campos.push(["Data de admissão", dataBR(d.dataAdmissao)]);
  if (d.telefone) campos.push(["Telefone", d.telefone]);

  for (const [rotulo, valor] of campos) {
    page.drawText(latin(rotulo), { x: MARGEM, y, size: 9, font: normal, color: cinza });
    page.drawText(latin(valor), { x: MARGEM + 140, y, size: 11, font: negrito, color: rgb(0.1, 0.1, 0.12) });
    y -= 22;
  }

  if (d.observacoes) {
    y -= 6;
    page.drawText(latin("Observações"), { x: MARGEM, y, size: 9, font: normal, color: cinza });
    y -= 15;
    for (const l of linhas(latin(d.observacoes), normal, 10, A4[0] - 2 * MARGEM).slice(0, 12)) {
      page.drawText(l, { x: MARGEM, y, size: 10, font: normal });
      y -= 14;
    }
  }

  y -= 16;
  page.drawText(latin("Documentos neste pacote"), { x: MARGEM, y, size: 11, font: negrito, color: azul });
  y -= 18;
  incluidos.forEach((nome) => {
    page.drawText(latin(nome), { x: MARGEM, y, size: 10, font: normal });
    y -= 15;
  });

  return pdf.save();
}

/** Um PDF com todos os arquivos de um documento: foto vira página, PDF entra inteiro. */
async function pdfDoDocumento(arquivos: { mime: string; bytes: Uint8Array }[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const a of arquivos) {
    if (a.mime === "application/pdf") {
      const origem = await PDFDocument.load(a.bytes, { ignoreEncryption: true });
      const paginas = await pdf.copyPages(origem, origem.getPageIndices());
      paginas.forEach((p) => pdf.addPage(p));
      continue;
    }
    const imagem = a.mime === "image/png" ? await pdf.embedPng(a.bytes) : await pdf.embedJpg(a.bytes);
    // Foto deitada vai em página deitada.
    const deitada = imagem.width > imagem.height;
    const [w, h] = deitada ? [A4[1], A4[0]] : A4;
    const page = pdf.addPage([w, h]);
    const m = 24;
    const escala = Math.min((w - 2 * m) / imagem.width, (h - 2 * m) / imagem.height);
    const iw = imagem.width * escala;
    const ih = imagem.height * escala;
    page.drawImage(imagem, { x: (w - iw) / 2, y: (h - ih) / 2, width: iw, height: ih });
  }
  return pdf.save();
}

function primeiroNome(nome: string) {
  return nome.trim().split(/\s+/).slice(0, 2).join(" ");
}

/** Monta o .zip da contabilidade e baixa. Devolve o nome do arquivo. */
export async function baixarPacote(admissaoId: string, aoAvancar?: (texto: string) => void): Promise<string> {
  const r = await fetch(`/api/admissao/${admissaoId}/pacote`, { cache: "no-store" });
  if (!r.ok) throw new Error("Não foi possível ler a admissão.");
  const d = (await r.json()) as DadosDoPacote;

  const arquivosDoZip: Record<string, Uint8Array> = {};
  const incluidos: string[] = [];
  let ordem = 1;

  for (const doc of DOCUMENTOS_ADMISSIONAIS) {
    const desse = d.documentos.filter((a) => a.tipo === doc.chave);
    if (desse.length === 0) continue;
    aoAvancar?.(`Montando ${doc.nome}…`);
    const baixados = await Promise.all(
      desse.map(async (a) => {
        const resp = await fetch(`/api/admissao/arquivo/${a.id}`, { cache: "no-store" });
        if (!resp.ok) throw new Error(`Não foi possível baixar ${a.nome}.`);
        return { mime: a.mime, bytes: new Uint8Array(await resp.arrayBuffer()) };
      }),
    );
    const nome = nomeNoPacote(ordem++, doc.nome);
    arquivosDoZip[nome] = await pdfDoDocumento(baixados);
    incluidos.push(nome);
  }

  aoAvancar?.("Montando os dados iniciais…");
  arquivosDoZip[nomeNoPacote(0, `Dados iniciais - ${d.nome}`)] = await pdfDosDados(d, incluidos);

  // PDF já vem comprimido: o zip só guarda, sem gastar tempo comprimindo de novo.
  const zip = zipSync(
    Object.fromEntries(Object.entries(arquivosDoZip).map(([k, v]) => [k, [v, { level: 0 }]])),
  );
  const nomeDoZip = `Admissão - ${primeiroNome(d.nome)}.zip`;
  const url = URL.createObjectURL(new Blob([zip as BlobPart], { type: "application/zip" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = nomeDoZip;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return nomeDoZip;
}
