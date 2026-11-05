"use client";

import { useActionState, useState } from "react";
import { criarAdmissao, editarAdmissao, type AdmissaoState } from "@/app/(app)/admissoes/actions";
import { Field, FormError, FormOk, Input, Select, SubmitButton, Textarea } from "@/components/form";
import { formatarCnpj, formatarCpf } from "@/lib/admissao";

/**
 * Os dados iniciais da admissão: os que o médico do trabalho pede (CNPJ,
 * nome, CPF, nascimento e função) e, se já se sabe, o WhatsApp do
 * funcionário e o dia em que ele começa.
 */

export type UnidadeDaAdmissao = { id: string; nome: string; cnpj: string | null; razaoSocial: string | null };

export type EmpresaDaAdmissao = {
  id: string;
  nome: string;
  cnpj: string | null;
  razaoSocial: string | null;
  unidades: UnidadeDaAdmissao[];
  cargos: string[];
};

export type ValoresDaAdmissao = {
  id: string;
  companyId: string;
  branchId: string;
  cnpj: string;
  razaoSocial: string;
  nome: string;
  cpf: string;
  dataNascimento: string;
  funcao: string;
  telefone: string;
  dataAdmissao: string;
  observacoes: string;
};

export default function AdmissaoForm({
  empresas,
  empresaInicial,
  valores,
  aoSalvar,
}: {
  empresas: EmpresaDaAdmissao[];
  empresaInicial?: string;
  valores?: ValoresDaAdmissao;
  aoSalvar?: () => void;
}) {
  const editando = Boolean(valores);
  const [state, action] = useActionState<AdmissaoState, FormData>(async (prev, fd) => {
    const r = await (editando ? editarAdmissao : criarAdmissao)(prev, fd);
    if (r.ok) aoSalvar?.();
    return r;
  }, {});

  const [empresaId, setEmpresaId] = useState(valores?.companyId ?? empresaInicial ?? "");
  const empresa = empresas.find((e) => e.id === empresaId);
  const [unidadeId, setUnidadeId] = useState(valores?.branchId ?? "");
  const [cnpj, setCnpj] = useState(valores ? formatarCnpj(valores.cnpj) : empresa?.cnpj ? formatarCnpj(empresa.cnpj) : "");
  const [razao, setRazao] = useState(valores?.razaoSocial ?? empresa?.razaoSocial ?? "");

  /** O CNPJ e a razão social vêm da unidade quando ela tem os dela; senão, da empresa. */
  function preencher(e: EmpresaDaAdmissao | undefined, uId: string) {
    const u = e?.unidades.find((x) => x.id === uId);
    const doc = u?.cnpj || e?.cnpj || "";
    setCnpj(doc ? formatarCnpj(doc) : "");
    setRazao((u?.cnpj ? u.razaoSocial : null) || e?.razaoSocial || "");
  }

  function trocarEmpresa(id: string) {
    setEmpresaId(id);
    setUnidadeId("");
    preencher(empresas.find((x) => x.id === id), "");
  }

  function trocarUnidade(id: string) {
    setUnidadeId(id);
    preencher(empresa, id);
  }

  const unidadeEscolhida = empresa?.unidades.find((u) => u.id === unidadeId);
  const semCnpj = !editando && empresa && !(unidadeEscolhida ? unidadeEscolhida.cnpj || empresa.cnpj : empresa.cnpj);

  return (
    <form action={action} className="space-y-3">
      {valores ? <input type="hidden" name="id" value={valores.id} /> : null}
      <input type="hidden" name="companyId" value={empresaId} />
      <input type="hidden" name="branchId" value={unidadeId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Empresa">
          <Select value={empresaId} onChange={(e) => trocarEmpresa(e.target.value)} disabled={editando} required>
            <option value="">Escolha…</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>
                {e.nome}
              </option>
            ))}
          </Select>
        </Field>
        {empresa && empresa.unidades.length > 0 ? (
          <Field label="Unidade" hint="Cada unidade com CNPJ próprio traz o dela.">
            <Select value={unidadeId} onChange={(e) => trocarUnidade(e.target.value)}>
              <option value="">Sem unidade (CNPJ da empresa)</option>
              {empresa.unidades.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome}
                  {u.cnpj ? "" : " (sem CNPJ próprio)"}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <div className="hidden sm:block" />
        )}
        <Field
          label="CNPJ"
          hint={semCnpj ? `Sem CNPJ no cadastro: o que você digitar aqui fica salvo ${unidadeEscolhida ? "na unidade" : "na empresa"}.` : undefined}
        >
          <Input name="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} inputMode="numeric" placeholder="00.000.000/0000-00" required />
        </Field>
        <Field label="Razão social">
          <Input name="razaoSocial" value={razao} onChange={(e) => setRazao(e.target.value)} maxLength={200} autoComplete="off" />
        </Field>
        <Field label="Nome do funcionário" className="sm:col-span-2">
          <Input name="nome" defaultValue={valores?.nome} required maxLength={150} autoComplete="off" />
        </Field>
        <Field label="CPF">
          <Input name="cpf" defaultValue={valores ? formatarCpf(valores.cpf) : ""} inputMode="numeric" placeholder="000.000.000-00" required />
        </Field>
        <Field label="Data de nascimento">
          <Input name="dataNascimento" type="date" defaultValue={valores?.dataNascimento} required />
        </Field>
        <Field label="Função">
          <Input name="funcao" defaultValue={valores?.funcao} list="cargos-da-empresa" required maxLength={120} autoComplete="off" />
          <datalist id="cargos-da-empresa">
            {(empresa?.cargos ?? []).map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="WhatsApp do funcionário" hint="Para mandar o link dos documentos.">
          <Input name="telefone" defaultValue={valores?.telefone} inputMode="tel" placeholder="(83) 90000-0000" />
        </Field>
        <Field label="Começa em" hint="Se já souber.">
          <Input name="dataAdmissao" type="date" defaultValue={valores?.dataAdmissao} />
        </Field>
        <Field label="Observações" className="sm:col-span-2">
          <Textarea name="observacoes" defaultValue={valores?.observacoes} rows={2} maxLength={2000} placeholder="Salário, horário, o que a contabilidade precisar saber." />
        </Field>
      </div>

      <FormError message={state.error} />
      {editando ? <FormOk message={state.ok ? "Dados salvos." : undefined} /> : null}
      <SubmitButton>{editando ? "Salvar dados" : "Abrir admissão"}</SubmitButton>
    </form>
  );
}
