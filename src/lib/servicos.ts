/**
 * O catálogo inicial de produtos da consultoria.
 *
 * Só é lido na primeira instalação (npm run db:servicos). No dia a dia o
 * catálogo é editado em Configurações: criar, renomear, descrever, desativar.
 */

export type Servico = {
  slug: string;
  nome: string;
  /** O que fazemos pela empresa, em poucas linhas. */
  descricao: string;
};

export const SERVICOS: Servico[] = [
  {
    slug: "diagnostico-geral",
    nome: "Diagnóstico geral da empresa",
    descricao:
      "Leitura inicial da empresa cliente. Costuma ser o primeiro serviço e é o que revela quais outros serão necessários.",
  },
  {
    slug: "avaliacao-desempenho",
    nome: "Avaliação de desempenho",
    descricao:
      "Ciclo completo de avaliação, do desenho do instrumento à devolutiva ao colaborador.",
  },
  {
    slug: "treinamento",
    nome: "Treinamento",
    descricao:
      "Serviço que nasce, em geral, de um gap apontado pela avaliação de desempenho.",
  },
  {
    slug: "recrutamento-selecao",
    nome: "Recrutamento e seleção",
    descricao:
      "Da abertura da vaga com o gestor até a integração do novo colaborador.",
  },
  {
    slug: "analise-clima",
    nome: "Pesquisa de clima e cultura",
    descricao:
      "Pesquisa de clima aplicada por questionário, com devolutiva à diretoria.",
  },
  {
    slug: "fortalecimento-cultura",
    nome: "Encontros de fortalecimento da cultura",
    descricao:
      "Encontros com a equipe para tirar a cultura do quadro na parede e levá-la ao dia a dia: o que a empresa valoriza, e como isso aparece no trabalho.",
  },
  {
    slug: "desenvolvimento-tecnico-setor",
    nome: "Desenvolvimento técnico por setor",
    descricao:
      "Encontros por setor para desenvolver a técnica de quem executa. Cada setor tem a sua dificuldade, e o conteúdo é montado a partir dela.",
  },
  {
    slug: "habilidades-comunicacao",
    nome: "Desenvolvimento de habilidades de comunicação (PNL)",
    descricao:
      "Trabalho de comunicação e influência com liderança e equipe, usando ferramentas de PNL. O foco é o resultado no atendimento e na condução de conversas difíceis.",
  },
  {
    slug: "reuniao-de-nps",
    nome: "Reunião de NPS",
    descricao:
      "O que o cliente respondeu, lido com a equipe: quantos promovem, quantos detratam e o que muda até a próxima rodada. Sem a reunião, o número fica no relatório e não vira mudança.",
  },
  {
    slug: "ciclo-feedback",
    nome: "Ciclo de feedback com a equipe técnica",
    descricao:
      "Feedback estruturado e periódico: o que está bom, o que precisa mudar e o que a pessoa pode esperar. Feito com roteiro, para não virar conversa solta.",
  },
  {
    slug: "indicadores-resultados",
    nome: "Análise de indicadores e resultados",
    descricao:
      "Os números do RH lidos junto com a diretoria: rotatividade, faltas, afastamentos e o que eles custam. É o que transforma percepção em decisão.",
  },
  {
    slug: "pdi",
    nome: "Plano de Desenvolvimento Individual (PDI)",
    descricao:
      "O caminho de desenvolvimento de cada pessoa: onde está, onde precisa chegar e o que vai fazer para isso. Acompanhado até o fim.",
  },
  {
    slug: "endomarketing",
    nome: "Endomarketing e comunicação interna",
    descricao:
      "A empresa comunicando bem com quem está dentro: campanhas, murais, avisos e o calendário do ano. Sem isso, a equipe sabe da novidade pelo corredor.",
  },
  {
    slug: "celebracoes",
    nome: "Programa de celebrações e datas",
    descricao:
      "Aniversários, tempo de casa e datas do ano organizados num calendário, com o que fazer em cada um. É barato e é o que a equipe lembra.",
  },
];
