import "server-only";
import { chamarIA } from "./ai-cliente";
import { pedidoDoParecer, SYSTEM_DO_PARECER, type DadosDoParecer } from "./fluxo-da-vaga";
import { textoSeguro } from "./texto-seguro";

/**
 * O rascunho do parecer final, a partir de tudo o que está na pasta. Vai como
 * privado pelo mesmo motivo da entrevista: são dados pessoais do candidato.
 */
export async function rascunharParecer(dados: DadosDoParecer): Promise<string> {
  const bruto = await chamarIA(SYSTEM_DO_PARECER, pedidoDoParecer(dados), 2_000, { privado: true });
  return textoSeguro(bruto)
    .replace(/^[#*\s]+/gm, "")
    .trim()
    .slice(0, 10_000);
}
