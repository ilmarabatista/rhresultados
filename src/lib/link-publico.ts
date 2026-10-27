/**
 * O endereço dos links que vão para fora (pesquisa, ficha, questionário,
 * autoavaliação, mapeamento, teste, dossiê).
 *
 * Sempre o endereço oficial, e não o de onde o sistema está aberto: o preview
 * do dev na Vercel é protegido, e quem recebe um link de lá cai numa tela
 * pedindo permissão para entrar. Do localhost, o link nem abre no celular de
 * ninguém. NEXT_PUBLIC_ENDERECO_PUBLICO troca o endereço, se um dia mudar.
 */
export const ENDERECO_PUBLICO = (process.env.NEXT_PUBLIC_ENDERECO_PUBLICO || "https://rhresultados.vercel.app").replace(/\/+$/, "");

export function linkPublico(caminho: string): string {
  return `${ENDERECO_PUBLICO}${caminho}`;
}
