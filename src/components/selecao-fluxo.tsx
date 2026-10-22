"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Award, Briefcase, ClipboardCheck, FileText, Link2, MessagesSquare } from "lucide-react";
import { escolherCargoDaVaga, ligarTesteAoCandidato } from "@/app/(app)/selecao/actions";
import { avisar } from "./avisos";
import { Painel } from "./ui";
import type { CandidatoNaTela } from "./selecao-quadro";

/**
 * O fluxo da vaga em cinco passos: descrição do cargo, ficha, testes,
 * entrevista e resultado final. Cada passo diz onde está e o que falta; o
 * trabalho de cada candidato continua no cartão dele e na pasta.
 */

export type CargoDaVaga = { id: string; nome: string; temDescricao: boolean; aprovadaEm: string | null } | null;
export type TesteSolto = { id: string; pessoa: string; teste: string; respondido: boolean; enviadoEm: string; daEmpresa: boolean; sugerido: string | null };

const botao =
  "inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-micro text-slate-600 transition hover:border-brand-300 hover:text-brand-700 disabled:opacity-50";
const seletor =
  "rounded-md border border-slate-200 bg-white px-1.5 py-1 text-micro text-slate-600 outline-none focus:border-brand-400";

function Passo({
  numero,
  titulo,
  icone,
  feito,
  children,
}: {
  numero: number;
  titulo: string;
  icone: React.ReactNode;
  feito: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 rounded-lg border p-2.5 ${feito ? "border-emerald-200 bg-emerald-50/40" : "border-slate-200 bg-white"}`}>
      <p className="flex items-center gap-1.5 text-mini font-semibold text-slate-800">
        <span className={`grid h-5 w-5 place-items-center rounded-full text-micro ${feito ? "bg-emerald-600 text-white" : "bg-slate-200 text-slate-600"}`}>{numero}</span>
        {icone}
        {titulo}
      </p>
      <div className="space-y-1.5 text-micro text-slate-600">{children}</div>
    </div>
  );
}

function DescricaoDoCargo({
  vagaId,
  empresaId,
  cargo,
  cargos,
}: {
  vagaId: string;
  empresaId: string | null;
  cargo: CargoDaVaga;
  cargos: { id: string; nome: string }[];
}) {
  const [pendente, iniciar] = useTransition();
  const trocar = (id: string) =>
    iniciar(async () => {
      const r = await escolherCargoDaVaga(vagaId, id);
      if (r.error) avisar(r.error);
    });

  return (
    <>
      {cargo ? (
        <p>
          <span className="font-medium text-slate-800">{cargo.nome}</span>
          {" · "}
          {cargo.aprovadaEm ? `aprovada em ${cargo.aprovadaEm}` : cargo.temDescricao ? "rascunho, falta aprovar" : "ainda sem descrição"}
        </p>
      ) : (
        <p>A vaga ainda não está ligada a um cargo.</p>
      )}
      {cargos.length > 0 ? (
        <select value={cargo?.id ?? ""} disabled={pendente} onChange={(e) => trocar(e.target.value)} aria-label="Cargo da vaga" className={`${seletor} w-full`}>
          <option value="">{cargo ? "Desligar do cargo" : "Escolher o cargo…"}</option>
          {cargos.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      ) : null}
      {empresaId ? (
        <div className="flex flex-wrap gap-1">
          {cargo && cargo.temDescricao ? (
            <Link href={`/empresas/${empresaId}/cargos/${cargo.id}/imprimir`} className={botao} target="_blank">
              Ver descrição
            </Link>
          ) : null}
          <Link href={`/empresas/${empresaId}/cargos${cargo ? `?cargo=${cargo.id}` : ""}`} className={botao}>
            {cargo ? (cargo.temDescricao ? "Editar" : "Escrever ou gerar") : "Criar cargo"}
          </Link>
        </div>
      ) : null}
    </>
  );
}

function LigarTeste({ t, vagaId, candidatos }: { t: TesteSolto; vagaId: string; candidatos: CandidatoNaTela[] }) {
  const [alvo, setAlvo] = useState(t.sugerido ?? "NOVO");
  const [pendente, iniciar] = useTransition();
  return (
    <li className="flex flex-wrap items-center gap-2 py-1.5">
      <span className="min-w-0 flex-1 text-mini">
        <span className="font-medium text-slate-800">{t.pessoa}</span>
        <span className="text-slate-500">
          {" · "}
          {t.teste} · {t.respondido ? "respondido" : "esperando resposta"} · {t.enviadoEm}
          {t.daEmpresa ? "" : " · sem empresa"}
        </span>
      </span>
      <select value={alvo} onChange={(e) => setAlvo(e.target.value)} aria-label={`Candidato para o teste de ${t.pessoa}`} className={`${seletor} w-full sm:w-64`}>
        {candidatos.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
            {c.situacao !== "EM_ANDAMENTO" ? " (encerrado)" : ""}
            {c.telefone ? ` · ${c.telefone}` : ""}
          </option>
        ))}
        <option value="NOVO">Cadastrar {t.pessoa} como candidato novo</option>
      </select>
      <button
        type="button"
        className={botao}
        disabled={pendente}
        onClick={() =>
          iniciar(async () => {
            const r = await ligarTesteAoCandidato(t.id, vagaId, alvo);
            if (r.error) avisar(r.error);
          })
        }
      >
        <Link2 className="h-3 w-3" /> {pendente ? "Ligando…" : "Ligar"}
      </button>
    </li>
  );
}

export default function FluxoDaVaga({
  vagaId,
  empresaId,
  cargo,
  cargosDaEmpresa,
  candidatos,
  perguntas,
  testesSoltos,
}: {
  vagaId: string;
  empresaId: string | null;
  cargo: CargoDaVaga;
  cargosDaEmpresa: { id: string; nome: string }[];
  candidatos: CandidatoNaTela[];
  perguntas: number;
  testesSoltos: TesteSolto[];
}) {
  const total = candidatos.length;
  const fichas = candidatos.filter((c) => c.ficha === "RESPONDIDA").length;
  const comTeste = candidatos.filter((c) => c.testes.some((t) => t.respondido)).length;
  const entrevistas = candidatos.filter((c) => c.entrevistaRegistrada).length;
  const aprovados = candidatos.filter((c) => c.situacao === "APROVADO").length;
  const encerrados = candidatos.filter((c) => c.situacao !== "EM_ANDAMENTO").length;
  const daEmpresa = testesSoltos.filter((t) => t.daEmpresa);
  const [verSemEmpresa, setVerSemEmpresa] = useState(false);
  const listados = verSemEmpresa ? testesSoltos : daEmpresa;

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <Passo numero={1} titulo="Descrição do cargo" icone={<Briefcase className="h-3.5 w-3.5 text-slate-500" />} feito={Boolean(cargo?.aprovadaEm)}>
          <DescricaoDoCargo vagaId={vagaId} empresaId={empresaId} cargo={cargo} cargos={cargosDaEmpresa} />
        </Passo>
        <Passo numero={2} titulo="Ficha" icone={<FileText className="h-3.5 w-3.5 text-slate-500" />} feito={total > 0 && fichas === total}>
          <p>
            {fichas} de {total} respondida(s).
          </p>
          <p className="text-slate-500">No cartão do candidato: mandar o link ou preencher aqui com ele.</p>
        </Passo>
        <Passo numero={3} titulo="Testes" icone={<ClipboardCheck className="h-3.5 w-3.5 text-slate-500" />} feito={total > 0 && comTeste === total}>
          <p>
            {comTeste} de {total} com teste respondido.
          </p>
          {daEmpresa.length > 0 ? (
            <a href="#testes-soltos" className="font-medium text-amber-700 hover:underline">
              {daEmpresa.length} teste(s) da aba Testes para ligar
            </a>
          ) : (
            <p className="text-slate-500">No cartão: mandar o teste ou abrir para responder aqui.</p>
          )}
        </Passo>
        <Passo numero={4} titulo="Entrevista" icone={<MessagesSquare className="h-3.5 w-3.5 text-slate-500" />} feito={total > 0 && entrevistas === total}>
          <p>
            Roteiro com {perguntas} pergunta(s) · {entrevistas} registrada(s).
          </p>
          <p className="text-slate-500">Na pasta: colar a transcrição para a IA organizar, ou escrever à mão.</p>
        </Passo>
        <Passo numero={5} titulo="Resultado final" icone={<Award className="h-3.5 w-3.5 text-slate-500" />} feito={total > 0 && encerrados === total}>
          <p>
            {aprovados} aprovado(s) · {encerrados - aprovados} fora · {total - encerrados} no processo.
          </p>
          <p className="text-slate-500">Na pasta: parecer sugerido pela IA ou escrito à mão.</p>
        </Passo>
      </div>

      {testesSoltos.length > 0 ? (
        <div id="testes-soltos">
          <Painel
            titulo="Testes feitos na aba Testes"
            descricao="Ligue cada teste a um candidato desta vaga. Quando o nome bate, o candidato já vem escolhido; confira antes de ligar."
            acao={
              testesSoltos.length > daEmpresa.length ? (
                <button type="button" className={botao} onClick={() => setVerSemEmpresa((v) => !v)}>
                  {verSemEmpresa ? "Só os desta empresa" : `Ver também os sem empresa (${testesSoltos.length - daEmpresa.length})`}
                </button>
              ) : null
            }
          >
            {listados.length === 0 ? (
              <p className="text-mini text-slate-500">Nenhum teste desta empresa esperando.</p>
            ) : (
              <ul className="divide-y divide-slate-100">
                {listados.map((t) => (
                  <LigarTeste key={t.id} t={t} vagaId={vagaId} candidatos={candidatos} />
                ))}
              </ul>
            )}
          </Painel>
        </div>
      ) : null}
    </div>
  );
}
