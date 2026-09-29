"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { Copy, MessageCircle, Send, Trash2 } from "lucide-react";
import { enviarTeste, excluirEnvio, type TestesState } from "@/app/(app)/testes/actions";
import { Painel } from "./ui";
import { Field, FormError, Input, Select, SubmitButton } from "./form";

/**
 * As peças da aba Testes que rodam no navegador: o envio (que devolve o link
 * pronto para copiar ou mandar pelo WhatsApp) e os botões de cada envio.
 */

function linkDe(token: string) {
  return `${window.location.origin}/teste/${token}`;
}

function whatsappDe(telefone: string | null, texto: string) {
  const digitos = (telefone ?? "").replace(/\D/g, "");
  const numero = digitos.length >= 10 ? (digitos.startsWith("55") ? digitos : `55${digitos}`) : "";
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`;
}

function mensagem(pessoa: string, teste: string, link: string) {
  return `Olá, ${pessoa.split(" ")[0]}! Segue o link para responder o teste "${teste}": ${link}`;
}

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-600 transition hover:border-brand-300 hover:text-brand-700";

export function EnviarTeste({
  testes,
  empresas,
}: {
  testes: { id: string; nome: string }[];
  empresas: { id: string; nome: string }[];
}) {
  const [state, action] = useActionState<TestesState, FormData>(enviarTeste, {});
  const [pessoa, setPessoa] = useState("");
  const [telefone, setTelefone] = useState("");
  const [teste, setTeste] = useState(testes[0]?.id ?? "");
  const [enviado, setEnviado] = useState<{ pessoa: string; telefone: string; teste: string; link: string } | null>(null);
  const [copiado, setCopiado] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok && state.token) {
      setEnviado({
        pessoa,
        telefone,
        teste: testes.find((t) => t.id === teste)?.nome ?? "",
        link: linkDe(state.token),
      });
      setPessoa("");
      setTelefone("");
    }
    // Só quando chega uma resposta nova do servidor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <Painel titulo="Enviar um teste" descricao="Gera um link para a pessoa responder pelo celular ou computador. A resposta aparece aqui embaixo, já apurada.">
      <form ref={formRef} action={action} className="grid gap-2 sm:grid-cols-[2fr_2fr_1.3fr_2fr_auto] sm:items-end">
        <Field label="Teste">
          <Select name="teste" value={teste} onChange={(e) => setTeste(e.target.value)}>
            {testes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nome}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Quem vai responder">
          <Input name="pessoa" required value={pessoa} onChange={(e) => setPessoa(e.target.value)} placeholder="Nome da pessoa" />
        </Field>
        <Field label="WhatsApp (opcional)">
          <Input name="telefone" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="(11) 99999-9999" />
        </Field>
        <Field label="Empresa (opcional)">
          <Select name="companyId" defaultValue="">
            <option value="">— nenhuma —</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </Field>
        <SubmitButton pendingLabel="Gerando…">
          <span className="inline-flex items-center gap-1.5">
            <Send size={14} /> Gerar link
          </span>
        </SubmitButton>
      </form>
      <div className="mt-2">
        <FormError message={state.error} />
      </div>

      {enviado ? (
        <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
          <p className="text-sm font-medium text-emerald-900">
            Link de {enviado.pessoa} pronto — {enviado.teste}
          </p>
          <code className="mt-1 block break-all rounded bg-white px-2 py-1 text-[11px] text-slate-700">{enviado.link}</code>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              className={botao}
              onClick={async () => {
                await navigator.clipboard.writeText(mensagem(enviado.pessoa, enviado.teste, enviado.link));
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
            >
              <Copy size={12} /> {copiado ? "Copiado" : "Copiar mensagem com o link"}
            </button>
            <a
              className={botao}
              href={whatsappDe(enviado.telefone, mensagem(enviado.pessoa, enviado.teste, enviado.link))}
              target="_blank"
              rel="noreferrer"
            >
              <MessageCircle size={12} /> Mandar pelo WhatsApp
            </a>
          </div>
        </div>
      ) : null}
    </Painel>
  );
}

/** Os botões de um envio na lista: copiar o link de novo, WhatsApp, excluir. */
export function AcoesDoEnvio({
  id,
  token,
  pessoa,
  teste,
  telefone,
  respondido,
}: {
  id: string;
  token: string;
  pessoa: string;
  teste: string;
  telefone: string | null;
  respondido: boolean;
}) {
  const [copiado, setCopiado] = useState(false);
  const [pendente, iniciar] = useTransition();

  return (
    <div className="flex shrink-0 items-center gap-1">
      {respondido ? null : (
        <>
          <button
            type="button"
            className={botao}
            title="Copiar o link"
            onClick={async () => {
              await navigator.clipboard.writeText(linkDe(token));
              setCopiado(true);
              setTimeout(() => setCopiado(false), 2000);
            }}
          >
            <Copy size={12} /> {copiado ? "Copiado" : "Link"}
          </button>
          {/* O link é montado no clique: com o endereço do navegador, que
              não existe enquanto a página é montada no servidor. */}
          <button
            type="button"
            className={botao}
            title="Mandar pelo WhatsApp"
            onClick={() =>
              window.open(whatsappDe(telefone, mensagem(pessoa, teste, linkDe(token))), "_blank", "noreferrer")
            }
          >
            <MessageCircle size={12} />
          </button>
        </>
      )}
      <button
        type="button"
        disabled={pendente}
        aria-label="Excluir envio"
        className="px-1 text-slate-400 transition hover:text-red-600 disabled:opacity-50"
        onClick={() => {
          const aviso = respondido
            ? `Excluir o teste de ${pessoa}? As respostas e o resultado serão apagados.`
            : `Excluir o envio para ${pessoa}? O link para de funcionar.`;
          if (confirm(aviso)) iniciar(async () => void (await excluirEnvio(id)));
        }}
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
