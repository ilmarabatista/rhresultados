/**
 * A biblioteca inicial da pesquisa de clima: as dimensões e as perguntas que
 * entram no banco quando se aperta "Carregar a biblioteca inicial".
 *
 * Escrita com palavras próprias do RH Resultados. Depois de carregada, a
 * biblioteca é editada pela tela, e este arquivo não é mais lido.
 *
 * Toda pergunta de nota é escrita para que nota alta seja bom. As marcadas com
 * `padrao` formam a primeira pesquisa de uma empresa; as outras ficam à mão
 * para quem quiser acrescentar.
 */

import type { TipoDePergunta } from "./clima";

export type PerguntaInicial = {
  enunciado: string;
  tipo?: TipoDePergunta;
  opcoes?: string[];
  maxEscolhas?: number;
  enps?: boolean;
  padrao?: boolean;
};

export type DimensaoInicial = { nome: string; descricao: string; perguntas: PerguntaInicial[] };

export const BIBLIOTECA_INICIAL: DimensaoInicial[] = [
  {
    nome: "Trabalho realizado",
    descricao: "Como a pessoa vive o próprio trabalho: autonomia, volume, qualidade, saúde e segurança.",
    perguntas: [
      { enunciado: "O quanto você tem autonomia para organizar e fazer o seu trabalho?", padrao: true },
      { enunciado: "O quanto você sente que o seu trabalho contribui para os resultados da empresa?", padrao: true },
      { enunciado: "O quanto o volume de trabalho que você recebe é adequado ao seu tempo e à sua função?", padrao: true },
      { enunciado: "O quanto a empresa valoriza a qualidade do trabalho, e não só a rapidez?", padrao: true },
      { enunciado: "O quanto o seu trabalho é feito sem prejudicar a sua saúde física e mental?", padrao: true },
      { enunciado: "O quanto os equipamentos e as práticas de segurança protegem você no dia a dia?", padrao: true },
      { enunciado: "O quanto a direção da empresa se empenha em melhorar a segurança no trabalho?" },
      { enunciado: "O quanto os procedimentos da sua função são claros e fáceis de seguir?" },
      { enunciado: "O quanto o trabalho é dividido de forma justa entre as pessoas da sua área?" },
      { enunciado: "O quanto você consegue equilibrar o trabalho e a vida pessoal?" },
    ],
  },
  {
    nome: "Comunicação",
    descricao: "Se as pessoas ficam sabendo do que importa, conversam bem entre as áreas e têm espaço para falar.",
    perguntas: [
      { enunciado: "O quanto você conhece as metas e as prioridades da empresa?", padrao: true },
      { enunciado: "O quanto é fácil conversar e trocar informações com as outras áreas?", padrao: true },
      { enunciado: "O quanto você se sente à vontade para dizer o que pensa sobre a empresa?", padrao: true },
      { enunciado: "O quanto você fica sabendo, a tempo, do que acontece na empresa?" },
      { enunciado: "O quanto a empresa explica as decisões que afetam o seu trabalho?" },
      {
        enunciado: "Por onde você mais recebe as informações da empresa?",
        tipo: "ESCOLHA",
        opcoes: ["Meu gestor direto", "RH", "Colegas", "Mural ou quadro de avisos", "Grupos de mensagem", "E-mail", "Reuniões"],
      },
    ],
  },
  {
    nome: "Remuneração e benefícios",
    descricao: "A satisfação com o salário e os benefícios, e a clareza sobre como eles funcionam.",
    perguntas: [
      { enunciado: "O quanto você está satisfeito com o seu salário?", padrao: true },
      { enunciado: "O quanto a empresa explica com clareza como funcionam os reajustes e aumentos?", padrao: true },
      { enunciado: "O quanto os benefícios oferecidos atendem às suas necessidades?", padrao: true },
      { enunciado: "O quanto o seu salário é justo pelo trabalho que você faz?" },
      { enunciado: "O quanto o seu salário é justo comparado ao de colegas com função parecida?" },
      { enunciado: "O quanto você entende os descontos do seu holerite?" },
      { enunciado: "O quanto os benefícios da empresa estão de acordo com o que o mercado oferece?" },
    ],
  },
  {
    nome: "Liderança",
    descricao: "Como o gestor direto orienta, ouve, dá retorno e cuida da equipe.",
    perguntas: [
      { enunciado: "O quanto você avalia bem a liderança do seu gestor direto?", padrao: true },
      { enunciado: "O quanto o seu gestor direto ouve e considera as suas críticas e sugestões?", padrao: true },
      { enunciado: "O quanto o seu gestor direto conversa com você sobre o seu desempenho?", padrao: true },
      { enunciado: "O quanto as orientações do seu gestor são claras?" },
      { enunciado: "O quanto você se sente respeitado pelo seu gestor?" },
      { enunciado: "O quanto você confia nas decisões do seu gestor?" },
      { enunciado: "O quanto o seu gestor está disponível quando você precisa?" },
      { enunciado: "O quanto o ritmo de trabalho cobrado pelo seu gestor é razoável?" },
      { enunciado: "O quanto o seu gestor incentiva o trabalho em equipe?" },
      { enunciado: "O quanto o seu gestor se preocupa com o bem-estar da equipe?" },
    ],
  },
  {
    nome: "Treinamento e desenvolvimento",
    descricao: "As oportunidades de aprender e se desenvolver, e se os treinamentos servem ao trabalho.",
    perguntas: [
      { enunciado: "O quanto a empresa oferece oportunidades para você se desenvolver?", padrao: true },
      { enunciado: "O quanto os treinamentos que você recebe são suficientes para fazer bem o seu trabalho?", padrao: true },
      { enunciado: "O quanto os treinamentos oferecidos atendem ao que a sua área mais precisa?", padrao: true },
      { enunciado: "O quanto o seu gestor apoia que você participe de treinamentos?" },
      { enunciado: "O quanto o que você aprende nos treinamentos faz diferença no seu dia a dia?" },
    ],
  },
  {
    nome: "Condições físicas de trabalho",
    descricao: "O conforto, a limpeza e os recursos do lugar onde se trabalha.",
    perguntas: [
      { enunciado: "O quanto o seu local de trabalho é confortável (temperatura, espaço, móveis, banheiros)?", padrao: true },
      { enunciado: "O quanto o seu local de trabalho é limpo e organizado?", padrao: true },
      { enunciado: "O quanto você tem as ferramentas e os recursos necessários para trabalhar?" },
    ],
  },
  {
    nome: "Carreira",
    descricao: "Se as pessoas veem futuro na empresa e se sentem prontas para crescer.",
    perguntas: [
      { enunciado: "O quanto você se sente preparado para assumir novas responsabilidades?", padrao: true },
      { enunciado: "O quanto você acredita que pode crescer profissionalmente nesta empresa?", padrao: true },
      { enunciado: "O quanto os critérios para promoção são claros?" },
    ],
  },
  {
    nome: "Reconhecimento e valorização",
    descricao: "O quanto a empresa valoriza, reconhece e aproveita as pessoas.",
    perguntas: [
      { enunciado: "O quanto você se sente valorizado pela empresa?", padrao: true },
      { enunciado: "O quanto a empresa aproveita bem o seu potencial?", padrao: true },
      { enunciado: "O quanto você é reconhecido quando faz um bom trabalho?", padrao: true },
    ],
  },
  {
    nome: "Satisfação e realização",
    descricao: "A satisfação com o trabalho, o cargo e a empresa como um todo.",
    perguntas: [
      { enunciado: "O quanto você está satisfeito com o trabalho que faz?", padrao: true },
      { enunciado: "O quanto o seu trabalho lhe traz sensação de realização?", padrao: true },
      { enunciado: "Considerando tudo o que a empresa oferece, o quanto você está satisfeito em trabalhar aqui?", padrao: true },
      { enunciado: "O quanto você está satisfeito com o seu horário de trabalho?" },
      { enunciado: "O quanto você está satisfeito com o seu cargo atual?" },
    ],
  },
  {
    nome: "Imagem da empresa",
    descricao: "Como as pessoas veem a empresa: lugar para trabalhar, propósito, ética e se a indicariam.",
    perguntas: [
      { enunciado: "O quanto você considera a empresa um ótimo lugar para trabalhar?", padrao: true },
      { enunciado: "O quanto você entende a missão, a visão e os valores da empresa?", padrao: true },
      {
        enunciado: "De 0 a 10, o quanto você recomendaria esta empresa para um amigo ou parente trabalhar?",
        enps: true,
        padrao: true,
      },
      { enunciado: "O quanto a empresa age com ética com colaboradores e clientes?" },
      { enunciado: "O quanto a empresa cumpre o que promete aos colaboradores?" },
    ],
  },
  {
    nome: "Trabalho em equipe",
    descricao: "A cooperação, a abertura e o clima dentro da equipe.",
    perguntas: [
      { enunciado: "O quanto as pessoas da sua equipe cooperam entre si?" },
      { enunciado: "O quanto a sua equipe está aberta a ouvir opiniões diferentes?" },
      { enunciado: "O quanto o clima da sua equipe é positivo?" },
      { enunciado: "O quanto a sua equipe está motivada?" },
      { enunciado: "O quanto a sua equipe está preparada para lidar com imprevistos?" },
      { enunciado: "O quanto você está satisfeito com a qualidade do trabalho da sua equipe?" },
    ],
  },
  {
    nome: "Integração entre áreas",
    descricao: "Se as áreas da empresa cooperam e resolvem bem os conflitos.",
    perguntas: [
      { enunciado: "O quanto as áreas da empresa cooperam entre si?" },
      { enunciado: "O quanto os conflitos entre áreas são resolvidos com respeito?" },
    ],
  },
  {
    nome: "Estabilidade",
    descricao: "A segurança que as pessoas sentem no emprego.",
    perguntas: [{ enunciado: "O quanto você se sente seguro no seu emprego?" }],
  },
  {
    nome: "Inovação e qualidade",
    descricao: "Se a empresa melhora o que faz e acompanha o seu tempo.",
    perguntas: [
      { enunciado: "O quanto a empresa busca melhorar os seus produtos, serviços e processos?" },
      { enunciado: "O quanto o compromisso com a qualidade aparece no dia a dia?" },
      { enunciado: "O quanto a empresa está atualizada em tecnologia e em formas de trabalhar?" },
    ],
  },
  {
    nome: "Eventos e comemorações",
    descricao: "A opinião sobre as festas, comemorações e ações internas da empresa.",
    perguntas: [
      { enunciado: "O quanto você gosta dos eventos e das comemorações da empresa?" },
      {
        enunciado: "Quais comemorações você mais gosta?",
        tipo: "MULTIPLA",
        maxEscolhas: 2,
        opcoes: ["Aniversariantes do mês", "Aniversário da empresa", "Festa junina", "Dia das crianças", "Festa de fim de ano", "Passeios e excursões"],
      },
      {
        enunciado: "Você prefere as comemorações:",
        tipo: "ESCOLHA",
        opcoes: ["Só com os colaboradores", "Com um acompanhante", "Com a família"],
      },
    ],
  },
  {
    nome: "Alimentação",
    descricao: "Para empresas com refeitório: a comida, o espaço e o horário.",
    perguntas: [
      { enunciado: "O quanto você está satisfeito com a qualidade das refeições?" },
      { enunciado: "O quanto você está satisfeito com a limpeza e a estrutura do refeitório?" },
      { enunciado: "O quanto o horário das refeições é adequado?" },
    ],
  },
  {
    nome: "Motivação",
    descricao: "O que mais motiva e o que mais desmotiva as pessoas hoje.",
    perguntas: [
      {
        enunciado: "O que mais motiva você no trabalho hoje?",
        tipo: "MULTIPLA",
        maxEscolhas: 3,
        padrao: true,
        opcoes: [
          "Salário",
          "Benefícios",
          "Estabilidade",
          "Relação com o gestor",
          "O trabalho que faço",
          "Ambiente e colegas",
          "Reconhecimento",
          "Autonomia",
          "Treinamentos",
          "Chance de crescer",
          "Propósito e valores da empresa",
        ],
      },
      {
        enunciado: "O que mais desmotiva você no trabalho hoje?",
        tipo: "MULTIPLA",
        maxEscolhas: 3,
        padrao: true,
        opcoes: [
          "Salário",
          "Falta de reconhecimento",
          "Falta de segurança",
          "Pouca chance de crescer",
          "Falta de autonomia",
          "Ambiente ruim",
          "O trabalho que faço",
          "Relação com o gestor",
          "Falta de treinamento",
          "Excesso de trabalho",
          "Estrutura e instalações",
          "Nada me desmotiva hoje",
        ],
      },
      {
        enunciado: "Comparando com quando você entrou, a empresa hoje está:",
        tipo: "ESCOLHA",
        opcoes: ["Melhor", "Igual", "Pior"],
      },
    ],
  },
  {
    nome: "Sugestões",
    descricao: "O espaço aberto para quem respondeu dizer o que mudaria.",
    perguntas: [{ enunciado: "O que tornaria a empresa um lugar melhor para trabalhar?", tipo: "TEXTO", padrao: true }],
  },
];
