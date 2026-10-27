/**
 * O recado de cobrança de quem recebeu um formulário e ainda não respondeu.
 * oQue é o formulário em palavras de recado: "a sua autoavaliação".
 */
export function lembreteDoLink(nome: string, oQue: string, link: string): string {
  const primeiro = nome.trim().split(/\s+/)[0] ?? "";
  return `Olá, ${primeiro}! Tudo bem? Passando para lembrar de ${oQue}, que ainda está sem resposta. Dá para responder pelo celular mesmo, neste link: ${link}`;
}
