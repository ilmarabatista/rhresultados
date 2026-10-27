import "server-only";

/**
 * Transforma um trecho de áudio em texto.
 *
 * Usa a API de transcrição no padrão da OpenAI (o mesmo endereço
 * /audio/transcriptions), que o Groq oferece com o Whisper e um plano
 * gratuito. Trocar de provedor é só mudar TRANSCRICAO_URL, TRANSCRICAO_MODELO
 * e a chave TRANSCRICAO_API_KEY.
 */

const URL_PADRAO = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODELO_PADRAO = "whisper-large-v3-turbo";
const TIMEOUT_MS = 50_000;

export function transcricaoConfigurada(): boolean {
  return Boolean(process.env.TRANSCRICAO_API_KEY);
}

export async function transcreverAudio(audio: Blob, nome: string): Promise<string> {
  const chave = process.env.TRANSCRICAO_API_KEY;
  if (!chave) {
    throw new Error(
      "A transcrição não está configurada. Preencha TRANSCRICAO_API_KEY (chave do Groq) nas variáveis do sistema.",
    );
  }

  const corpo = new FormData();
  corpo.append("file", audio, nome);
  corpo.append("model", process.env.TRANSCRICAO_MODELO || MODELO_PADRAO);
  corpo.append("language", "pt");
  corpo.append("response_format", "json");
  corpo.append("temperature", "0");

  let resposta: Response;
  try {
    resposta = await fetch(process.env.TRANSCRICAO_URL || URL_PADRAO, {
      method: "POST",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { Authorization: `Bearer ${chave}` },
      body: corpo,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "TimeoutError") {
      throw new Error("A transcrição demorou demais. O trecho vai ser tentado de novo.");
    }
    throw new Error("Não foi possível falar com o serviço de transcrição.");
  }

  const dados = (await resposta.json().catch(() => null)) as {
    text?: string;
    error?: { message?: string };
  } | null;

  if (!resposta.ok) {
    if (resposta.status === 429) {
      throw new Error("O limite gratuito de transcrição foi atingido. Tente de novo mais tarde.");
    }
    throw new Error(
      `O serviço de transcrição retornou um erro: ${dados?.error?.message ?? `HTTP ${resposta.status}`}`,
    );
  }

  return typeof dados?.text === "string" ? dados.text : "";
}
