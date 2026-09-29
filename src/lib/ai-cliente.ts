import "server-only";
import { textoSeguro } from "./texto-seguro";

/**
 * Cliente da IA, compartilhado por quem precisa dela.
 *
 * Fica num módulo só porque três usos dependem das mesmas decisões: o teto de
 * tokens (sem ele o OpenRouter recusa a chamada), a tolerância a JSON vindo
 * dentro de cercas de código, e as mensagens de erro em português.
 */

/**
 * Endereço da API. Configurável por OPENROUTER_BASE_URL para poder apontar
 * para outro provedor compatível — ou para um servidor local, em teste.
 */
const OPENROUTER_URL =
  process.env.OPENROUTER_BASE_URL ||
  "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "nvidia/nemotron-3-ultra-550b-a55b:free";
const TIMEOUT_MS = 240_000;
const DEFAULT_MAX_TOKENS = 8_000;

type ChatCompletion = {
  model?: string;
  choices?: { message?: { content?: string | null; refusal?: string | null } }[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; cost?: number };
  error?: { message?: string };
};

/** Texto aparado, ou undefined quando ausente. */
export function texto(valor: unknown): string | undefined {
  if (typeof valor !== "string") return undefined;
  const limpo = valor.trim();
  return limpo === "" ? undefined : limpo;
}

/** Extrai o objeto JSON da resposta, tolerando cercas ``` e texto ao redor. */
export function extractJson(conteudo: string): unknown {
  const limpo = conteudo
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/, "")
    .trim();

  try {
    return JSON.parse(limpo);
  } catch {
    const inicio = limpo.indexOf("{");
    const fim = limpo.lastIndexOf("}");
    if (inicio === -1 || fim <= inicio) {
      throw new Error("A IA devolveu uma resposta em formato inesperado.");
    }
    try {
      return JSON.parse(limpo.slice(inicio, fim + 1));
    } catch {
      throw new Error("A IA devolveu uma resposta em formato inesperado.");
    }
  }
}

/** Faz a chamada e devolve o conteúdo bruto da resposta. */
/**
 * Vale repetir esta falha?
 *
 * O modelo gratuito oscila: responde "Service temporarily overloaded" numa
 * chamada e funciona na seguinte, e às vezes devolve resposta vazia. Isso é
 * passageiro e repetir resolve. Já erro de chave, recusa ou texto grande
 * demais não melhora com insistência — repetir só faria o usuário esperar
 * mais para ver o mesmo erro.
 */
function valeRepetir(e: unknown): boolean {
  if (!(e instanceof Error)) return false;
  return (
    e.message.includes("não devolveu nada") ||
    e.message.includes("overloaded") ||
    e.message.includes("Rate limit") ||
    e.message.includes("rate limit") ||
    e.message.includes("HTTP 429") ||
    e.message.includes("HTTP 5")
  );
}

const TENTATIVAS = 3;

/**
 * Chama a IA, repetindo o que for falha passageira.
 *
 * Espera um pouco mais a cada tentativa: o modelo sobrecarregado precisa de
 * um instante, e insistir na mesma hora só piora.
 */
export async function chamarIA(
  system: string,
  prompt: string,
  maxTokens = DEFAULT_MAX_TOKENS,
): Promise<string> {
  let ultimo: unknown;

  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      // O que a IA escreve vai para o banco, e o banco não aceita emoji.
      // Limpar aqui, na saída, vale para toda a IA do sistema de uma vez.
      return textoSeguro(await chamarUmaVez(system, prompt, maxTokens));
    } catch (e) {
      ultimo = e;
      if (!valeRepetir(e) || tentativa === TENTATIVAS) break;

      console.warn(
        `[IA] tentativa ${tentativa} falhou (${
          e instanceof Error ? e.message : e
        }); repetindo`,
      );
      await new Promise((r) => setTimeout(r, tentativa * 3_000));
    }
  }

  throw ultimo;
}

async function chamarUmaVez(
  system: string,
  prompt: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error(
      "A leitura por IA não está configurada. Preencha OPENROUTER_API_KEY no arquivo .env.",
    );
  }

  let resposta: Response;
  try {
    resposta = await fetch(OPENROUTER_URL, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "X-Title": "RH Resultados",
        ...(process.env.APP_URL
          ? { "HTTP-Referer": process.env.APP_URL }
          : {}),
      },
      body: JSON.stringify({
        model: process.env.OPENROUTER_MODEL || DEFAULT_MODEL,
        max_tokens: Number(process.env.OPENROUTER_MAX_TOKENS) || maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error(
        "A IA demorou demais para responder. Tente um texto menor.",
      );
    }
    throw new Error("Não foi possível falar com a IA. Verifique a conexão.");
  }

  const dados = (await resposta
    .json()
    .catch(() => null)) as ChatCompletion | null;

  if (!resposta.ok) {
    throw new Error(
      `A IA retornou um erro: ${dados?.error?.message ?? `HTTP ${resposta.status}`}`,
    );
  }

  const escolha = dados?.choices?.[0];
  if (escolha?.message?.refusal) {
    throw new Error("A IA recusou processar esse conteúdo. Revise o texto.");
  }

  const conteudo = escolha?.message?.content?.trim();
  if (!conteudo) {
    throw new Error("A IA não devolveu nada. Tente novamente.");
  }

  // O modelo é cobrado por token; deixa o custo visível no log do servidor.
  const uso = dados?.usage;
  if (uso) {
    const custo =
      typeof uso.cost === "number" ? `US$ ${uso.cost.toFixed(5)}` : "custo n/d";
    console.log(
      `[IA] ${dados?.model ?? "?"} · ${uso.prompt_tokens ?? "?"} entrada + ${uso.completion_tokens ?? "?"} saída · ${custo}`,
    );
  }

  return conteudo;
}
