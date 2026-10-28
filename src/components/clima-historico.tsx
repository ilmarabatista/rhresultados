"use client";

import { excluirComPermissao } from "@/components/com-permissao";
import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { excluirPesquisa, salvarMediasDigitadas, type ClimaState } from "@/app/(app)/empresas/[id]/clima/actions";
import { FormOk } from "./form";
import { FormularioDeHistorico } from "./clima-ciclos";
import { Painel } from "./ui";
import { avisarSeErro, confirmar } from "./avisos";

/** Um ciclo feito fora do sistema: só as médias, que se corrigem aqui. */
export default function ClimaHistorico({
  companyId,
  pesquisaId,
  inicial,
}: {
  companyId: string;
  pesquisaId: string;
  inicial: { nome: string; ano: number; medias: string };
}) {
  const router = useRouter();
  const [state, action] = useActionState<ClimaState, FormData>(salvarMediasDigitadas, {});
  const [pendente, start] = useTransition();

  return (
    <Painel
      titulo="Médias do ciclo antigo"
      descricao="Este ciclo foi aplicado fora do sistema. As médias entram no comparativo da empresa."
      acao={
        <button
          type="button"
          disabled={pendente}
          onClick={async () => {
            if (!(await confirmar(`Excluir ${inicial.nome}?`, { sim: "Excluir" }))) return;
            start(async () => {
              const r = await excluirComPermissao((apagar) => excluirPesquisa(pesquisaId, apagar));
              avisarSeErro(r);
              if (r?.ok) router.push(`/empresas/${companyId}/clima`);
            });
          }}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-red-700 transition hover:bg-red-50"
        >
          <Trash2 size={13} /> Excluir
        </button>
      }
    >
      <FormularioDeHistorico action={action} state={state} pesquisaId={pesquisaId} inicial={inicial} />
      {state.ok ? <div className="mt-2"><FormOk message="Médias salvas." /></div> : null}
    </Painel>
  );
}
