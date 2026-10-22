import { PERGUNTAS_DA_REDACAO, SITUACOES_DO_CURSO, dataBr, duracao, idadeEm, mesAno, tempoNaEmpresa, type Ficha } from "@/lib/ficha";
import { Etiqueta, Painel } from "./ui";

/**
 * A ficha respondida, para ler e imprimir: a mesma ordem do papel, com as
 * contas feitas (idade, tempo em cada empresa) e o que a página mediu na
 * redação.
 */

function Linha({ rotulo, valor }: { rotulo: string; valor: React.ReactNode }) {
  if (valor === "" || valor === null || valor === undefined) return null;
  return (
    <div className="flex gap-2 py-0.5 text-mini">
      <dt className="w-40 shrink-0 text-slate-500">{rotulo}</dt>
      <dd className="min-w-0 flex-1 whitespace-pre-line text-slate-800">{valor}</dd>
    </div>
  );
}

export default function FichaDoCandidato({ ficha, respondidaEm }: { ficha: Ficha; respondidaEm: Date | null }) {
  const p = ficha.pessoal;
  const idade = idadeEm(p.nascimento, respondidaEm ?? new Date());
  const situacao = SITUACOES_DO_CURSO.find((s) => s.valor === ficha.formacao.situacao)?.rotulo ?? "";
  const caracteres = ficha.redacao.qualidades.length + ficha.redacao.expectativas.length;

  return (
    <div className="space-y-3">
      <Painel titulo="A vaga">
        <dl>
          <Linha rotulo="Cargo pretendido" valor={ficha.vaga.cargo} />
          <Linha rotulo="Pretensão salarial" valor={ficha.vaga.pretensao} />
          <Linha rotulo="Pode começar" valor={ficha.vaga.inicio} />
          <Linha rotulo="Horários" valor={ficha.vaga.horarios} />
          <Linha rotulo="Viaja" valor={ficha.vaga.viagens === "SIM" ? "Sim" : ficha.vaga.viagens === "NAO" ? "Não" : ""} />
        </dl>
      </Painel>

      <Painel titulo="Dados pessoais">
        <dl>
          <Linha rotulo="Nome" valor={p.nome} />
          <Linha rotulo="Nascimento" valor={p.nascimento ? `${dataBr(p.nascimento)}${idade !== null ? ` (${idade} anos)` : ""}` : ""} />
          <Linha rotulo="Onde nasceu" valor={p.naturalidade} />
          <Linha rotulo="Endereço" valor={[p.endereco, p.bairro].filter(Boolean).join(", ")} />
          <Linha rotulo="Cidade" valor={[p.cidade, p.cep].filter(Boolean).join(" · CEP ")} />
          <Linha rotulo="Celular" valor={p.celular} />
          <Linha rotulo="E-mail" valor={p.email} />
        </dl>
      </Painel>

      <Painel titulo="Formação">
        <dl>
          <Linha rotulo="Último nível" valor={ficha.formacao.nivel} />
          <Linha rotulo="Curso" valor={ficha.formacao.curso} />
          <Linha rotulo="Situação" valor={[situacao, ficha.formacao.conclusao].filter(Boolean).join(" · ")} />
          <Linha rotulo="Outros cursos" valor={ficha.formacao.outrosCursos} />
          <Linha rotulo="Idiomas" valor={ficha.formacao.idiomas} />
        </dl>
      </Painel>

      <Painel titulo="Experiência">
        {ficha.primeiroEmprego ? (
          <p className="text-mini text-slate-600">Primeiro emprego.</p>
        ) : (
          <ol className="space-y-2.5">
            {ficha.experiencias.map((x, i) => (
              <li key={i} className="break-inside-avoid">
                <p className="text-mini font-medium text-slate-800">
                  {x.cargo} · {x.empresa}
                </p>
                <p className="text-micro text-slate-500">
                  {mesAno(x.entrada)} a {x.saida ? mesAno(x.saida) : "hoje"}
                  {tempoNaEmpresa(x.entrada, x.saida, respondidaEm ?? new Date()) ? ` · ${tempoNaEmpresa(x.entrada, x.saida, respondidaEm ?? new Date())}` : ""}
                </p>
                <dl className="mt-0.5">
                  <Linha rotulo="Salário" valor={x.salario} />
                  <Linha rotulo="Motivo da saída" valor={x.motivoSaida} />
                  <Linha rotulo="Referência" valor={x.contato} />
                </dl>
              </li>
            ))}
          </ol>
        )}
        <dl className="mt-2">
          <Linha rotulo="Trabalho voluntário" valor={ficha.voluntariado} />
          <Linha rotulo="Perfil profissional" valor={ficha.perfilProfissional} />
        </dl>
      </Painel>

      <Painel titulo="Indicação">
        {ficha.indicacao.indicado === "SIM" ? (
          <dl>
            <Linha rotulo="Indicado por" valor={ficha.indicacao.nome} />
            <Linha rotulo="Cargo de quem indicou" valor={ficha.indicacao.cargo} />
            <Linha rotulo="Proximidade" valor={ficha.indicacao.proximidade} />
          </dl>
        ) : (
          <p className="text-mini text-slate-600">Não foi indicado por ninguém da empresa.</p>
        )}
      </Painel>

      <Painel
        titulo="Redação"
        acao={
          <span className="flex flex-wrap gap-1">
            <Etiqueta>{caracteres} caracteres</Etiqueta>
            {ficha.medidas.segundosNaRedacao > 0 ? <Etiqueta>escreveu em {duracao(ficha.medidas.segundosNaRedacao)}</Etiqueta> : null}
            {ficha.medidas.colouNaRedacao ? <Etiqueta tom="atencao">colou texto</Etiqueta> : null}
          </span>
        }
      >
        <div className="space-y-3">
          {(["qualidades", "expectativas"] as const).map((campo, i) => (
            <div key={campo} className="break-inside-avoid">
              <p className="text-mini font-medium text-slate-800">
                {i + 1}. {PERGUNTAS_DA_REDACAO[campo]}
              </p>
              <p className="mt-1 whitespace-pre-line text-mini leading-relaxed text-slate-700">{ficha.redacao[campo]}</p>
            </div>
          ))}
          {ficha.medidas.colouNaRedacao ? (
            <p className="text-micro text-slate-500">
              &ldquo;Colou texto&rdquo; quer dizer que pelo menos um trecho foi colado em vez de digitado. Pode ser só um rascunho feito antes no celular; vale perguntar na entrevista.
            </p>
          ) : null}
        </div>
      </Painel>
    </div>
  );
}
