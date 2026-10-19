"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { entrar, trocarSenha, type Estado } from "@/app/actions";
import { Campo, Erro, estiloBotao, estiloCampo } from "./ui";

export function BotaoEnviar({ children, pendente = "Salvando…", className = "" }: { children: React.ReactNode; pendente?: string; className?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${estiloBotao} ${className}`}>
      {pending ? pendente : children}
    </button>
  );
}

export function FormEntrar() {
  const [estado, acao] = useActionState<Estado, FormData>(entrar, {});
  return (
    <form action={acao} className="space-y-4">
      <Campo rotulo="Email">
        <input name="email" type="email" autoComplete="username" required className={estiloCampo} />
      </Campo>
      <Campo rotulo="Senha">
        <input name="senha" type="password" autoComplete="current-password" required className={estiloCampo} />
      </Campo>
      <Erro texto={estado.erro} />
      <BotaoEnviar pendente="Entrando…" className="w-full">
        Entrar
      </BotaoEnviar>
    </form>
  );
}

export function FormTrocarSenha() {
  const [estado, acao] = useActionState<Estado, FormData>(trocarSenha, {});
  useEffect(() => {
    if (estado.ok) window.location.assign("/"); // a página inicial manda o administrador para /admin
  }, [estado]);
  return (
    <form action={acao} className="space-y-4">
      <Campo rotulo="Senha atual" dica="No primeiro acesso, é a senha que o RH passou.">
        <input name="atual" type="password" autoComplete="current-password" required className={estiloCampo} />
      </Campo>
      <Campo rotulo="Nova senha" dica="Pelo menos 6 caracteres.">
        <input name="nova" type="password" autoComplete="new-password" minLength={6} required className={estiloCampo} />
      </Campo>
      <Campo rotulo="Repita a nova senha">
        <input name="confirma" type="password" autoComplete="new-password" minLength={6} required className={estiloCampo} />
      </Campo>
      <Erro texto={estado.erro} />
      <BotaoEnviar className="w-full">{estado.ok ? "Abrindo…" : "Salvar nova senha"}</BotaoEnviar>
    </form>
  );
}
