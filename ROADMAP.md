# Roadmap

Lista viva do que falta no sistema, separada por urgência. A cada nova ideia,
o item entra aqui primeiro — implementamos aos poucos, na ordem que você
decidir.

**Legenda de tamanho:** P = poucas horas · M = um dia · G = vários dias.

> **Recorte atual:** o sistema acompanha a execução dos serviços
> contratados. Tarefas avulsas, metas, objetivos e projetos foram removidos.
> A agenda voltou, mas com outro papel: marca **quando você está no cliente**,
> não prazo de tarefa — a etapa continua sem data. A IA atua em papéis
> restritos (transcrição de reunião, calendário de cultura, análise de cargo),
> sempre com revisão na tela antes de gravar. A partir de agora o sistema
> ganha um segundo lado, ainda em esqueleto: o de **marketing e comercial** da
> própria consultoria, que termina onde o lado de clientes começa — no lead
> que vira empresa.

---

## Crítico — impede o uso real

| # | Item | Por quê | Tam. |
|---|---|---|---|
| C6 | **Ficha do colaborador não tem controle de acesso** | Qualquer usuário do sistema vê a ficha completa de qualquer colaborador do cliente, incluindo advertências, atestados e o resultado dos exames ocupacionais. Precisa de permissão por empresa e, para os registros sensíveis, por papel. | M |
| C7 | **Sem registro de quem consultou dado sensível** | O fluxo de atividades grava quem *escreveu*, não quem *leu*. Para advertências e atestados, saber quem consultou é parte do dever de cuidado com o dado. | M |
| C1 | **Colocar em produção** (Vercel + banco hospedado) | Hoje o sistema só existe nesta máquina. Se o computador desligar, ninguém acessa. Precisa de conta Vercel e de um Postgres (Neon/Supabase). O deploy tem que rodar `npm run db:deploy` para aplicar as migrations. | M |

---

## Alta — falta para o dia a dia funcionar

Nada pendente. Os itens desta faixa foram entregues.

---

## Média — ganho grande, não bloqueia

| # | Item | Por quê | Tam. |
|---|---|---|---|
| M4 | **Comentários na etapa** | A observação é um campo único que cada edição sobrescreve. Um histórico com autor e data preservaria o que foi combinado ao longo do serviço. | M |
| M17 | **Responsável citado na reunião não é atribuído** | A IA identifica quem ficou de fazer e mostra o nome na revisão, mas a atribuição é manual depois, na Evolução. Casar o nome citado com o usuário do sistema fecharia o ciclo. | M |
| M18 | **Transcrição longa é cortada em 60 mil caracteres** | Reuniões longas perdem o trecho final, onde costumam estar os encaminhamentos. O caminho é quebrar em partes e juntar as ações. | M |
| M19 | **Anexar o documento do atestado, da advertência e do ASO** | Hoje só o registro em texto existe. O documento assinado costuma ser exigido em fiscalização, e o ASO do exame ocupacional entra na mesma conta. Depende de M5 (armazenamento de arquivos). | M |
| M36 | **Periódico não é aberto sozinho quando o ASO vence** | O sistema guarda a validade do ASO, mas ninguém é avisado no vencimento nem a tarefa do próximo periódico nasce sozinha. É o passo que fecha o ciclo do exame. | M |
| M39 | **Exame só existe para quem já tem ficha** | O exame ocupacional agora vive dentro da ficha do colaborador. O admissional de quem ainda é candidato exige cadastrar a pessoa antes — um status “candidato” na equipe resolveria. | M |
| M38 | **Admissional sem ficha não vira colaborador** | Quando o exame é de alguém ainda sem ficha, contratar exige cadastrar a pessoa à mão e refazer o vínculo. Um botão “virou colaborador” resolveria, como o de lead ganho vira empresa. | P |
| M20 | **Retenção e descarte de dado de colaborador** | Não há prazo nem rotina para apagar ficha de quem foi desligado. Definir por quanto tempo cada tipo de registro fica. | M |
| M21 | **Colaborador responder a autoavaliação sozinho** | Hoje o formulário fica na ficha, dentro do sistema — quem digita é a consultoria, com a pessoa junto. Um link de acesso único deixaria a pessoa responder antes da conversa. | G |
| M22 | **Calendário de cultura só existe na tela** | Não sai em PDF nem entra no relatório do cliente. É material de apresentação: deveria ser imprimível como o relatório. | P |
| M23 | **Calendário não vira ações no escopo** | Os doze temas ficam como conteúdo. Transformar cada mês em etapas de um serviço faria a execução aparecer na Evolução, como acontece com as reuniões. | M |
| M24 | **Análise de cargo não vira descrição em lote** | Cada cargo é gerado um a um. Empresas com muitos cargos repetidos (mesmo cargo em várias filiais) ganhariam com aproveitar uma descrição pronta como base. | M |
| M25 | **PDF digitalizado de análise de cargo não é lido** | A extração só funciona em PDF com camada de texto. Questionário respondido à mão e fotografado precisa de OCR, ou de digitação na tela. | M |
| M33 | **Importação em lote limitada a 10 arquivos** | Cada arquivo é uma chamada de IA e o lote precisa caber no tempo da requisição. Empresa com 60 cargos importa em seis tandas. Uma fila em segundo plano resolveria. | G |
| M34 | **Trocar o tipo na revisão não relê o arquivo** | O seletor muda o tipo gravado, mas as respostas já foram extraídas com o mapa de campos do tipo anterior. Campos da Parte B do tipo novo ficam vazios até alguém preencher na tela. | M |
| M35 | **Reconhecimento do cargo é por lista de palavras** | Cobre os cargos comuns no Brasil, mas cargo com nome incomum ou em inglês cai no aviso “tipo não reconhecido”. A lista está em `src/lib/questionarios-cargo.ts` e cresce conforme o uso. | P |
| M26 | **Link do questionário não avisa quando é respondido** | A resposta chega e fica esperando alguém abrir a aba. Um aviso por e-mail fecharia o ciclo — depende de envio de e-mail, que o sistema ainda não tem. | M |
| M27 | **Agenda não avisa conflito de horário** | Dá para marcar dois clientes no mesmo horário sem aviso. Na vista de semana os dois aparecem lado a lado, o que deixa o choque visível, mas não há alerta ao salvar. | P |
| M30 | **Faixa da semana fixa em 08h–22h** | A faixa é constante no código. Quem atende fora disso vê o compromisso na tira “fora do horário” em vez da grade. Deveria vir das Configurações. | P |
| M31 | **Agenda não tem vista de dia** | Semana e mês atendem o uso normal, mas um dia cheio numa empresa só fica apertado numa coluna estreita. | M |
| M32 | **Agendamento rápido só marca hora cheia** | Clicar numa hora da semana marca aquela hora inteira. Meia hora, ou arrastar para esticar o bloco, exige abrir o formulário. | M |
| M29 | **Agenda não exporta para o celular** | Não há arquivo `.ics` nem integração com Google Agenda, então o compromisso só existe dentro do sistema. | M |
| M5 | **Anexos** | Contratos, formulários de avaliação, resultados de pesquisa de clima. Exige armazenamento de arquivos. | G |
| M7 | **Busca global** | Achar uma etapa ou um serviço sem saber em qual cliente está. | M |
| M13 | **Carga de trabalho por serviço** | A tela Consultores conta etapas abertas por pessoa. Como as etapas não têm data, não dá para projetar a carga no tempo — o que cabe é enxergar a distribuição por serviço e por cliente. | M |

---

## Baixa — quando sobrar tempo

| # | Item | Por quê | Tam. |
|---|---|---|---|
| B4 | **Contratos** | Vigência, reajuste, aviso de renovação. Item já aparece no menu como "em breve". | G |
| B5 | **Tema escuro no conteúdo** | O menu já é escuro; o resto continua claro. | P |
| B6 | **Histórico e desfazer** | O fluxo de atividades registra, mas não dá para reverter uma exclusão. | M |

---

## Dívida técnica

| # | Item | Por quê | Tam. |
|---|---|---|---|
| D1 | **Testes só cobrem lógica pura** | `npm test` cobre datas, agenda, arquivos, tipos de cargo, exames, valores em reais, anotações, roteiros, CSV e texto (217 testes). As server actions e as consultas Prisma não são testadas — e foi exatamente aí que apareceu o bug do campo `category`. Precisa de um banco de teste. | M |
| D6 | **Exclusão de empresa não deixa rastro** | O fluxo de atividades é por empresa e cai junto no cascade. Depois de excluir um cliente, não há registro em lugar nenhum de que ele existiu nem de quem apagou. Um log global de auditoria resolveria. | M |
| D7 | **`tsc` não pega campo extra em create aninhado do Prisma** | Depois de remover `category` do schema, a inclusão de serviço no escopo continuou compilando e quebrava só em uso. Os tipos de `create` aninhado do Prisma são uniões, e o TypeScript não aplica checagem de propriedade excedente ali. Teste de integração é o que fecha essa brecha. | P |
| D8 | **Token do questionário não tem limite de tentativa** | A rota `/responder/<token>` é pública e o token é a única credencial. São 32 bytes aleatórios, então adivinhar é inviável, mas não há limite de requisição como existe no login. Antes do deploy vale estender o `LoginAttempt` a essa rota. | P |
| D9 | **Vulnerabilidades herdadas do Next** | `npm audit` aponta 6 falhas (postcss e sharp), todas em dependências transitivas do `next@15.5.2`. A correção passa por subir o Next, o que é uma mudança de versão maior do que cabe numa tarefa de funcionalidade. | P |
| D3 | **Modelo gratuito oscila** | A IA usa um modelo `:free` do OpenRouter. Em teste ele respondeu "Service temporarily overloaded" numa chamada, resposta vazia em outra, e funcionou nas seguintes — e os outros modelos `:free` testados já saíram do ar. O sistema agora **repete até três vezes** o que é falha passageira (vazio, sobrecarga, 429, 5xx), esperando mais a cada tentativa; erro de chave ou recusa não é repetido. Se o modelo sair do ar de vez, ainda é preciso trocar `OPENROUTER_MODEL` à mão. | P |
| M41 | **Conclusão da visita não escreve observação** | Marcar a etapa na visita registra a data, mas não deixa dizer como foi cumprida. A observação continua sendo escrita depois, na Evolução. | P |
| M42 | **Visita sem serviço não vira nada** | Compromisso sem serviço ligado é só um compromisso cumprido. Reunião de acompanhamento poderia virar registro no fluxo do cliente, como as reuniões transcritas viram. | M |
| M43 | **Anotação não sugere `[[` enquanto se digita** | O link tem de ser escrito à mão, com o nome exato ou parecido. Um autocompletar ao digitar `[[` evitaria o link sem destino. | M |
| M44 | **Sem busca nas anotações** | Dá para filtrar por etiqueta, mas não procurar por palavra. Com muitas anotações isso vai pesar. | P |
| M45 | **Roteiro não vira publicação** | O ciclo para em “gravado”. Ligar com a aba Publicações fecharia: o roteiro aprovado vira item na fila, e a legenda sai dele. Depende de M5 e do deploy. | M |
| M46 | **Aprendizado não separa o que funcionou** | O sistema aprende com toda edição igualmente, sem saber se o vídeo foi bem. Cruzar com o desempenho (aba Marketing) ensinaria pelo resultado, não só pelo gosto. | G |
| M47 | **Sem variação A/B do mesmo roteiro** | Os três ganchos alternativos ficam guardados, mas não dá para gerar duas versões completas do mesmo tema e comparar. | P |
| M48 | **Roteiro sai um pouco longo para a duração** | Nos cinco roteiros do teste, a IA entregou 125–133 palavras onde cabiam 102–124 para 45s. A tela avisa e a correção é cortar à mão; um segundo passe de encurtamento resolveria sozinho. | P |
| M49 | **A trava de número inventado é heurística** | `numerosSuspeitos` acha porcentagem, valor, quantidade e fonte atribuída — mas erra para o lado de avisar demais, e não pega um dado escrito por extenso (“um terço das empresas”). | P |
| M50 | **Lista de palavras difíceis é curta** | Cobre o jargão mais comum de consultoria, RH e direito, mas é uma lista fixa. Termo novo só é pego depois de alguém acrescentar em `src/lib/roteiros.ts`. | P |
| M51 | **Editar uma reunião não pergunta sobre a série** | Ao mudar hora ou local de uma ocorrência, a mudança vale só para ela. Não há “aplicar às seguintes”, que é o que se espera quando o horário fixo muda. | M |
| M53 | **Encontro do serviço não vira etapa cumprida** | Realizar um encontro de um serviço recorrente marca a visita, mas as etapas do serviço (montar roteiro, conduzir, medir) continuam sendo marcadas à mão na Evolução. | P |
| D4 | **Sem tratamento de concorrência** | Duas pessoas editando a mesma etapa sobrescrevem uma à outra silenciosamente. | M |

---

## Gestão — o que falta para os números aparecerem

A aba **Gestão** já tem a estrutura dos quatro painéis, mas só **Despesas**
funciona de verdade. O que trava os outros três não é tela: é não haver de
onde tirar o número.

| # | Item | Por quê | Tam. |
|---|---|---|---|
| **G1** | **Registrar a proposta** | É a peça que falta no meio do funil: hoje vai-se do lead direto para a empresa cadastrada. Sem proposta não existe conversão, ticket, oportunidade em aberto nem motivo de recusa — quase todo o painel Comercial depende dela. | G |
| **G2** | **Registrar contrato e recebimento** | Mensalidade e projeto, com vigência e forma de pagamento. É o que dá receita, MRR, carteira, churn e inadimplência — e é o outro lado do lucro, que hoje só tem a despesa. | G |
| **G3** | **Gráficos com dado real** | Os gráficos de receita, despesa e lucro estão como caixa: assim que G2 existir, eles passam a desenhar o ano. A despesa já poderia desenhar hoje. | M |
| **G4** | **Fechar o mês** | Marcar o mês como fechado, para o número parar de mudar depois de conferido. Sem isso, um lançamento tardio muda um relatório já entregue. | M |
| **G5** | **Receita também lançada à mão** | Enquanto G2 não existe, a mesma planilha das despesas poderia receber a receita — resolve o lucro com pouco esforço, e vira ponte para o resto. | M |

**Decisões já tomadas:** os contratos são **mensais e por projeto**, os dois
— por isso a receita é separada em recorrente e projeto em todo o painel. O
plano de contas começa com vinte linhas sugeridas, todas editáveis.

**Ainda em aberto:** de onde vêm os lançamentos de receita — digitados,
importados de planilha ou puxados do sistema financeiro; e o que as abas
*Calculadoras* e *Lacunas* do painel de referência fazem.

---

## Marketing e comercial — os cinco esqueletos

As telas de marketing entraram como **esqueleto**. Roteiros já saiu de
esqueleto e funciona. As outras quatro seguem como casca: o lugar no menu, a ideia por
trás e os blocos que cada uma terá, sem nenhuma consulta ao banco. Abaixo, a
ordem em que vale construir — e ela não é a ordem em que foram pedidas.

**Por que esta ordem.** Leads é o único módulo que funciona sozinho, sem
depender de aprovação de ninguém, e é o que fecha o ciclo com o resto do
sistema (lead ganho vira empresa cliente). Roteiros também não depende de
nada externo além da chave de IA que já existe. Os outros três esbarram em
credencial e aprovação da Meta, que têm prazo próprio — vale abrir esses
processos cedo e construir enquanto se espera.

| # | Item | Por quê | Depende de | Tam. |
|---|---|---|---|---|
| **1º** | **Leads (CRM)** — funil, ficha, motivo de perda, e o botão que transforma lead ganho em empresa cliente | É o único que não depende de nada externo, e o que mais muda a operação: hoje o funil não existe em lugar nenhum. O WhatsApp entra depois, pelo link `wa.me` primeiro | nada | G |
| **3º** | **Marketing** — métricas do Instagram | Precisa de conta Profissional, app na Meta e aprovação de permissão. Enquanto a aprovação não sai, dá para começar pela importação da planilha que o Instagram exporta | conta Profissional + app Meta aprovado | G |
| **4º** | **Tráfego pago** | Depende do mesmo app da Meta e, para valer a pena, da aba Leads preenchida — sem ela não existe custo por lead, que é o número que importa | app Meta + conta de anúncios + Leads pronto | G |
| **5º** | **Publicações** | O mais dependente de todos: permissão de publicação (aprovação separada da de leitura), armazenamento de arquivos público e, para agendar, um cron no servidor | permissão de publicação + armazenamento (M5) + deploy (C1) | G |

**O que precisa ser providenciado fora do sistema, e quanto antes melhor:**

| O quê | Para qual aba | Observação |
|---|---|---|
| Instagram como conta **Profissional**, vinculada a uma Página do Facebook | Marketing, Publicações | Conta pessoal não dá acesso a métrica nenhuma pela API |
| App na **Meta for Developers** com permissões de leitura aprovadas | Marketing, Tráfego pago | Aprovação é processo com prazo, não é um botão |
| Permissão de **publicação** aprovada | Publicações | Aprovação separada da de leitura |
| Conta de anúncios no **Gerenciador de Negócios**, com o app autorizado | Tráfego pago | Ler é bem mais simples do que criar ou pausar campanha |
| **Número dedicado** de WhatsApp para a Cloud API | Leads | O número deixa de funcionar no aplicativo comum do celular, e a Meta cobra por conversa |
| **Armazenamento de arquivos** público (item M5) | Publicações | A API da Meta não recebe o arquivo: ela busca o vídeo numa URL |

**Decisões que ainda não estão tomadas** (estão escritas dentro de cada tela,
no bloco "A decidir antes de construir"):

- Só Instagram, ou também TikTok, YouTube e LinkedIn?
- As métricas e os anúncios são só da consultoria, ou também das empresas
  clientes?
- No WhatsApp: começar pelo link `wa.me`, que funciona hoje sem credencial
  nenhuma mas não guarda histórico, ou já ir para a Cloud API?
- No tráfego: só ler as campanhas, ou também pausar e mudar orçamento daqui?

---

## Dado pessoal fora do contrato

A aba Leads guarda dado de gente que **não** é colaborador de cliente e não
assinou contrato nenhum: nome, telefone, empresa e o que a pessoa contou na
conversa. Isso pede as mesmas cautelas já registradas em C6 e C7 para a ficha
do colaborador, mais uma: **de onde veio o consentimento**, e por quanto tempo
o lead perdido continua guardado. Vale resolver junto com M20 (retenção e
descarte), antes de a tela existir de verdade.

---

## Esqueletos já no sistema

Cinco telas de Marketing e comercial estão em esqueleto, detalhadas na seção
acima: Marketing, Roteiros, Publicações, Tráfego pago e Leads. Cada uma
carrega, dentro da própria página, a ideia do módulo, a origem dos dados, o
que depende de fora e o que ainda está por decidir.

Os itens abaixo aparecem no menu marcados como “em breve”, desabilitados, e
ainda não têm tela.

| Tela | Rota | Item relacionado |
|---|---|---|
| Contratos | — em breve | B4 |
| Carga de trabalho | — em breve | M13 |

---

## Decisões de navegação

- A **ficha do cliente são abas no topo** da página da empresa, não itens do
  menu lateral. O menu lateral fica só com o que vale para o sistema todo, e
  não precisa carregar o contexto da empresa aberta.
- O rodapé do menu é o **seletor de empresa** (o contexto em que se trabalha),
  não a conta do usuário. Trocar de empresa mantém a seção aberta: do Escopo
  da empresa A vai para o Escopo da empresa B.
- A conta do usuário e o "Sair" ficam no avatar do topo do menu.
- Cada tela tem **uma** ação primária. Duas exceções conscientes, por
  carregarem contexto que o menu não tem:
  - "← Voltar para o mês", na semana aberta, volta para o mês que estava sendo
    visto; o item Planejamento do menu sempre abre o mês atual.
  - "Cadastrar nova empresa" vive dentro do seletor de empresa, para ser
    alcançável de qualquer tela sem passar pela lista.
