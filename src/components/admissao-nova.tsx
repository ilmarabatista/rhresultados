"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import AdmissaoForm, { type EmpresaDaAdmissao } from "@/components/admissao-form";
import { Painel } from "@/components/ui";

/** O botão "Nova admissão", que abre os dados iniciais. */
export default function AdmissaoNova({ empresas, empresaInicial }: { empresas: EmpresaDaAdmissao[]; empresaInicial?: string }) {
  const [aberta, setAberta] = useState(false);

  if (!aberta) {
    return (
      <button
        type="button"
        onClick={() => setAberta(true)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
      >
        <Plus size={14} /> Nova admissão
      </button>
    );
  }

  return (
    <Painel
      titulo="Nova admissão"
      descricao="Os dados que vão ao médico do trabalho para o exame admissional."
      acao={
        <button type="button" onClick={() => setAberta(false)} className="text-xs text-slate-500 hover:text-slate-700">
          Fechar
        </button>
      }
    >
      <AdmissaoForm empresas={empresas} empresaInicial={empresaInicial} />
    </Painel>
  );
}
