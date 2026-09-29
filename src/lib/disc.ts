/**
 * O teste DISC do recrutamento, no modelo da consultoria (planilha DISC da
 * Beaconforce).
 *
 * O modelo DISC lê o jeito de agir de uma pessoa em quatro fatores: Dominante,
 * Influente, Estável e Condescendente. São 26 questões com quatro opções (A a
 * D). A pessoa numera as quatro de 1 a 4 — 4 na que MAIS se identifica, 1 na
 * que MENOS —, sem empate. Cada opção pertence a um fator, e a nota soma
 * nesse fator.
 *
 * A letra não indica o fator: a opção A é Dominante numa questão e Estável
 * noutra. A chave de cada opção é o gabarito da consultoria, ao lado do texto.
 * Nas questões 2, 5, 13, 15, 17 e 18 o gabarito repete um fator na mesma
 * questão, e por isso D e S aparecem 28 vezes, e I e C, 24. O percentual de
 * cada fator é medido dentro do que aquele fator pode somar, para a repetição
 * não inflar D e S.
 *
 * É um retrato de comportamento para apoiar a entrevista — não mede
 * inteligência, competência nem caráter, e não deve reprovar ninguém sozinho.
 *
 * Puro: a página pública, a ficha e os testes leem daqui.
 */

export type Fator = "D" | "I" | "S" | "C";

export const FATORES: Fator[] = ["D", "I", "S", "C"];

export type OpcaoDisc = { texto: string; fator: Fator };
export type QuestaoDisc = { enunciado: string; opcoes: OpcaoDisc[] };

export const LETRAS = ["A", "B", "C", "D"];
export const NOTAS = [1, 2, 3, 4];

function questao(enunciado: string, opcoes: [string, Fator][]): QuestaoDisc {
  return { enunciado, opcoes: opcoes.map(([texto, fator]) => ({ texto, fator })) };
}

export const QUESTOES_DISC: QuestaoDisc[] = [
  questao("Em um restaurante. Estou esperando uma mesa e o garçom me diz que em 10 minutos terei uma mesa, porém passam 20 minutos:", [
    ["Me aborreço e digo ao garçom que já se passou o dobro do tempo, e lhe informo que se demorar muito irei embora e eles perderão um cliente.", "D"],
    ["Não me dou conta, pois estou envolvido em uma conversa.", "I"],
    ["Não me fixo ao tempo; ainda que eu saiba do atraso, não falo nada.", "S"],
    ["Informo ao garçom exatamente a hora em que cheguei e o tempo que passou, e peço que por favor me diga com exatidão quanto tempo ainda falta para que eu possa tomar uma decisão.", "C"],
  ]),
  questao("Tenho muita fome e pressa. O garçom me traz um prato que eu não pedi:", [
    ["Digo de maneira direta que este não foi o prato que pedi.", "D"],
    ["Chamo o garçom e converso com ele, explicando que este não era o prato que eu havia pedido.", "I"],
    ["Fico calado e aceito o prato que me trouxeram.", "S"],
    ["Me incomodo e pergunto ao garçom, de forma aborrecida, se ele estava prestando atenção quando fiz meu pedido.", "D"],
  ]),
  questao("Em uma reunião de amigos:", [
    ["Eu gosto de convencer os demais das minhas opiniões e gosto de falar sobre temas relacionados ao meu trabalho.", "D"],
    ["Escuto as pessoas. Elas me procuram, pois sou um excelente ouvinte e escuto com atenção.", "S"],
    ["Falo muito e conto bastante piadas. Geralmente falo mais do que escuto.", "I"],
    ["Observo e analiso as pessoas. Só dou minha opinião quando conheço o tema, e quando o faço sou preciso.", "C"],
  ]),
  questao("Meus companheiros de trabalho me descrevem como alguém:", [
    ["Tranquilo, paciente, amável.", "S"],
    ["Social, alegre, que gosta de conversar.", "I"],
    ["Enérgico, forte, agressivo.", "D"],
    ["Concreto, disciplinado, metódico.", "C"],
  ]),
  questao("Em uma discussão:", [
    ["Trato de dizer que não é para tanto, pois discutir me aborrece.", "S"],
    ["Busco ter a razão e não paro até conseguir. Gosto de discutir.", "D"],
    ["Odeio agressões; concordo com o que está sendo dito para não precisar argumentar.", "S"],
    ["Me baseio nos fatos e busco comprovar meu ponto de vista de forma fundamentada, e espero que os demais ajam assim.", "C"],
  ]),
  questao("O que realmente me emociona na vida:", [
    ["Os desafios, as novidades, arriscar.", "D"],
    ["As surpresas, a diversão, o jogo.", "I"],
    ["A doçura, o carinho, a aceitação.", "S"],
    ["Aprender, a sabedoria, o conhecimento.", "C"],
  ]),
  questao("Se alguém me agride:", [
    ["Fico calado e não demonstro o que sinto.", "S"],
    ["Escapo da situação ou pergunto a outra pessoa se ela é louca.", "I"],
    ["Devolvo a agressão, pois preciso demonstrar minha insatisfação de imediato. Da mesma forma que me incomodo rápido, me tranquilizo rápido.", "D"],
    ["Me angustio, me privo e me resguardo, porém tento descobrir por que isso aconteceu. Demora algum tempo para passar minha insatisfação com o acontecido.", "C"],
  ]),
  questao("Quando vou às compras:", [
    ["Busco ofertas; os descontos me fascinam.", "C"],
    ["Me divirto indo às compras. Gosto de comprar presentes; dizem que sou um comprador compulsivo.", "I"],
    ["Sei o que quero e não gasto meu dinheiro se não encontro. Sou muito definido.", "D"],
    ["Sou indeciso; me dá muito trabalho decidir e escolher.", "S"],
  ]),
  questao("Que frase te descreve melhor:", [
    ["Sou tranquilo e passivo, gosto das pessoas que são fáceis de conviver e que não me agridem. As pessoas me perguntam se eu nunca me aborreço.", "S"],
    ["Sou alegre e jovial. Se vejo alguém triste, procuro levar alegria a essa pessoa. As pessoas me perguntam se eu nunca me deprimo.", "I"],
    ["Sou ativo e enérgico, gosto de fazer várias coisas ao mesmo tempo. As pessoas perguntam se eu não me canso.", "D"],
    ["Sou analítico e observador, gosto de resolver problemas que exijam pensar e de encontrar soluções. As pessoas me dizem que sou muito responsável e apreensivo.", "C"],
  ]),
  questao("Quando estou trabalhando em equipe, sou:", [
    ["O que organiza a parte estratégica, com a finalidade de conseguir maior probabilidade de êxito.", "C"],
    ["O que anima o ambiente, fazendo com que todos tenham vontade.", "I"],
    ["O que manda e organiza.", "D"],
    ["O que apoia, com o propósito de ter uma equipe unida.", "S"],
  ]),
  questao("Meus irmãos e as pessoas que me rodeiam dizem que meus piores defeitos são:", [
    ["Ser teimoso e quadrado.", "C"],
    ["Ser agressivo e temperamental.", "D"],
    ["Ser submisso e lento.", "S"],
    ["Ser distraído e desorganizado.", "I"],
  ]),
  questao("Algumas das minhas qualidades são:", [
    ["Ser determinado e seguro.", "D"],
    ["Ser adaptável e pacífico.", "S"],
    ["Ser otimista e alegre.", "I"],
    ["Ser cumpridor e estável.", "C"],
  ]),
  questao("Estou caminhando e esbarro em algum desconhecido:", [
    ["Dou um passo para o lado e, sem falar, sigo meu caminho.", "S"],
    ["Dou um sorriso e sigo em frente.", "I"],
    ["Espero que a pessoa saia do meu caminho para poder seguir adiante.", "D"],
    ["Peço desculpas e sigo em frente.", "S"],
  ]),
  questao("No trabalho, me sobressaio:", [
    ["Na tomada de decisões rápidas.", "D"],
    ["Nas relações públicas.", "I"],
    ["Na capacidade de me adaptar a equipes.", "S"],
    ["Na segurança de ter qualidade e pontualidade.", "C"],
  ]),
  questao("Meus defeitos no trabalho são:", [
    ["Não gosto de delegar; prefiro trabalhar sozinho.", "D"],
    ["Não gosto que me digam o que fazer.", "D"],
    ["Trabalho melhor sob baixa pressão.", "S"],
    ["Sou desordenado, esquecido e às vezes impontual.", "I"],
  ]),
  questao("Minha mãe diz que, quando criança, eu era:", [
    ["Obediente e tranquilo.", "S"],
    ["Mandão e exigente.", "D"],
    ["Alegre e conversava com todo mundo.", "I"],
    ["Bem arrumado e não gostava de me sujar.", "C"],
  ]),
  questao("Ao me expressar:", [
    ["Falo as coisas de maneira diplomática.", "S"],
    ["Quase não expresso o que sinto.", "C"],
    ["Falo de maneira indireta para não magoar.", "S"],
    ["Falo as coisas como são.", "D"],
  ]),
  questao("A emoção que demonstro com mais frequência é:", [
    ["Medo.", "C"],
    ["Otimismo.", "I"],
    ["Não demonstro emoção.", "C"],
    ["Irritação.", "D"],
  ]),
  questao("Os professores me reconheciam porque eu:", [
    ["Discutia muito e gostava de demonstrar tudo o que sabia.", "D"],
    ["Era bom estudante e bastante analítico.", "C"],
    ["Não interrompia e ficava calado.", "S"],
    ["Era muito amigável e gostava de conversar.", "I"],
  ]),
  questao("Características que mais te descrevem:", [
    ["Autossuficiente e ambicioso.", "D"],
    ["Preciso e exato.", "C"],
    ["Cooperativo e adaptável.", "S"],
    ["Despreocupado e popular.", "I"],
  ]),
  questao("Características que mais te descrevem:", [
    ["Reservado e educado.", "C"],
    ["Amigo e conversador.", "I"],
    ["Tolerante e flexível.", "S"],
    ["Valente e ousado.", "D"],
  ]),
  questao("Características que mais te descrevem:", [
    ["Obstinado, com determinação para me defender.", "D"],
    ["Confiante, acredito nas pessoas.", "I"],
    ["Prudente, gosto de refletir bem sobre as coisas.", "C"],
    ["Pronto a servir, gosto de ajudar os demais.", "S"],
  ]),
  questao("Características que mais te descrevem:", [
    ["Brincalhão, chamo a atenção das pessoas.", "I"],
    ["Empreendedor, com força de vontade.", "D"],
    ["Generoso, me adapto aos demais.", "S"],
    ["Cuidadoso, com cautela ao tomar decisões.", "C"],
  ]),
  questao("Características que mais te descrevem:", [
    ["Calmo, faço o que me pedem.", "S"],
    ["Envolvente, motivo os demais.", "I"],
    ["Atrevido, acredito em mim mesmo.", "D"],
    ["Disciplinado, organizado e limpo.", "C"],
  ]),
  questao("Características que mais te descrevem:", [
    ["Culto, busco ter conhecimento.", "C"],
    ["Animado, a alma da festa.", "I"],
    ["Harmonioso, aberto a sugestões.", "S"],
    ["Confrontador, gosto de argumentar.", "D"],
  ]),
  questao("Características que mais te descrevem:", [
    ["Humilde, compassivo com as pessoas.", "S"],
    ["Carismático, atraio as pessoas, desinibido.", "I"],
    ["Tenho atitude, persuasivo, convincente.", "D"],
    ["Sistemático, cético, precavido.", "C"],
  ]),
];

/** Quantas opções de cada fator o questionário tem: é o que o fator pode somar. */
export const OPCOES_POR_FATOR: Record<Fator, number> = Object.fromEntries(
  FATORES.map((f) => [f, QUESTOES_DISC.reduce((s, q) => s + q.opcoes.filter((o) => o.fator === f).length, 0)]),
) as Record<Fator, number>;

export const INSTRUCOES_DISC = [
  "São 26 questões, cada uma com quatro opções (A, B, C e D).",
  "Numere as quatro opções de 1 a 4: 4 na opção com que você MAIS se identifica e 1 na que MENOS tem a ver com você.",
  "Não pode empatar: em cada questão, cada número (1, 2, 3 e 4) é usado uma vez só.",
  "Não pense muito para responder: o primeiro pensamento que vem à mente é o mais instintivo, livre de filtros.",
  "Leva cerca de quinze minutos.",
];

/** A nota (1 a 4) de cada opção da questão, na ordem A, B, C, D. */
export type RespostaDisc = number[];

export type ResultadoDisc = {
  /** A soma das notas por fator, como na planilha. */
  pontos: Record<Fator, number>;
  /**
   * De 0 (o fator sempre com nota 1) a 100 (sempre com nota 4), dentro das
   * opções que o fator tem — é o que se compara entre os fatores.
   */
  percentuais: Record<Fator, number>;
  principal: Fator;
  secundario: Fator;
  /** "DI", "SC"… */
  perfil: string;
};

/** Mensagem de erro, ou null quando todas as questões foram numeradas direito. */
export function conferirRespostas(respostas: (RespostaDisc | null)[]): string | null {
  if (respostas.length !== QUESTOES_DISC.length) return "Responda todas as questões.";
  for (let i = 0; i < QUESTOES_DISC.length; i++) {
    const r = respostas[i];
    if (!r || r.length !== QUESTOES_DISC[i].opcoes.length || r.some((n) => !Number.isInteger(n))) {
      return `Falta numerar as opções da questão ${i + 1}.`;
    }
    if (r.some((n) => n < 1 || n > 4)) return `Use só os números de 1 a 4 na questão ${i + 1}.`;
    if (new Set(r).size !== r.length) {
      return `Na questão ${i + 1}, cada número (1, 2, 3 e 4) vale uma vez só.`;
    }
  }
  return null;
}

/** Lê as respostas do formulário: campos `q-0-0` (questão 1, opção A), `q-0-1`… */
export function lerFormularioDisc(formData: FormData): (RespostaDisc | null)[] {
  return QUESTOES_DISC.map((q, i) => {
    const notas = q.opcoes.map((_, o) => formData.get(`q-${i}-${o}`));
    if (notas.some((n) => n === null || n === "")) return null;
    return notas.map((n) => Number(n));
  });
}

/** O perfil a partir das respostas já conferidas. */
export function calcularDisc(respostas: RespostaDisc[]): ResultadoDisc {
  const pontos: Record<Fator, number> = { D: 0, I: 0, S: 0, C: 0 };

  respostas.forEach((notas, i) => {
    notas.forEach((nota, o) => {
      pontos[QUESTOES_DISC[i].opcoes[o].fator] += nota;
    });
  });

  const percentuais = Object.fromEntries(
    FATORES.map((f) => {
      const n = OPCOES_POR_FATOR[f];
      return [f, n ? Math.round(((pontos[f] - n) / (3 * n)) * 100) : 0];
    }),
  ) as Record<Fator, number>;

  // Empate decide pelos pontos e depois pela ordem D, I, S, C: a mesma resposta dá sempre o mesmo perfil.
  const ordem = [...FATORES].sort((a, b) => percentuais[b] - percentuais[a] || pontos[b] - pontos[a]);

  return {
    pontos,
    percentuais,
    principal: ordem[0],
    secundario: ordem[1],
    perfil: `${ordem[0]}${ordem[1]}`,
  };
}

/** O resultado gravado, ou null quando o Json não tem o formato esperado. */
export function lerResultadoDisc(valor: unknown): ResultadoDisc | null {
  if (!valor || typeof valor !== "object") return null;
  const v = valor as Partial<ResultadoDisc>;
  if (!v.percentuais || !v.principal || !v.secundario) return null;
  return v as ResultadoDisc;
}

/** A ficha técnica de cada perfil, das abas da planilha. */
export type DescricaoDoFator = {
  nome: string;
  resumo: string;
  /** O que move a pessoa. */
  motivacao: string[];
  necessidade: string;
  caracteristicas: string[];
  pontosFortes: string[];
  pontosDeAtencao: string[];
  /** Como se comunicar com ela. */
  comunicacao: string;
  /** Como ela pode melhorar a comunicação com os demais. */
  comoMelhorar: string[];
  ambiente: string;
  valorNaEquipe: string[];
  sobPressao: string;
  limitacoes: string[];
  medo: string;
  emocao: string;
  carater: string;
};

export const DESCRICOES: Record<Fator, DescricaoDoFator> = {
  D: {
    nome: "Dominante",
    resumo:
      "Direto, impositivo e muito trabalhador. Tem energia alta, segurança de si e opiniões fortes; faz mais de uma coisa por vez e se concentra na meta final.",
    motivacao: ["Poder", "Ter o controle", "Ser o melhor", "Resultados"],
    necessidade: "Controle",
    caracteristicas: ["Aventureiro", "Competitivo", "Ousado", "Decidido", "Direto", "Inovador", "Persistente", "Resolve problemas", "Foco nos resultados", "Com iniciativa"],
    pontosFortes: [
      "Perseverança: adora desafios",
      "Energia: quer abraçar o mundo",
      "Visão: não vê obstáculos insuperáveis",
    ],
    pontosDeAtencao: [
      "Egocêntrico: autoestima alta, pode ser insensível",
      "Explosivo: primeiro reage, depois pensa",
      "Mandão: exige que o que pede seja feito o mais rápido possível",
      "Manipulador: faz o que pode para ter o controle",
      "Impaciente e agressivo",
    ],
    comunicacao:
      "Seja suave e peça com boas maneiras, elogie, espere que se acalme, vá direto ao ponto, mantenha a tranquilidade e pergunte em vez de adivinhar.",
    comoMelhorar: ["Concentrar-se nas pessoas", "Não interromper os outros", "Ter cuidado com o que diz", "Ser humilde", "Evitar chantagens", "Cuidar do tom de voz"],
    ambiente:
      "Livre de controle, supervisão e detalhes; inovador e voltado para o futuro, com debate de ideias, trabalho não rotineiro, desafios e oportunidades.",
    valorNaEquipe: ["Coordenador", "Previdente", "Voltado para o desafio", "Tem iniciativa", "Inovador"],
    sobPressao: "Exigente, nervoso, agressivo e egoísta; explora e se motiva ainda mais para atingir as metas.",
    limitacoes: ["Aproveita-se da posição", "Exigências muito altas", "Falta de tato e diplomacia", "Assume muitas coisas de forma apressada"],
    medo: "De perder o controle",
    emocao: "Coragem",
    carater: "Extrovertido",
  },
  I: {
    nome: "Influente",
    resumo:
      "Confia nos outros, entusiasmado e confiante. É alegre, fala o tempo todo e é amigável; às vezes impontual e distraído.",
    motivacao: ["Diversão", "Popularidade", "Aceitação", "Conexão emocional"],
    necessidade: "Atenção",
    caracteristicas: ["Encantador", "Confidente", "Convincente", "Entusiasta", "Inspirador", "Otimista", "Persuasivo", "Popular", "Sociável", "Confiante"],
    pontosFortes: [
      "Brincalhão e divertido: busca alegria em tudo o que faz",
      "Otimista: vê o lado positivo até das piores situações",
      "Entusiasta: dificilmente se deprime",
      "Despreocupado: acredita que tudo vai dar certo",
      "Efusivo: vibra e comemora as conquistas",
    ],
    pontosDeAtencao: [
      "Esquecido e distraído: falta de concentração",
      "Não termina o que começa: gosta de iniciar projetos e raramente os conclui",
      "Evasivo: hábil em se desvincular de responsabilidades, culpas e erros",
      "Exagerado: transforma relatos em algo extraordinário",
      "Desorganizado",
    ],
    comunicacao:
      "Seja caloroso e pessoal, mostre apreço pelo idealismo e pelo otimismo dele, compartilhe o entusiasmo, tenha paciência, ajude a pôr os pés no chão e peça que defina um rumo.",
    comoMelhorar: ["Falar menos e escutar mais", "Ser o mais claro possível", "Observar a comunicação não verbal dos outros", "Evitar exageros", "Cuidar dos monólogos"],
    ambiente:
      "Contato constante com pessoas, livre de controle e detalhes, com liberdade de movimento, debate para ouvir ideias e um supervisor democrático.",
    valorNaEquipe: ["Otimista e entusiasta", "Criativo, resolve conflitos", "Motiva os demais a alcançar seus objetivos", "Joga em equipe", "Negocia conflitos"],
    sobPressao: "Se autopromove, fica otimista demais, falante e pouco realista; dá desculpas, minimiza problemas e não se responsabiliza.",
    limitacoes: ["Desatento aos detalhes", "Pouco realista ao avaliar as pessoas", "Confia indiscriminadamente nas pessoas", "Nem sempre ouve"],
    medo: "De ser considerado chato e não ser aceito",
    emocao: "Otimismo",
    carater: "Extrovertido",
  },
  S: {
    nome: "Estável",
    resumo:
      "Tranquilo, adaptável e discreto. Evita o confronto, tem dificuldade de dizer não, é detalhista e fala e age com calma.",
    motivacao: ["Aprovação", "Servir aos demais", "Evitar conflitos", "Estabilidade"],
    necessidade: "Paz",
    caracteristicas: ["Amável", "Amigável", "Sabe escutar", "Paciente", "Descontraído", "Sincero", "Estável", "Consciente", "Jogador de equipe", "Compreensivo"],
    pontosFortes: [
      "Fácil de lidar: diz sim a todos e contagia pela paz e estabilidade",
      "Paciente: nada tira sua tranquilidade",
      "Bom ouvinte: deixa as próprias atividades para escutar e não julga",
    ],
    pontosDeAtencao: [
      "Inseguro: tem dificuldade de expor pontos de vista e desejos",
      "Desmotivado: precisa que reafirmem seus feitos e avanços",
      "Acomodado: não assume riscos nem busca novidades",
      "Indeciso: busca sempre apoio para decidir",
    ],
    comunicacao:
      "Mantenha a tranquilidade, use um tom amável, faça perguntas, inspire segurança, use empatia, seja sensível às emoções dele e dê tempo para que decida.",
    comoMelhorar: ["Ser assertivo", "Dizer não", "Não levar as coisas para o lado pessoal", "Expressar as emoções", "Valorizar os próprios comentários"],
    ambiente:
      "Estável e previsível, com mudanças graduais, relações de trabalho duradouras e pouco conflito entre as pessoas.",
    valorNaEquipe: ["Joga em equipe", "Trabalha para um líder e por uma causa", "Paciente e empenhado", "Lógico, analisa", "Orientado para o serviço"],
    sobPressao: "Reservado, despreocupado, indeciso e inflexível; se esconde, trava e quer desaparecer.",
    limitacoes: ["Cede e evita controvérsia", "Dificuldade em estabelecer prioridades", "Não gosta de mudanças repentinas", "Dificuldade para lidar com várias situações ao mesmo tempo"],
    medo: "De confronto, de agressões e, principalmente, de mudanças",
    emocao: "Não demonstra",
    carater: "Introvertido",
  },
  C: {
    nome: "Condescendente",
    resumo:
      "Analítico, dedicado, detalhista e confiável. Fala com fundamento, pensa antes de falar, é direto e claro, e prefere não delegar.",
    motivacao: ["O próprio espaço (independência e privacidade)", "Informação e procedimentos", "Desafios mentais", "Ter a razão", "Reconhecimento e aprovação"],
    necessidade: "Ordem",
    caracteristicas: ["Exato", "Analítico", "Consciente", "Cortês", "Diplomático", "Busca realizações", "Padrões altos", "Maduro", "Paciente", "Preciso"],
    pontosFortes: [
      "Comprometido e leal: os princípios éticos vêm primeiro",
      "Considerado: consulta os envolvidos antes de decidir",
      "Profundo: valoriza a dimensão espiritual da vida",
    ],
    pontosDeAtencao: [
      "Muito exigente: quer tirar dez em tudo o que faz",
      "Apreensivo: leva tudo a sério e vê tudo como crítico",
      "Teimoso: não muda de opinião",
      "Pessimista: sempre vê algo negativo",
      "Perfeccionista: investe muito tempo e energia para tudo sair perfeito",
    ],
    comunicacao:
      "Seja claro, conciso e concreto; se discordar, prove; seja organizado e preciso, use as palavras corretas, dê tempo para pensar, leve-o em consideração e respeite o silêncio dele.",
    comoMelhorar: ["Ser menos literal", "Mostrar interesse ao escutar", "Falar as coisas na hora", "Ser mais aberto"],
    ambiente:
      "Onde é preciso pensamento crítico: cargo técnico ou área especializada, relação próxima com um grupo pequeno e espaço de trabalho reservado.",
    valorNaEquipe: ["Mantém padrões altos", "Consciente e consistente", "Define, esclarece, obtém a informação e a põe à prova", "Objetivo, com os pés na realidade", "Compreensivo, resolve problemas"],
    sobPressao: "Pessimista, difícil de agradar, meticuloso e muito crítico; se fecha, se deprime e se cobra demais.",
    limitacoes: ["Defensivo às críticas", "Apega-se aos detalhes", "Muito intenso em certas situações", "Parece distante e frio"],
    medo: "Do irracional, de errar e de não ser compreendido",
    emocao: "Medo",
    carater: "Introvertido",
  },
};
