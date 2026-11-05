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

export type EmpresaDaAdmissao = { id: string; nome: string; cnpj: string | null; cargos: string[] };

export type ValoresDaAdmissao = {
  id: string;
  companyId: string;
  cnpj: string;
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
  const [cnpj, setCnpj] = useState(valores ? formatarCnpj(valores.cnpj) : empresa?.cnpj ? formatarCnpj(empresa.cnpj) : "");

  function trocarEmpresa(id: string) {
    setEmpresaId(id);
    const e = empresas.find((x) => x.id === id);
    setCnpj(e?.cnpj ? formatarCnpj(e.cnpj) : "");
  }

  return (
    <form action={action} className="space-y-3">
      {valores ? <input type="hidden" name="id" value={valores.id} /> : null}
      <input type="hidden" name="companyId" value={empresaId} />

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
        <Field label="CNPJ da empresa" hint={empresa && !empresa.cnpj && !editando ? "A empresa está sem CNPJ no cadastro: o que você digitar aqui fica salvo nela." : undefined}>
          <Input name="cnpj" value={cnpj} onChange={(e) => setCnpj(e.target.value)} inputMode="numeric" placeholder="00.000.000/0000-00" required />
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
