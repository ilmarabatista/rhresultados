"use client";

import { excluirComPermissao } from "@/components/com-permissao";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Printer, Sparkles } from "lucide-react";
import {
  excluirMapeamento,
  linkDoMapeamento,
  preencherPelaTranscricao,
  salvarMapeamento,
  type CabecalhoDoMapeamento,
} from "@/app/(app)/empresas/[id]/equipe/mapeamento-actions";
import type { DadosDoMapeamento, StatusDoMapeamento } from "@/lib/mapeamento";
import BotoesDoLink from "./mapeamento-link";
import MapeamentoSecoes from "./mapeamento-secoes";
import { Field, FormError, Input, Textarea } from "./form";
import { avisar, confirmar } from "@/components/avisos";

/**
 * O mapeamento de rotinas na tela, nas seções do modelo da clínica. Tudo fica
 * no estado da página e vai para o banco no Salvar; o rascunho da IA entra na
 * tela para o RH revisar antes de salvar.
 */

type Campo = keyof DadosDoMapeamento;

export default function MapeamentoEditor({
  companyId,
  employeeId,
  mapId,
  pessoa,
  cabecalho: cabecalhoInicial,
  dados: dadosIniciais,
  link,
}: {
  companyId: string;
  employeeId: string;
  mapId: string;
  pessoa: string;
  cabecalho: CabecalhoDoMapeamento;
  dados: DadosDoMapeamento;
  /** A situação do link da pessoa. */
  link: { status: StatusDoMapeamento; token: string | null; telefone: string | null; respondidoEm: string | null };
}) {
  const router = useRouter();
  const [cab, setCab] = useState(cabecalhoInicial);
  const [d, setD] = useState(dadosIniciais);
  const [mudou, setMudou] = useState(false);
  const [erro, setErro] = useState<string>();
  const [salvando, startSalvar] = useTransition();
  const [lendo, startLer] = useTransition();
  const [transcricao, setTranscricao] = useState("");
  const [abrirIA, setAbrirIA] = useState(false);

  // Sair da página com mudança sem salvar pede confirmação do navegador.
  useEffect(() => {
    if (!mudou) return;
    const aviso = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", aviso);
    return () => window.removeEventListener("beforeunload", aviso);
  }, [mudou]);

  function muda<K extends Campo>(campo: K, valor: DadosDoMapeamento[K]) {
    setD((atual) => ({ ...atual, [campo]: valor }));
    setMudou(true);
  }
  function mudaCab(campo: keyof CabecalhoDoMapeamento, valor: string) {
    setCab((atual) => ({ ...atual, [campo]: valor }));
    setMudou(true);
  }

  const texto = (campo: Campo & string, rows = 2, placeholder?: string) => (
    <Textarea
      rows={rows}
      value={d[campo] as string}
      placeholder={placeholder}
      onChange={(e) => muda(campo, e.target.value as never)}
    />
  );

  function salvar() {
    setErro(undefined);
    startSalvar(async () => {
      const r = await salvarMapeamento(mapId, cab, d);
      if (r.error) return setErro(r.error);
      setMudou(false);
      avisar("Mapeamento salvo.");
      router.refresh();
    });
  }

  function lerTranscricao() {
    setErro(undefined);
    startLer(async () => {
      const r = await preencherPelaTranscricao(mapId, transcricao, d);
      if (r.error || !r.dados) return setErro(r.error ?? "A IA não respondeu.");
      setD(r.dados);
      setMudou(true);
      setAbrirIA(false);
      avisar("Rascunho da IA na tela. Revise e salve.");
    });
  }

  function mandarLink() {
    setErro(undefined);
    startSalvar(async () => {
      if (mudou) {
        const salvo = await salvarMapeamento(mapId, cab, d);
        if (salvo.error) return setErro(salvo.error);
        setMudou(false);
      }
      const r = await linkDoMapeamento(mapId);
      if (r.error) return setErro(r.error);
      router.refresh();
    });
  }

  async function excluir() {
    if (!(await confirmar(`Excluir este mapeamento de ${pessoa}?`, { sim: "Excluir" }))) return;
    const r = await excluirComPermissao((apagar) => excluirMapeamento(mapId, apagar));
    if (!r) return;
    if (r.error) return setErro(r.error);
    router.push(`/empresas/${companyId}/equipe/${employeeId}`);
  }

  return (
    <div className="space-y-3.5">
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-micro uppercase tracking-wider text-slate-500">Mapeamento de rotinas</p>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{pessoa}</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/empresas/${companyId}/equipe/${employeeId}/mapeamento/${mapId}/imprimir`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50"
            >
              <Printer size={14} /> Imprimir
            </Link>
            <button
              type="button"
              onClick={() => setAbrirIA((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800 transition hover:bg-brand-100"
            >
              <Sparkles size={14} /> Preencher pela transcrição
            </button>
          </div>
        </div>

        {link.status === "ENVIADO" && link.token ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <span className="min-w-0 flex-1">
              O link está com {pessoa.split(" ")[0]}, que ainda não enviou. O que já foi escrito aparece aqui quando você
              recarrega a página.
            </span>
            <BotoesDoLink token={link.token} nome={pessoa} telefone={link.telefone} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <span className="min-w-0 flex-1">
              {link.status === "RESPONDIDO"
                ? `Respondido por ${pessoa.split(" ")[0]}${link.respondidoEm ? ` em ${link.respondidoEm}` : ""}. Revise, complete as observações do RH e imprima.`
                : "Preenchido pelo RH. Se quiser, mande o link para a pessoa conferir e completar."}
            </span>
            <button
              type="button"
              disabled={salvando}
              onClick={mandarLink}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
            >
              {link.status === "RESPONDIDO" ? "Reabrir o link" : "Mandar o link para a pessoa"}
            </button>
          </div>
        )}

        {abrirIA ? (
          <div className="space-y-2 rounded-lg border border-brand-200 bg-brand-50/40 p-3">
            <p className="text-xs text-slate-600">
              Cole a transcrição da entrevista ou as suas anotações. A IA organiza nas seções abaixo, sem apagar o que você já
              escreveu e o que ela não encontrou. Nada é salvo até você clicar em Salvar.
            </p>
            <Textarea rows={8} value={transcricao} onChange={(e) => setTranscricao(e.target.value)} />
            <div className="flex justify-end">
              <button
                type="button"
                disabled={lendo}
                onClick={lerTranscricao}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
              >
                {lendo ? "Lendo a entrevista… (pode levar 1 a 2 minutos)" : "Organizar com a IA"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Data da entrevista">
            <Input type="date" value={cab.dataDaEntrevista} onChange={(e) => mudaCab("dataDaEntrevista", e.target.value)} />
          </Field>
          <Field label="Entrevistado por">
            <Input value={cab.entrevistador} onChange={(e) => mudaCab("entrevistador", e.target.value)} />
          </Field>
          <Field label="Versão">
            <Input value={cab.versao} onChange={(e) => mudaCab("versao", e.target.value)} />
          </Field>
          <Field label="Próxima revisão">
            <Input type="date" value={cab.proximaRevisao} onChange={(e) => mudaCab("proximaRevisao", e.target.value)} />
          </Field>
        </div>
      </section>

      <MapeamentoSecoes d={d} muda={muda} />

      <section className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-4 shadow-sm">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">9. Observações da gerente de RH</h2>
          <p className="mt-0.5 text-xs text-amber-800">Só para o RH. Não sai na via do colaborador.</p>
        </div>
        <Field label="Impressões gerais sobre o colaborador e o setor">{texto("rhImpressoes", 4)}</Field>
        <Field label="Pontos de atenção" hint="Um por linha. Cada linha vira uma sugestão de meta no PDI.">
          {texto("rhAtencao", 4)}
        </Field>
        <Field label="Próximos passos após a entrevista" hint="Um por linha. Também viram sugestões de meta no PDI.">
          {texto("rhProximosPassos", 4)}
        </Field>
      </section>

      <div className="sticky bottom-3 z-10 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white/95 p-3 shadow-md backdrop-blur">
        <button type="button" onClick={excluir} className="text-sm text-red-600 hover:underline">
          Excluir mapeamento
        </button>
        <div className="flex flex-1 items-center justify-end gap-3">
          <FormError message={erro} />
          {mudou ? <span className="text-xs text-amber-700">Há mudanças sem salvar</span> : null}
          <button
            type="button"
            disabled={salvando}
            onClick={salvar}
            className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
          >
            {salvando ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
