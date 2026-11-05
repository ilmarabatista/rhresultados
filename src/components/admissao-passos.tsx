"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Download, MessageCircle, UserPlus } from "lucide-react";
import {
  MEDICO_DO_TRABALHO,
  mensagemAoFuncionario,
  mensagemAoMedico,
  mensagemDosDados,
  textoDaConsulta,
  whatsapp,
  type DadosIniciais,
} from "@/lib/admissao";
import { baixarPacote } from "@/lib/admissao-cliente";
import { linkPublico } from "@/lib/link-publico";
import {
  criarNaEquipe,
  excluirAdmissao,
  marcarEnvio,
  marcarPacoteGerado,
  reabrirLink,
  salvarConsulta,
  type AdmissaoState,
} from "@/app/(app)/admissoes/actions";
import { FormError, Input, SmallSubmitButton } from "@/components/form";
import { avisar, confirmar } from "@/components/avisos";

/**
 * Os quatro passos da assinatura de carteira, cada um com o seu botão:
 * mandar ao médico, mandar o link ao funcionário, acompanhar os documentos e
 * baixar o pacote para a contabilidade.
 */

type Props = {
  id: string;
  token: string;
  dados: DadosIniciais;
  telefone: string | null;
  faltamDados: string[];
  linkDadosEnviadoEm: string | null;
  dadosPreenchidosEm: string | null;
  consulta: { data: string; hora: string; local: string };
  enviadoAoMedicoEm: string | null;
  linkEnviadoEm: string | null;
  documentosEnviadosEm: string | null;
  pacoteGeradoEm: string | null;
  temAso: boolean;
  recebidos: number;
  obrigatoriosFaltando: string[];
  totalArquivos: number;
  naEquipe: { companyId: string; employeeId: string } | null;
};

const botao = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-60";
const principal = `${botao} bg-brand-600 text-white hover:bg-brand-700`;
const claro = `${botao} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50`;

function quando(iso: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
}

function Passo({ n, feito, titulo, children }: { n: number; feito: boolean; titulo: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-slate-100 py-3 last:border-0">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          feito ? "bg-emerald-100 text-emerald-700" : "bg-brand-50 text-brand-700"
        }`}
      >
        {feito ? <Check size={14} /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{titulo}</p>
        <div className="mt-1 space-y-1.5 text-xs leading-relaxed text-slate-600">{children}</div>
      </div>
    </li>
  );
}

export default function AdmissaoPassos(p: Props) {
  const router = useRouter();
  const [montando, setMontando] = useState<string | null>(null);
  const link = linkPublico(`/admissao/${p.token}`);
  const linkDosDados = linkPublico(`/admissao/${p.token}/dados`);
  const consulta = p.consulta.data
    ? { data: `${p.consulta.data}T00:00:00.000Z`, hora: p.consulta.hora || null, local: p.consulta.local || null }
    : undefined;
  const [estadoConsulta, salvar] = useActionState<AdmissaoState, FormData>(async (prev, fd) => {
    const r = await salvarConsulta(prev, fd);
    if (r.ok) router.refresh();
    return r;
  }, {});

  async function dosDados() {
    window.open(whatsapp(p.telefone, mensagemDosDados(p.dados.nome, p.dados.empresa, linkDosDados)), "_blank");
    await marcarEnvio(p.id, "dados");
    router.refresh();
  }

  async function aoMedico() {
    window.open(whatsapp(MEDICO_DO_TRABALHO.telefone, mensagemAoMedico(p.dados)), "_blank");
    await marcarEnvio(p.id, "medico");
    router.refresh();
  }

  async function aoFuncionario() {
    window.open(whatsapp(p.telefone, mensagemAoFuncionario(p.dados.nome, p.dados.empresa, link, consulta)), "_blank");
    await marcarEnvio(p.id, "funcionario");
    router.refresh();
  }

  async function copiar(qual: string) {
    try {
      await navigator.clipboard.writeText(qual);
      avisar("Link copiado.");
    } catch {
      avisar(link);
    }
  }

  async function pacote() {
    if (p.obrigatoriosFaltando.length > 0) {
      const ok = await confirmar(`Ainda faltam: ${p.obrigatoriosFaltando.join(", ")}. Baixar o pacote mesmo assim?`, {
        sim: "Baixar assim",
        nao: "Esperar",
      });
      if (!ok) return;
    }
    try {
      await baixarPacote(p.id, setMontando);
      await marcarPacoteGerado(p.id);
      router.refresh();
    } catch (e) {
      avisar(e instanceof Error ? e.message : "Não foi possível montar o pacote.");
    } finally {
      setMontando(null);
    }
  }

  async function reabrir() {
    await reabrirLink(p.id);
    router.refresh();
  }

  async function equipe() {
    const r = await criarNaEquipe(p.id);
    if (r.error) avisar(r.error);
    else avisar(`${p.dados.nome} agora está na Equipe da empresa.`);
    router.refresh();
  }

  async function apagar() {
    if (!(await confirmar(`Apagar a admissão de ${p.dados.nome}?`, { sim: "Apagar", nao: "Manter" }))) return;
    const r = await excluirAdmissao(p.id);
    if (r?.error) avisar(r.error);
  }

  const semTelefone = !p.telefone;

  return (
    <ol>
      <Passo n={1} feito={p.faltamDados.length === 0} titulo="Dados do funcionário">
        {p.faltamDados.length === 0 ? (
          <p className="text-emerald-700">
            {p.dadosPreenchidosEm ? `O funcionário respondeu em ${quando(p.dadosPreenchidosEm)}.` : "CPF, nascimento e função preenchidos."}
          </p>
        ) : (
          <>
            <p>Faltam: {p.faltamDados.join(", ")}. Mande o link para ele responder, ou preencha você em Editar dados.</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={dosDados} className={p.linkDadosEnviadoEm ? claro : principal}>
                <MessageCircle size={14} /> {p.linkDadosEnviadoEm ? "Mandar de novo" : "Mandar link dos dados"}
              </button>
              <button type="button" onClick={() => copiar(linkDosDados)} className={claro}>
                <Copy size={14} /> Copiar link
              </button>
              {p.linkDadosEnviadoEm ? <span className="text-slate-500">Mandado em {quando(p.linkDadosEnviadoEm)}</span> : null}
            </div>
          </>
        )}
      </Passo>

      <Passo n={2} feito={!!p.enviadoAoMedicoEm} titulo={`Mandar os dados ao ${MEDICO_DO_TRABALHO.nome}`}>
        <p>Abre o WhatsApp do médico do trabalho com CNPJ, nome, CPF, nascimento e função já escritos.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={aoMedico}
            disabled={p.faltamDados.length > 0}
            className={p.enviadoAoMedicoEm || p.faltamDados.length > 0 ? claro : principal}
          >
            <MessageCircle size={14} /> {p.enviadoAoMedicoEm ? "Mandar de novo" : `Mandar ao ${MEDICO_DO_TRABALHO.nome}`}
          </button>
          {p.enviadoAoMedicoEm ? <span className="text-emerald-700">Mandado em {quando(p.enviadoAoMedicoEm)}</span> : null}
        </div>
      </Passo>

      <Passo n={3} feito={!!p.consulta.data} titulo="Consulta do exame admissional">
        {consulta ? (
          <p className="text-emerald-700">Marcada: {textoDaConsulta(consulta)}.</p>
        ) : (
          <p>Quando o médico marcar, anote aqui. Ela vai na mensagem do link dos documentos.</p>
        )}
        <form action={salvar} className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="id" value={p.id} />
          <label className="block">
            <span className="block text-micro text-slate-500">Dia</span>
            <Input name="exameData" type="date" defaultValue={p.consulta.data} required className="!w-36 !px-2 !py-1 !text-xs" />
          </label>
          <label className="block">
            <span className="block text-micro text-slate-500">Hora</span>
            <Input name="exameHora" type="time" defaultValue={p.consulta.hora} className="!w-24 !px-2 !py-1 !text-xs" />
          </label>
          <label className="block min-w-[10rem] flex-1">
            <span className="block text-micro text-slate-500">Local</span>
            <Input name="exameLocal" defaultValue={p.consulta.local} placeholder={`Vazio: consultório do ${MEDICO_DO_TRABALHO.nome}`} className="!px-2 !py-1 !text-xs" />
          </label>
          <SmallSubmitButton>{p.consulta.data ? "Salvar" : "Marcar"}</SmallSubmitButton>
        </form>
        <FormError message={estadoConsulta.error} />
      </Passo>

      <Passo n={4} feito={!!p.linkEnviadoEm} titulo="Mandar o link dos documentos">
        <p>
          {consulta ? "A mensagem já leva o dia, a hora e o local da consulta. " : "Marque a consulta antes, para ela ir na mensagem. "}
          Pelo link ele manda a foto do ASO depois do exame e os outros documentos.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={aoFuncionario} className={p.linkEnviadoEm || !consulta ? claro : principal}>
            <MessageCircle size={14} /> {semTelefone ? "Abrir WhatsApp" : "Mandar no WhatsApp"}
          </button>
          <button type="button" onClick={() => copiar(link)} className={claro}>
            <Copy size={14} /> Copiar link
          </button>
          {p.linkEnviadoEm ? <span className="text-emerald-700">Mandado em {quando(p.linkEnviadoEm)}</span> : null}
        </div>
        {semTelefone ? <p className="text-amber-700">Sem WhatsApp do funcionário: o WhatsApp abre para você escolher o contato.</p> : null}
      </Passo>

      <Passo n={5} feito={p.temAso && p.obrigatoriosFaltando.length === 0} titulo="Receber o ASO e os documentos">
        <p>
          {p.recebidos === 0
            ? "Nada chegou ainda."
            : `${p.recebidos} ${p.recebidos === 1 ? "documento chegou" : "documentos chegaram"} (${p.totalArquivos} ${p.totalArquivos === 1 ? "arquivo" : "arquivos"}).`}
          {p.temAso ? " O ASO chegou." : " O ASO ainda não chegou."}
        </p>
        {p.obrigatoriosFaltando.length > 0 ? <p className="text-amber-700">Faltam: {p.obrigatoriosFaltando.join(", ")}.</p> : null}
        {p.documentosEnviadosEm ? <p className="text-emerald-700">O funcionário disse que terminou em {quando(p.documentosEnviadosEm)}.</p> : null}
      </Passo>

      <Passo n={6} feito={!!p.pacoteGeradoEm} titulo="Mandar à contabilidade">
        <p>Baixa um .zip com o PDF dos dados iniciais primeiro e depois um PDF para cada documento, na ordem da lista.</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={pacote} disabled={!!montando || p.totalArquivos === 0} className={p.temAso ? principal : claro}>
            <Download size={14} /> {montando ?? "Baixar pacote da contabilidade"}
          </button>
          {p.pacoteGeradoEm ? (
            <>
              <span className="text-emerald-700">Baixado em {quando(p.pacoteGeradoEm)}. O link do funcionário fechou.</span>
              <button type="button" onClick={reabrir} className="text-brand-700 underline-offset-2 hover:underline">
                Reabrir o link
              </button>
            </>
          ) : null}
        </div>
      </Passo>

      <li className="flex flex-wrap items-center gap-2 pt-3">
        {p.naEquipe ? (
          <a href={`/empresas/${p.naEquipe.companyId}/equipe/${p.naEquipe.employeeId}`} className={claro}>
            <UserPlus size={14} /> Ver na Equipe
          </a>
        ) : (
          <button type="button" onClick={equipe} className={claro}>
            <UserPlus size={14} /> Cadastrar na Equipe da empresa
          </button>
        )}
        {p.totalArquivos === 0 ? (
          <button type="button" onClick={apagar} className={`${botao} text-red-700 hover:bg-red-50`}>
            Apagar admissão
          </button>
        ) : null}
      </li>
    </ol>
  );
}
