import {
  PERGUNTAS_DA_REDACAO,
  SITUACOES_DO_CURSO,
  dataBr,
  duracao,
  filhoPreenchido,
  idadeEm,
  mesAno,
  tempoNaEmpresa,
  type Ficha,
} from "@/lib/ficha";
import { Etiqueta } from "./ui";

/**
 * A ficha de solicitação de emprego, para ler e imprimir: a mesma ordem do
 * papel, só com o que foi preenchido, e as contas feitas (idade, tempo em
 * cada empresa). As medidas da redação (tempo, texto colado) são para a
 * consultoria e ficam fora da impressão.
 */

type Item = { rotulo: string; valor: string; largo?: boolean };

function Bloco({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid overflow-hidden rounded-lg border border-slate-200 bg-white print:rounded-none print:border-slate-300">
      <h3 className="border-b border-slate-200 bg-brand-50 px-3 py-1.5 text-micro font-semibold uppercase tracking-wider text-brand-800 print:border-slate-300">
        {titulo}
      </h3>
      <div className="px-3 py-2">{children}</div>
    </section>
  );
}

/** Rótulo em cima, valor embaixo, em grade: o desenho de um formulário preenchido. */
function Campos({ itens }: { itens: Item[] }) {
  const preenchidos = itens.filter((i) => i.valor.trim() !== "");
  if (preenchidos.length === 0) return null;
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 print:grid-cols-3">
      {preenchidos.map((i) => (
        <div key={i.rotulo} className={i.largo ? "col-span-2 sm:col-span-3 print:col-span-3" : ""}>
          <dt className="text-micro text-slate-500">{i.rotulo}</dt>
          <dd className="whitespace-pre-line text-mini text-slate-900">{i.valor}</dd>
        </div>
      ))}
    </dl>
  );
}

const temAlgo = (itens: Item[]) => itens.some((i) => i.valor.trim() !== "");

export default function FichaDoCandidato({ ficha, respondidaEm }: { ficha: Ficha; respondidaEm: Date | null }) {
  const p = ficha.pessoal;
  const quando = respondidaEm ?? new Date();
  const idade = idadeEm(p.nascimento, quando);
  const situacao = SITUACOES_DO_CURSO.find((s) => s.valor === ficha.formacao.situacao)?.rotulo ?? "";
  const filhos = ficha.familia.filhos.filter(filhoPreenchido);
  const experiencias = ficha.experiencias;
  const redacao = (["qualidades", "expectativas"] as const).filter((c) => ficha.redacao[c].trim() !== "");
  const caracteres = ficha.redacao.qualidades.length + ficha.redacao.expectativas.length;

  const vaga: Item[] = [
    { rotulo: "Cargo pretendido", valor: ficha.vaga.cargo },
    { rotulo: "Pretensão salarial", valor: ficha.vaga.pretensao },
    { rotulo: "Pode começar", valor: ficha.vaga.inicio },
    { rotulo: "Horários", valor: ficha.vaga.horarios },
    { rotulo: "Disponível para viajar", valor: ficha.vaga.viagens === "SIM" ? "Sim" : ficha.vaga.viagens === "NAO" ? "Não" : "" },
  ];
  const pessoais: Item[] = [
    { rotulo: "Nome", valor: p.nome, largo: true },
    { rotulo: "Data de nascimento", valor: p.nascimento ? `${dataBr(p.nascimento)}${idade !== null ? ` (${idade} anos)` : ""}` : "" },
    { rotulo: "Onde nasceu", valor: p.naturalidade },
    { rotulo: "Sexo", valor: p.sexo },
    { rotulo: "Estado civil", valor: p.estadoCivil },
    { rotulo: "Com quem mora", valor: p.comQuemMora },
    { rotulo: "Endereço", valor: [p.endereco, p.bairro].filter(Boolean).join(", "), largo: true },
    { rotulo: "Cidade", valor: p.cidade },
    { rotulo: "CEP", valor: p.cep },
    { rotulo: "Celular", valor: p.celular },
    { rotulo: "E-mail", valor: p.email },
  ];
  const documentos: Item[] = [
    { rotulo: "Identidade", valor: ficha.documentos.rg },
    { rotulo: "Órgão expedidor", valor: ficha.documentos.orgao },
    { rotulo: "CPF", valor: ficha.documentos.cpf },
  ];
  const familia: Item[] = (
    [
      ["pai", "Pai"],
      ["mae", "Mãe"],
      ["conjuge", "Cônjuge"],
    ] as const
  ).flatMap(([quem, rotulo]) => [
    { rotulo: `Nome ${rotulo === "Mãe" ? "da" : "do"} ${rotulo.toLowerCase()}`, valor: ficha.familia[quem].nome, largo: false },
    { rotulo: "Profissão", valor: ficha.familia[quem].nome || ficha.familia[quem].profissao ? ficha.familia[quem].profissao || "—" : "" },
  ]);
  const formacao: Item[] = [
    { rotulo: "Último nível", valor: ficha.formacao.nivel },
    { rotulo: "Curso", valor: ficha.formacao.curso, largo: !ficha.formacao.nivel },
    { rotulo: "Situação", valor: [situacao, ficha.formacao.conclusao].filter(Boolean).join(" · ") },
    { rotulo: "Outros cursos realizados", valor: ficha.formacao.outrosCursos, largo: true },
    { rotulo: "Idiomas", valor: ficha.formacao.idiomas, largo: true },
  ];
  const outros: Item[] = [
    { rotulo: "Trabalho voluntário", valor: ficha.voluntariado, largo: true },
    { rotulo: "Perfil profissional", valor: ficha.perfilProfissional },
    { rotulo: "Redes sociais", valor: ficha.redes.quais },
    { rotulo: "Nome nas redes", valor: ficha.redes.nome },
  ];
  const indicacao: Item[] =
    ficha.indicacao.indicado === "SIM"
      ? [
          { rotulo: "Indicado por", valor: ficha.indicacao.nome },
          { rotulo: "Cargo de quem indicou", valor: ficha.indicacao.cargo },
          { rotulo: "Grau de proximidade", valor: ficha.indicacao.proximidade },
        ]
      : ficha.indicacao.indicado === "NAO"
        ? [{ rotulo: "Indicado por alguém da empresa", valor: "Não" }]
        : [];

  return (
    <div className="space-y-2.5">
      {temAlgo(vaga) ? (
        <Bloco titulo="A vaga">
          <Campos itens={vaga} />
        </Bloco>
      ) : null}

      <Bloco titulo="Dados pessoais">
        <Campos itens={pessoais} />
      </Bloco>

      {temAlgo(documentos) ? (
        <Bloco titulo="Documentos pessoais">
          <Campos itens={documentos} />
        </Bloco>
      ) : null}

      {temAlgo(familia) || filhos.length > 0 ? (
        <Bloco titulo="Dados familiares">
          <div className="space-y-2.5">
            {temAlgo(familia) ? (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                {familia
                  .filter((i) => i.valor.trim() !== "")
                  .map((i, k) => (
                    <div key={k}>
                      <dt className="text-micro text-slate-500">{i.rotulo}</dt>
                      <dd className="text-mini text-slate-900">{i.valor}</dd>
                    </div>
                  ))}
              </dl>
            ) : null}
            {filhos.length > 0 ? (
              <table className="w-full text-left text-mini">
                <thead>
                  <tr className="border-b border-slate-200 text-micro text-slate-500">
                    <th className="py-1 font-normal">Filhos</th>
                    <th className="py-1 font-normal">Idade</th>
                    <th className="py-1 font-normal">Data de nascimento</th>
                  </tr>
                </thead>
                <tbody>
                  {filhos.map((f, i) => {
                    const anos = f.nascimento ? idadeEm(f.nascimento, quando) : null;
                    return (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-1 text-slate-900">{f.nome || "—"}</td>
                        <td className="py-1 text-slate-900">{f.idade || (anos !== null ? `${anos} anos` : "—")}</td>
                        <td className="py-1 text-slate-900">{f.nascimento ? dataBr(f.nascimento) : "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <p className="text-mini text-slate-600">Sem filhos informados.</p>
            )}
          </div>
        </Bloco>
      ) : null}

      {temAlgo(formacao) ? (
        <Bloco titulo="Situação educacional">
          <Campos itens={formacao} />
        </Bloco>
      ) : null}

      <Bloco titulo="Situação profissional">
        {ficha.primeiroEmprego || experiencias.length === 0 ? (
          <p className="text-mini text-slate-700">{ficha.primeiroEmprego ? "Primeiro emprego." : "Nenhuma experiência informada."}</p>
        ) : (
          <ol className="divide-y divide-slate-100">
            {experiencias.map((x, i) => {
              const tempo = tempoNaEmpresa(x.entrada, x.saida, quando);
              const periodo = x.entrada ? `${mesAno(x.entrada)} a ${x.saida ? mesAno(x.saida) : "atual"}${tempo ? ` (${tempo})` : ""}` : x.saida ? `até ${mesAno(x.saida)}` : "";
              return (
                <li key={i} className="break-inside-avoid py-2 first:pt-0 last:pb-0">
                  <p className="text-mini font-semibold text-slate-900">
                    {x.empresa}
                    {x.cargo ? <span className="font-normal text-slate-700"> · {x.cargo}</span> : null}
                  </p>
                  <div className="mt-1">
                    <Campos
                      itens={[
                        { rotulo: "Período", valor: periodo },
                        { rotulo: "Salário", valor: x.salario },
                        { rotulo: "Contato", valor: x.contato },
                        { rotulo: "Motivo da saída", valor: x.motivoSaida, largo: true },
                      ]}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Bloco>

      {temAlgo(outros) ? (
        <Bloco titulo="Voluntariado e redes sociais">
          <Campos itens={outros} />
        </Bloco>
      ) : null}

      {indicacao.length > 0 ? (
        <Bloco titulo="Indicação">
          <Campos itens={indicacao} />
        </Bloco>
      ) : null}

      {redacao.length > 0 ? (
        <Bloco titulo="Redação">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1 print:hidden">
              {ficha.origem === "PAPEL" ? <Etiqueta>escrita à mão, no papel</Etiqueta> : <Etiqueta>{caracteres} caracteres</Etiqueta>}
              {ficha.medidas.segundosNaRedacao > 0 ? <Etiqueta>escreveu em {duracao(ficha.medidas.segundosNaRedacao)}</Etiqueta> : null}
              {ficha.medidas.colouNaRedacao ? <Etiqueta tom="atencao">colou texto</Etiqueta> : null}
            </div>
            {redacao.map((campo) => (
              <div key={campo} className="break-inside-avoid">
                <p className="text-micro font-medium text-slate-500">{PERGUNTAS_DA_REDACAO[campo]}</p>
                <p className="mt-0.5 whitespace-pre-line text-mini leading-relaxed text-slate-900">{ficha.redacao[campo]}</p>
              </div>
            ))}
            {ficha.medidas.colouNaRedacao ? (
              <p className="text-micro text-slate-500 print:hidden">
                &ldquo;Colou texto&rdquo; quer dizer que pelo menos um trecho foi colado em vez de digitado. Pode ser só um rascunho feito antes no celular; vale perguntar na entrevista.
              </p>
            ) : null}
          </div>
        </Bloco>
      ) : null}
    </div>
  );
}
