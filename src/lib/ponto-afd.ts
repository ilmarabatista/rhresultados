/**
 * Leitura do AFD — o Arquivo Fonte de Dados que todo relógio de ponto legal
 * exporta. É por ele que a empresa que já tem ponto próprio traz as batidas
 * para cá sem ninguém entregar senha de sistema nenhum.
 *
 * Só interessam os registros tipo 3 (marcação). Os dois leiautes em uso:
 *
 *   Portaria 671/2021: NSR(9) 3 AAAA-MM-DDThh:mm:00-0300(24) CPF(12) CRC(4)
 *   Portaria 1510/2009: NSR(9) 3 DDMMAAAA(8) hhmm(4) PIS(12)
 *
 * O resto do arquivo (cabeçalho, empresa, relógio, ajustes) é ignorado.
 */

import { instanteNoDia, soDigitos } from "./ponto";

export type MarcacaoAfd = {
  nsr: number;
  instante: Date;
  /** CPF (671) ou PIS (1510), só dígitos, sem zeros à esquerda. */
  documento: string;
};

export type LeituraAfd = {
  marcacoes: MarcacaoAfd[];
  /** Linhas tipo 3 que não se deixaram ler. */
  ilegiveis: number;
};

const LEIAUTE_671 = /^(\d{9})3(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):\d{2}([+-])(\d{2})(\d{2})(\d{11,12})/;
const LEIAUTE_1510 = /^(\d{9})3(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{12})/;

export function semZerosAEsquerda(documento: string): string {
  return soDigitos(documento).replace(/^0+/, "");
}

export function lerAfd(conteudo: string): LeituraAfd {
  const marcacoes: MarcacaoAfd[] = [];
  let ilegiveis = 0;

  for (const bruta of conteudo.split(/\r?\n/)) {
    const linha = bruta.trim();
    if (linha.length < 34 || linha[9] !== "3") continue;

    const novo = LEIAUTE_671.exec(linha);
    if (novo) {
      const [, nsr, ano, mes, dia, h, min, sinal, fh, fm, doc] = novo;
      const deslocamento = (Number(fh) * 60 + Number(fm)) * (sinal === "-" ? -1 : 1);
      const utc = Date.UTC(Number(ano), Number(mes) - 1, Number(dia), Number(h), Number(min));
      const instante = new Date(utc - deslocamento * 60_000);
      if (!Number.isNaN(instante.getTime())) {
        marcacoes.push({ nsr: Number(nsr), instante, documento: semZerosAEsquerda(doc) });
        continue;
      }
    }

    const antigo = LEIAUTE_1510.exec(linha);
    if (antigo) {
      const [, nsr, dia, mes, ano, h, min, pis] = antigo;
      const hora = Number(h);
      const minuto = Number(min);
      if (hora < 24 && minuto < 60 && Number(mes) >= 1 && Number(mes) <= 12) {
        marcacoes.push({
          nsr: Number(nsr),
          instante: instanteNoDia(`${ano}-${mes}-${dia}`, hora * 60 + minuto),
          documento: semZerosAEsquerda(pis),
        });
        continue;
      }
    }

    ilegiveis += 1;
  }

  return { marcacoes, ilegiveis };
}
