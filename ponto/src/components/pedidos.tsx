"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { batidasDoDia, cancelarPedido, fazerPedido, type EstadoPedido } from "@/app/pedidos/actions";
import { Campo, Erro, Ok, estiloBotao, estiloBotaoLeve, estiloCampo } from "./ui";

type Aba = "ATESTADO" | "CORRECAO";
type Batida = { id: string; hora: string; manual: boolean };

/** Lado maior da foto do atestado depois de reduzida no celular. */
const LADO_MAXIMO = 1800;

/**
 * Foto vira JPEG menor antes de sair do celular (as câmeras de hoje passam de
 * 5 MB). PDF vai como está. Se o navegador não conseguir abrir a foto, ela
 * vai como está e o servidor diz se aceita.
 */
async function prepararArquivo(arquivo: File): Promise<Blob | File> {
  if (!arquivo.type.startsWith("image/") || arquivo.size < 400_000) return arquivo;
  try {
    const imagem = await createImageBitmap(arquivo);
    const escala = Math.min(1, LADO_MAXIMO / Math.max(imagem.width, imagem.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(imagem.width * escala);
    canvas.height = Math.round(imagem.height * escala);
    canvas.getContext("2d")!.drawImage(imagem, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    return blob ?? arquivo;
  } catch {
    return arquivo;
  }
}

export function FormPedido({
  abaInicial,
  diaInicial,
  hoje,
  de,
  ateAtestado,
}: {
  abaInicial: Aba;
  diaInicial: string;
  hoje: string;
  de: string;
  ateAtestado: string;
}) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const [estado, acao] = useActionState<EstadoPedido, FormData>(fazerPedido, {});
  const [enviando, iniciar] = useTransition();
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.enviado) form.current?.reset();
  }, [estado.enviado]);

  function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const dados = new FormData(evento.currentTarget);
    iniciar(async () => {
      const arquivo = dados.get("arquivo");
      if (arquivo instanceof File && arquivo.size > 0) {
        const pronto = await prepararArquivo(arquivo);
        if (pronto !== arquivo) dados.set("arquivo", pronto, arquivo.name.replace(/\.[^.]*$/, "") + ".jpg");
      }
      acao(dados);
    });
  }

  const botaoAba = (qual: Aba, rotulo: string) => (
    <button
      type="button"
      onClick={() => setAba(qual)}
      className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition ${
        aba === qual ? "bg-white text-marca-700 shadow-sm" : "text-slate-600 hover:text-slate-900"
      }`}
    >
      {rotulo}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1">
        {botaoAba("ATESTADO", "Justificar falta")}
        {botaoAba("CORRECAO", "Corrigir ponto")}
      </div>

      <form ref={form} onSubmit={enviar} className="space-y-4" key={aba}>
        <input type="hidden" name="tipo" value={aba} />
        {aba === "ATESTADO" ? (
          <CamposAtestado diaInicial={diaInicial} de={de} ate={ateAtestado} />
        ) : (
          <CamposCorrecao diaInicial={diaInicial} de={de} hoje={hoje} />
        )}
        <Erro texto={estado.erro} />
        <Ok texto={estado.ok} />
        <button type="submit" disabled={enviando} className={`${estiloBotao} w-full`}>
          {enviando ? "Enviando…" : aba === "ATESTADO" ? "Enviar atestado" : "Pedir correção"}
        </button>
      </form>
    </div>
  );
}

function CamposAtestado({ diaInicial, de, ate }: { diaInicial: string; de: string; ate: string }) {
  const [inicio, setInicio] = useState(diaInicial);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <Campo rotulo="Primeiro dia">
          <input name="de" type="date" min={de} max={ate} required value={inicio} onChange={(e) => setInicio(e.target.value)} className={estiloCampo} />
        </Campo>
        <Campo rotulo="Último dia">
          <input name="ate" type="date" min={inicio || de} max={ate} defaultValue={diaInicial} className={estiloCampo} />
        </Campo>
      </div>
      <Campo rotulo="Atestado" dica="Tire uma foto do atestado ou escolha o PDF. Precisa dar para ler.">
        <input
          name="arquivo"
          type="file"
          accept="image/*,application/pdf"
          required
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-marca-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-marca-700"
        />
      </Campo>
      <Campo rotulo="Observação" dica="Opcional. Por exemplo: consulta médica de manhã.">
        <input name="motivo" maxLength={300} className={estiloCampo} />
      </Campo>
    </>
  );
}

function CamposCorrecao({ diaInicial, de, hoje }: { diaInicial: string; de: string; hoje: string }) {
  const [dia, setDia] = useState(diaInicial > hoje ? hoje : diaInicial);
  const [batidas, setBatidas] = useState<Batida[] | null>(null);
  const [escolhida, setEscolhida] = useState("");
  const [tirar, setTirar] = useState(false);

  useEffect(() => {
    let vivo = true;
    setBatidas(null);
    setEscolhida("");
    setTirar(false);
    if (/^\d{4}-\d{2}-\d{2}$/.test(dia)) batidasDoDia(dia).then((b) => vivo && setBatidas(b));
    return () => {
      vivo = false;
    };
  }, [dia]);

  return (
    <>
      <Campo rotulo="Dia">
        <input name="dia" type="date" min={de} max={hoje} required value={dia} onChange={(e) => setDia(e.target.value)} className={estiloCampo} />
      </Campo>

      <fieldset>
        <legend className="mb-1 block text-sm font-medium text-slate-700">O que está errado?</legend>
        {batidas === null ? (
          <p className="text-sm text-slate-500">Buscando as batidas do dia…</p>
        ) : (
          <div className="space-y-1.5">
            {batidas.map((b) => (
              <label key={b.id} className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <input type="radio" name="marcacaoId" value={b.id} checked={escolhida === b.id} onChange={() => setEscolhida(b.id)} />
                Batida das <b className="tabular-nums">{b.hora}</b>
                {b.manual ? <span className="text-xs text-slate-500">(já corrigida)</span> : null}
              </label>
            ))}
            <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <input type="radio" name="marcacaoId" value="" checked={escolhida === ""} onChange={() => { setEscolhida(""); setTirar(false); }} />
              Esqueci de bater (faltou uma batida)
            </label>
            {batidas.length === 0 ? <p className="text-xs text-slate-500">Nenhuma batida neste dia.</p> : null}
          </div>
        )}
      </fieldset>

      {escolhida ? (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="acao" value="alterar" checked={!tirar} onChange={() => setTirar(false)} />
            Horário errado
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="acao" value="tirar" checked={tirar} onChange={() => setTirar(true)} />
            Bati a mais
          </label>
        </div>
      ) : null}

      {tirar ? null : (
        <div className="space-y-2">
          <Campo rotulo="Horário certo">
            <input name="hora" type="time" required className={estiloCampo} />
          </Campo>
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="diaSeguinte" /> Foi depois da meia-noite (dia seguinte)
          </label>
        </div>
      )}

      <Campo rotulo="O que aconteceu?" dica="Por exemplo: o celular estava sem bateria na saída.">
        <input name="motivo" required minLength={3} maxLength={300} className={estiloCampo} />
      </Campo>
    </>
  );
}

export function CancelarPedido({ id }: { id: string }) {
  const [pendente, iniciar] = useTransition();
  return (
    <button type="button" disabled={pendente} onClick={() => iniciar(() => cancelarPedido(id))} className={estiloBotaoLeve}>
      {pendente ? "Cancelando…" : "Cancelar"}
    </button>
  );
}
