import Link from "next/link";
import { ROTULO_DA_ETAPA, DOCUMENTOS_ADMISSIONAIS, type EtapaDaAdmissao } from "@/lib/admissao";
import { formatFullDate } from "@/lib/dates";
import { Etiqueta, Tabela, Vazio } from "@/components/ui";

/** A tabela das admissões, com a etapa em que cada uma está. */

type Linha = {
  id: string;
  nome: string;
  funcao: string | null;
  empresa: { id: string; name: string };
  createdAt: Date;
  etapa: EtapaDaAdmissao;
  recebidos: number;
};

const TOM: Record<EtapaDaAdmissao, "neutro" | "azul" | "bom" | "atencao"> = {
  DADOS: "azul",
  MEDICO: "atencao",
  CONSULTA: "atencao",
  ASO: "azul",
  DOCUMENTOS: "azul",
  PACOTE: "atencao",
  PRONTA: "bom",
};

export default function AdmissoesLista({ lista, mostrarEmpresa }: { lista: Linha[]; mostrarEmpresa: boolean }) {
  if (lista.length === 0) {
    return <Vazio>Nenhuma admissão ainda. Comece pelo botão Nova admissão.</Vazio>;
  }

  return (
    <Tabela titulo="Admissões" direita={`${lista.length}`}>
      <ul className="divide-y divide-slate-100">
        {lista.map((a) => (
          <li key={a.id}>
            <Link href={`/admissoes/${a.id}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 transition hover:bg-slate-50">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-800">{a.nome}</span>
                <span className="block truncate text-xs text-slate-500">
                  {a.funcao ?? "função a responder"}
                  {mostrarEmpresa ? ` · ${a.empresa.name}` : ""}
                </span>
              </span>
              <span className="text-xs tabular-nums text-slate-500">
                {a.recebidos}/{DOCUMENTOS_ADMISSIONAIS.length} documentos
              </span>
              <Etiqueta tom={TOM[a.etapa]}>{ROTULO_DA_ETAPA[a.etapa]}</Etiqueta>
              <span className="w-24 text-right text-xs text-slate-500">{formatFullDate(a.createdAt)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </Tabela>
  );
}
