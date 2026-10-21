"use client";

import { useActionState, useTransition } from "react";
import { desmarcarFolga, marcarFolga, type EstadoFolga } from "@/app/folgas/actions";
import { BotaoEnviar } from "./formularios";
import { Campo, Erro, Ok, estiloBotaoLeve, estiloCampo } from "./ui";

export function FormFolga({ de, ate, hoje }: { de: string; ate: string; hoje: string }) {
  const [estado, acao] = useActionState<EstadoFolga, FormData>(marcarFolga, {});
  return (
    <form action={acao} className="space-y-4">
      <Campo rotulo="Dia da folga">
        <input name="dia" type="date" min={de} max={ate} defaultValue={hoje} required className={estiloCampo} />
      </Campo>
      <Campo rotulo="Observação" dica="Opcional. Por exemplo: folga da escala, troca com colega.">
        <input name="motivo" maxLength={200} className={estiloCampo} />
      </Campo>
      <Erro texto={estado.erro} />
      <Ok texto={estado.ok} />
      <BotaoEnviar className="w-full">Marcar folga</BotaoEnviar>
    </form>
  );
}

export function DesmarcarFolga({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button type="button" disabled={pendente} onClick={() => iniciar(() => desmarcarFolga(id))} className={estiloBotaoLeve}>
      {pendente ? "Desfazendo…" : "Desfazer"}
    </button>
  );
}
