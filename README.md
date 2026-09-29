# RH Resultados — Sistema de Controle Operacional

Sistema interno para uma empresa de RH acompanhar a execução dos serviços
contratados por cada empresa cliente: o que foi combinado (escopo) e o que já
foi cumprido (evolução).

Stack: **Next.js 15 (App Router) · TypeScript · Tailwind CSS 4 · Prisma ·
PostgreSQL**. Preparado para deploy na **Vercel**.

---

## Como o sistema funciona

| Etapa | Onde |
|---|---|
| **1. Acesso** — e-mail e senha, cadastrados apenas pelo administrador | `/login` |
| **2. Seleção de empresa** — escolher o cliente ou cadastrar um novo | `/empresas` |
| **3. Cadastro de empresa** — dados, contrato, filiais, matriz, tom, nicho | `/empresas/nova` |
| **4. Ficha do cliente** — Dados, Agenda, Equipe, Ponto e Reuniões | `/empresas/[id]` |
| **5. Agenda** — quando você está em cada cliente e o que trabalha no dia | `/agenda` |

A ficha do cliente aparece como **abas na coluna da esquerda da página da
empresa**: Dados · Agenda · Equipe · Ponto · Reuniões.

> Em 2026-09-19 Recrutamento e seleção, Planejamento, Entregas, Evolução e
> Anotações saíram do sistema (telas e dados) para serem refeitos. As seções
> mais abaixo que falam deles descrevem a versão antiga.

O **menu lateral** guarda o que vale para o sistema todo, em dois lados. O de
clientes: Início, Agenda, Gestão, Relatórios, Empresas, Consultores, Usuários
e Configurações. E o de **marketing e comercial** da própria consultoria —
Marketing, Roteiros, Publicações, Tráfego pago e Leads —, que hoje está em
esqueleto. A empresa em que se está
trabalhando fica no rodapé do menu, que também é o seletor de empresa.
---

## Rodando localmente

```bash
npm install
```

O `.env` já vem com um `AUTH_SECRET` gerado.

### Banco local, sem Docker e sem instalar nada

O projeto traz um PostgreSQL embarcado. Num terminal:

```bash
npm run db:local
```

Ele sobe um Postgres 18 na porta 5433 e guarda os dados em `.localdb/`
(ignorado pelo Git). Deixe esse terminal aberto.

Na primeira vez, crie as tabelas, o administrador e o catálogo de serviços
em outro terminal:

```bash
npm run db:migrate
npm run db:seed
npm run db:servicos
```

E suba a aplicação:

```bash
npm run dev
```

Entre em `http://localhost:3000/login` com o `ADMIN_EMAIL` / `ADMIN_PASSWORD`
do `.env`. Os demais acessos são criados dentro do sistema, em **Usuários**
(visível apenas para administradores).

### Usando um banco hospedado

Para apontar para Neon, Supabase ou Vercel Postgres, troque `DATABASE_URL` e
`DIRECT_URL` no `.env` e rode `npm run db:deploy`, `npm run db:seed` e
`npm run db:servicos`. Nesse caso o `npm run db:local` não é necessário.

---

## Deploy na Vercel

1. Suba o projeto para um repositório Git e importe na Vercel.
2. Crie um banco PostgreSQL (Vercel Postgres, Neon ou Supabase).
3. Em **Settings → Environment Variables**, cadastre todas as variáveis do
   `.env.example`.
4. O `build` roda `prisma generate`. As tabelas são criadas aplicando as
   migrations — rode apontando para o banco de produção, no deploy e a cada
   mudança de schema:

   ```bash
   npm run db:deploy
   ```

   Na primeira vez, também `npm run db:seed` e `npm run db:servicos`.

5. Faça o deploy.

---

## Estrutura

```
prisma/schema.prisma          modelo de dados (usuários, empresas, planos, tarefas…)
prisma/seed.ts                cria o administrador inicial
src/lib/prisma.ts             cliente Prisma
src/lib/session.ts            sessão em cookie httpOnly assinado (JWT)
src/lib/auth.ts               hash e verificação de senha (bcrypt)
src/lib/dates.ts              utilitários de data, tudo em UTC
src/lib/agenda.ts             grade do mês e horários da agenda
src/app/login/                acesso
src/lib/servicos.ts           catálogo de serviços (fonte do seed)
src/app/(app)/empresas/       seleção, cadastro e ficha do cliente
src/app/(app)/agenda/         agenda de visitas aos clientes
src/app/responder/[token]/    questionário de cargo respondido sem login
src/app/(app)/admin/usuarios/ gestão de acessos (somente administrador)
src/components/               formulários e quadros reutilizáveis
```

### Decisões que valem saber

- **Datas em UTC 00:00.** Dias são gravados normalizados, então o quadro mostra
  o mesmo dia independente do fuso do navegador.
- **Sessão em cookie httpOnly assinado com `AUTH_SECRET`**, validade de 7 dias.
  Não há cadastro público: `createUser` exige perfil ADMIN.

---

## Acesso e segurança

- **A sessão é conferida contra o banco a cada requisição.** O cookie sozinho
  não basta: `getSession` carrega o usuário e devolve nulo se ele foi
  desativado ou excluído. Desativar alguém em Usuários corta o acesso na hora,
  e nome e perfil vêm sempre do banco — uma promoção vale sem precisar
  relogar. A consulta usa `cache` do React, então é uma por requisição.
- **O login trava por força bruta.** Cinco falhas no mesmo e-mail, ou vinte no
  mesmo IP, bloqueiam por 15 minutos — inclusive com a senha certa. As
  tentativas ficam na tabela `LoginAttempt`, não em memória, para o bloqueio
  valer também quando a aplicação roda em várias instâncias na Vercel. Um
  login bem-sucedido zera o histórico de falhas daquele e-mail.
- **O administrador vê e libera bloqueios de login** na tela de Usuários, sem
  esperar os 15 minutos da janela.
- **O schema é versionado em migrations** (`prisma/migrations`). Não use
  `prisma db push`: ele altera o banco sem deixar histórico.

---

## Relatório para o cliente

Em **Relatórios**, escolha a empresa e o período. O relatório mostra as
entregas concluídas agrupadas por área de RH, os serviços do escopo com o
percentual de etapas cumpridas.

O cabeçalho e o rodapé trazem a identidade da sua empresa, configurada em
**Configurações**. Há também exportação em **CSV** (separador `;` e BOM
UTF-8, para o Excel em português abrir sem embaralhar acentos).

O PDF sai pelo botão **Imprimir / PDF**, que usa a impressão do próprio
navegador — não há biblioteca de PDF no projeto. As regras em
`@media print` escondem o menu e os filtros, deixando só o documento.

Os filtros ficam na URL, então o relatório montado é um endereço que pode
ser guardado e reimpresso depois.
---

## Equipe da empresa cliente

Em **Equipe** ficam os colaboradores do cliente — não confundir com
**Consultores**, em Equipe interna, que são as pessoas da consultoria que
acessam este sistema.

Cada pessoa tem uma ficha com:

- **Cadastro** — cargo, setor, unidade, admissão, situação (ativo, afastado,
  desligado) e observações gerais.
- **PDI** — Plano de Desenvolvimento Individual, com ações que se marcam
  conforme são cumpridas. O plano fecha sozinho quando todas são concluídas.
- **Linha do tempo** — observações, advertências, faltas e atestados no mesmo
  fluxo cronológico. Advertência tem gravidade (verbal, escrita, suspensão);
  falta pode ser marcada como justificada; atestado tem período, e o sistema
  calcula os dias de afastamento.

### Sobre dado sensível

Atestado é dado de saúde. **Não existe campo de diagnóstico ou CID de
propósito** — o acompanhamento de RH precisa de período e afastamento, não do
motivo clínico. O formulário avisa isso na tela.

Vale saber o que o sistema **ainda não faz** nesse tema: qualquer usuário com
acesso ao cliente vê a ficha completa de todo mundo, não há registro de quem
consultou o quê, e não há política de retenção. Para uso com dados reais de
colaboradores, isso precisa ser resolvido — está no roadmap.
---

## Cultura

A aba **Cultura** começa por um questionário de diagnóstico: missão, visão,
valores, comportamentos esperados, objetivos, liderança, pontos fortes,
fragilidades, comportamentos a evoluir e desafios da equipe. Todos os campos
aceitam ditado por voz.

A partir do diagnóstico salvo, a IA monta o **calendário anual de
desenvolvimento cultural**: doze meses com `Mês | Tema da Campanha | Valor
Reforçado | Foco Estratégico`, mais quatro entregáveis — direcionamento
cultural do ano, jornada de evolução, fragilidades transformadas em
oportunidades e a mensagem central do ano.

Três regras estão codificadas no prompt e valem a pena conhecer:

- **Fragilidade nunca vira acusação.** Cada uma é convertida em oportunidade
  de evolução ("atendimento mecânico" vira "experiência que gera valor").
- **Os doze meses são uma jornada**, não temas soltos: da consciência da visão
  ao reconhecimento do que foi construído.
- **Nenhum valor é inventado.** Se surgir uma necessidade cultural que a
  empresa não declarou como valor, ela aparece como "Direcionamento de
  desenvolvimento", deixando claro que não é valor oficial.

O calendário é mostrado para revisão antes de ser gravado. Se não ficou bom, o
caminho é ajustar o diagnóstico e gerar de novo — cada geração fica guardada
por ano, e dá para manter mais de uma versão.

### Treinamento técnico

Na ficha de cada colaborador há a **autoavaliação técnica**: oito perguntas que
a própria pessoa responde sobre o que faz, o que domina, onde trava e o que
quer desenvolver. A IA lê e propõe um plano; depois da revisão, ele é gravado
**como um PDI** da pessoa — não como uma estrutura à parte.
---

## Reuniões

Em **Reuniões**, cole (ou dite) a transcrição de uma reunião com o cliente. A
IA lê e propõe as ações combinadas, em dois passos:

1. **Leitura** — a IA devolve um resumo e a lista de ações. Nada é gravado.
2. **Revisão** — você desmarca o que não vale, corrige o texto do que vale e
   escolhe onde as ações entram: um serviço já no escopo, ou um serviço novo
   criado para a reunião.

As ações aceitas viram **etapas** desse serviço e passam a aparecer na
Evolução — não existe uma segunda lista de pendências. Cada etapa guarda de
qual reunião nasceu.

Precisa de `OPENROUTER_API_KEY` no `.env`; sem ela a leitura recusa com uma
mensagem clara. Transcrições acima de 60 mil caracteres são cortadas, e a
tela avisa quando isso acontece.

Excluir o registro de uma reunião **mantém** as ações já geradas: elas podem
ter sido cumpridas, e só perdem a referência à origem.
---

## Análise de cargo

Na aba **Análise de cargo** da empresa, cada cargo vira uma análise. O
questionário é diferente por natureza do cargo — **gerencial**, **operacional**
ou **técnico/administrativo** — e as três versões vivem em um lugar só,
`src/lib/questionarios-cargo.ts`. Quem responde é o próprio ocupante do cargo.

Há três formas de coletar a resposta, e as três chegam no mesmo lugar:

1. **Link de resposta** — o colaborador responde sem login, em
   `/responder/<token>`. O token são 32 bytes aleatórios, é a única credencial
   dessa rota, vale 30 dias por padrão e aceita **uma** resposta.
2. **Preencher aqui** — quando a entrevista é feita junto com o RH.
3. **Importar arquivo** — envie o questionário já preenchido em **PDF, Word
   (.docx) ou texto** (até 10 MB) e a IA transcreve as respostas campo a
   campo. Como no resto do sistema, ela devolve para revisão na tela; nada é
   gravado antes de você conferir.

### Importar vários de uma vez

O botão **Importar arquivos**, no alto da aba, aceita até 10 questionários
numa tacada. Cada arquivo vira uma análise, e a revisão mostra todos lado a
lado antes de gravar. Um arquivo que falha não derruba os outros: ele aparece
na lista com o motivo, e o resto segue.

**Os nomes viram a equipe.** Quem aparece como ocupante do cargo entra na
ficha de **Equipe** da empresa na mesma passada, com o cargo e o departamento
já preenchidos. Quem já está lá é reaproveitado pelo nome, em vez de virar
uma segunda ficha — e os dados que já existiam não são sobrescritos: só o que
estava em branco é completado.

**O tipo de questionário é reconhecido sozinho**, na seguinte ordem:

1. o nome do questionário no cabeçalho do documento;
2. as perguntas que só existem em um dos três tipos (peso e esforço são de
   cargo operacional, dado confidencial é de técnico);
3. **o nome do cargo** — "Coordenadora de Qualidade" é gerencial, "Soldador"
   é operacional, "Analista Fiscal" é técnico;
4. o nome do arquivo, que na prática costuma ser o cargo ou a pessoa.

Se nada disso decidir, o arquivo **não é recusado**: entra como técnico e a
revisão destaca o seletor em âmbar, com o aviso "tipo não reconhecido". O
seletor pode ser trocado em qualquer linha, mesmo quando o reconhecimento
acertou.

Com as respostas registradas, **Descrição de cargo** gera missão e
responsabilidades no formato "o que faz / como faz / por que faz / quando
faz", também em dois passos (gerar → revisar → gravar). A página imprime em
PDF pelo navegador.

**Limites conhecidos:**

- PDF **digitalizado** (foto ou scan sem OCR) não tem texto para extrair. O
  sistema recusa com mensagem clara em vez de devolver um resultado vazio que
  pareceria falha da IA.
- O **`.doc` antigo** (Word 97-2003) não é lido: é um formato binário
  diferente do `.docx`. A mensagem diz para salvar como `.docx` ou exportar
  em PDF.
- O lote é limitado a **10 arquivos por vez**, e o limite é o tempo: cada
  arquivo é uma chamada de IA, e o lote inteiro precisa caber na duração
  máxima da requisição. As leituras correm de duas em duas.
- O **código CBO** não é sugerido pela IA — é conferido à mão e digitado na
  revisão.
- **Gerar link novo** reabre o questionário para resposta, mesmo que já
  tivesse sido respondido; a resposta nova substitui a atual. As respostas e a
  descrição atuais continuam gravadas até que isso aconteça.

---

## Agenda

**Agenda**, no menu lateral, é onde ficam os compromissos nas empresas
clientes: o dia, a hora e **qual serviço** você trabalha ali. Há duas vistas,
alternadas no canto direito:

- **Mês** — calendário de parede, de segunda a domingo, com os compromissos
  listados dentro de cada dia.
- **Semana** — grade de horas **das 08h às 22h**, com cada compromisso
  ocupando a altura do seu horário. Quem se sobrepõe divide a largura do dia
  em colunas.

Na semana **cada hora cheia é um espaço de agendamento**. Clicar numa hora
livre abre a lista de empresas: escolher o cliente já marca aquela hora
inteira (08:00–09:00, 15:00–16:00…). Se o cliente tiver serviços no escopo,
vem um segundo passo para dizer qual — com "sem serviço definido" sempre em
primeiro, porque nem toda visita é de um serviço só. Quem precisa de local,
responsável, assunto ou de um horário quebrado usa **"Preencher tudo"**, no
rodapé da lista, que abre o formulário completo já com o dia e a hora cheia
preenchidos.

Na semana, quem começa antes das 08h ou termina depois das 22h é aparado na
borda e marcado com reticências. Quem cai inteiramente fora da faixa vai para
a tira **fora do horário**, no alto — nada some da tela.

- **Clicar no agendamento abre a ficha daquele cliente** — é o caminho normal
  de uso: você olha a agenda, clica no compromisso do dia e já está dentro do
  cliente. Para editar em vez de abrir, use o lápis no canto do agendamento.
- O **serviço do dia** vem do escopo daquela empresa: o seletor só oferece os
  serviços planejados ou em andamento do cliente escolhido, e o servidor
  confere de novo antes de gravar.
- Cada compromisso é **agendado**, **realizado** ou **cancelado**, e a
  situação muda direto na lista, sem abrir o formulário.
- **Início** e a aba **Dados** de cada cliente mostram os próximos
  agendamentos, com link para a agenda.

A hora é guardada como texto `"HH:MM"`, e não como data-hora. É de propósito:
09:00 na empresa continua 09:00 em qualquer servidor, inclusive quando o
sistema sair desta máquina para a Vercel.

**A agenda não é a execução.** A etapa de um serviço (`Task`) responde "o que
falta fazer" e não tem data; a visita responde "quando eu estou lá". Amarrar
as duas obrigaria a remarcar etapa toda vez que uma visita mudasse de dia.

---

---

## Gestão

**Gestão**, no menu lateral, é o painel do negócio da consultoria: quanto
entrou, quanto saiu, o que sobrou e de onde veio. São quatro painéis, na
barra escura do topo, com navegação por ano.

| Painel | O que traz |
|---|---|
| **Comercial** | Propostas contra contratos, por consultor, serviço, origem e forma de pagamento |
| **Gerenciamento** | Receitas, despesas e lucro, com mensalidade e projeto separados |
| **Despesas** | Lançamento mês a mês, com o plano de contas editável |
| **Metas e tráfego** | O funil pago, do lead ao contrato, com CAC e payback |

### Despesas — a única com dado real

A aba **Despesas** é uma planilha: cada linha é uma conta, cada coluna é um
mês do ano escolhido. Digita na célula, sai do campo, grava. Célula vazia
apaga o lançamento. Não há botão de salvar de propósito — ter um faria
alguém perder o que digitou ao trocar de aba.

**As linhas são suas.** Vinte linhas sugeridas para consultoria de RH vêm
com um clique quando o plano de contas está vazio, agrupadas em Pessoas,
Custo de entrega, Estrutura, Impostos e Fundos. Todas podem ser renomeadas
no lugar, reordenadas e removidas, e é possível criar as que faltarem.

Linha que **já tem lançamento não é excluída, é arquivada**: apagar levaria
junto meses de histórico. Arquivada, ela some da tabela e o histórico fica.

O valor aceita `1.234,56`, `1234,56`, `1234.56` e `3.200`. O ponto é
ambíguo — em `3.200` é milhar, em `3.20` é decimal —, e a regra que
desempata é a do formato brasileiro: ponto seguido de exatamente três
dígitos é separador de milhar.

### O que ainda não tem origem

Os outros três painéis mostram a estrutura, mas ficam sem números: falta
registrar **proposta** e **recebimento** no sistema. Hoje o funil vai do
lead direto para a empresa cadastrada, sem a proposta no meio — e é ela
que alimentaria quase todo o painel Comercial.

---

## Abertura comercial: briefing

A primeira reunião com um cliente novo é de **briefing e fechamento**, e é
por ela que o processo comercial começa — não pelo cadastro da empresa.

Na **Agenda**, o botão **Cliente novo · briefing** abre um formulário com o
básico: nome da empresa, ramo, quantidade de funcionários, quem é o contato
e o horário da reunião. Ao salvar, o sistema cria a empresa com o status
**PROSPECTO** e marca a reunião como do tipo *briefing*, que aparece
destacada em âmbar no calendário.

**Clicar no compromisso abre a ficha da empresa**, e no alto dela está o
campo de **Briefing** — para ser digitado durante a conversa, com botão de
ditado e um roteiro de tópicos que pode ser aberto ao lado. O briefing
guarda a data em que foi registrado.

O status **PROSPECTO** distingue quem ainda não fechou de quem é cliente.
Empresa nesse status aparece normalmente na lista e tem ficha completa: o
que muda é só o rótulo, até o contrato ser assinado.

---

## Roteiros

**Roteiros**, no menu lateral, escreve roteiro de vídeo curto pelo método
de Ray Edwards — o do livro *Como Escrever Copy Que Vende*.

### O que é fixo, e o que se pergunta

Todo roteiro aqui é de **venda**, na estrutura **PASTOR**, para
**empresários**, em **30 segundos**. Isso não muda de vídeo para vídeo, então
não é perguntado de novo a cada vez.

O formulário pede só o que muda: **tema**, **oferta**, **CTA**, plataforma e
quantos roteiros. Sem tema, oferta ou CTA, o sistema devolve a lista de
perguntas em vez de escrever — a checagem roda no servidor, antes de chamar a
IA, porque é determinística e cara de errar.

Os sete blocos do PASTOR: Gancho · Problema/Dor · Amplificação ·
História/Solução · Transformação/Prova · Oferta · CTA. Em 30 segundos cabem
70 a 80 palavras, ou seja **uma ou duas frases curtas por bloco** — e o
prompt diz isso à IA.

(A estrutura HVC leve, sem oferta, continua no código para vídeo de conteúdo,
mas a tela não a oferece.)

### O tamanho é conferido contra a duração

A ~150 palavras faladas por minuto: 15s ≈ 35–40 palavras, 30s ≈ 70–80,
60s ≈ 150–160, 90s ≈ 220–240. A tela conta as palavras faladas enquanto
você edita — o rótulo do bloco não entra na conta — e diz se está curto,
certo ou longo para a duração pedida.

### Linguagem simples é regra, não pedido

Quem assiste está rolando o feed. Não há tempo para traduzir palavra
difícil: ou entende na hora, ou vai embora. Por isso a regra está no prompt
**e** é conferida na tela:

- **Frases de até 20 palavras.** A tela mostra a média por frase de cada
  roteiro, e avisa quando passa.
- **Sem jargão.** O sistema conhece uma lista de termos de consultoria, de
  RH em inglês e de juridiquês, e para cada um sabe o que dizer no lugar —
  *turnover* → rotatividade, *reclamatória* → processo na justiça,
  *psicossocial* → o que estressa e adoece no trabalho.
- Quando um desses aparece, o roteiro mostra a lista de trocas sugeridas,
  com o termo riscado e a palavra simples ao lado.

A lista está em `src/lib/roteiros.ts` e cresce conforme o uso mostrar
outros termos.

### Cinco de uma vez, por ângulos diferentes

Uma geração escreve **5 roteiros** por padrão (3 ou 8 também), cada um
atacando o mesmo tema por um **ângulo distinto**: risco e consequência,
erro comum, mito × verdade, caso real, número, pergunta que expõe a dor,
bastidor, contra-intuitivo. O ângulo fica visível no roteiro, para se saber
o que já foi tentado.

### O roteiro vem em texto completo

Cada roteiro tem o painel **Roteiro completo**, em duas formas: *com os
blocos* (rotulado, para conferir a estrutura) e *só a fala* (contínuo,
para ler na gravação). Os dois com botão de copiar.

### Número inventado é travado na origem

Num teste real a IA escreveu *“afastamento por saúde mental subiu 38%”*
atribuindo ao Ministério do Trabalho — sem que nenhum dado tivesse sido
informado. Duas travas nasceram daí:

- **Sem prova social informada, o ângulo do número sai da lista.** Não
  adianta pedir “não invente dado” e ao mesmo tempo oferecer um ângulo cujo
  gancho é um dado.
- **A tela avisa.** Roteiro que cita porcentagem, valor, quantidade ou fonte
  atribuída, tendo sido gerado sem prova social, aparece com *“Confira antes
  de gravar”* e o trecho suspeito destacado.

### Cada roteiro é editável, e a edição ensina

O roteiro sai em blocos editáveis na tela. Quando você reescreve um bloco e
salva, o sistema guarda o par **antes/depois** — e as seis correções mais
recentes entram no prompt das próximas gerações, como exemplo de como você
escreve.

**Não é treino de modelo.** É a IA vendo suas correções antes de escrever.
A diferença importa: o efeito aparece já na geração seguinte, some se você
apagar os exemplos, e não altera o modelo para mais ninguém.

O painel **O que o sistema aprendeu com você** lista essas correções lado a
lado, e cada uma pode ser desligada — exemplo ruim contamina o que vem
depois.

### Você decide o que vai ser gravado

`rascunho` → `vai gravar` → `gravado` → `publicado`, ou `descartado` a
qualquer momento. **Descartar exige o motivo**, porque ele ensina tanto
quanto a edição: saber por que um roteiro não serviu vale mais do que ele
sumir da lista.

### O que a IA nunca faz aqui

Não inventa oferta, preço, bônus, garantia, número nem depoimento. Sem
prova social informada, o bloco de prova fala só da transformação — e o
prompt diz isso explicitamente a cada geração.

---

## Anotações

**Anotações**, no menu lateral, guarda o que se lembra entre um cliente e
outro. Escreva de corrido, misturando empresas: a IA separa por cliente e
por serviço, e as etapas aceitas entram na **Evolução** de cada um — com
revisão na tela antes de gravar, como em todo uso de IA aqui.

### A sintaxe é a do Obsidian

| Escreve | Faz |
|---|---|
| `[[Nome da empresa]]` | Liga a anotação àquele cliente. Vira link para a ficha |
| `#assunto` | Etiqueta. Vira filtro na lista, e aceita `#cliente/oral-c` aninhada |

O link vale mais que o palpite da IA: quem escreveu já sabia de quem estava
falando. Quando a anotação marca uma empresa só, todos os itens vão para
ela sem a IA precisar adivinhar.

O nome no link é reconhecido **sem acento, sem caixa e por apelido** —
`[[Galego]]` acha "Galego Bonés". Nome que não casa com nenhuma empresa
aparece sublinhado em âmbar e gera aviso: link sem destino é erro de
digitação, não anotação sobre outra coisa.

**Backlinks:** a ficha de cada cliente mostra as anotações que o citam.

### Anotar pelo celular

Em Anotações há o botão **Criar o link do celular**: um endereço só seu, do
tipo `/anotar/<token>`, para abrir no telefone e salvar na tela de início.
A tela é um campo, o botão de ditar e o de enviar — depois de enviar, ela
se limpa e fica pronta para a próxima.

O token são 32 bytes aleatórios e é a única credencial. Ele **só escreve**:
quem tem o link não lê nada do sistema. Dá para gerar outro (o anterior
morre, inclusive o atalho já salvo) ou desativar.

**Sobre WhatsApp:** ler mensagens de um WhatsApp exigiria a Cloud API da
Meta — número dedicado que sai do aplicativo comum, aprovação de modelos de
mensagem, um endereço público para receber os avisos e custo por conversa.
O link de captura resolve a mesma necessidade hoje, sem nada disso.
Aplicativo de notas (Keep, Notas do iPhone) não tem API pública para isso.

### Agenda de cada empresa

A ficha do cliente tem a aba **Agenda**: a mesma tela da agenda geral, com
a empresa já fixa. Mesmo calendário, mesma recorrência, mesma pauta — e o
seletor de empresa some do formulário, porque já se sabe de quem é.

É a mesma tela por dentro: duplicar o calendário só para filtrar uma coluna
criaria duas versões da mesma coisa para manter.

### Serviço que acontece em encontros

Parte do catálogo é de **encontros repetidos** — fortalecimento da cultura,
desenvolvimento técnico por setor, reuniões individuais, ciclo de feedback,
análise de indicadores, habilidades de comunicação.

Ao incluir um desses no escopo, o sistema **pergunta a periodicidade** e já
marca a série na agenda do cliente, com a pauta sugerida do serviço em cada
encontro. Serviço que se repete não deveria depender de alguém lembrar de
marcar depois.

Se preferir combinar a periodicidade mais tarde, o serviço entra sem agenda
e o cartão dele passa a mostrar **Marcar os encontros na agenda** — o mesmo
diálogo, quando você quiser.

### Reunião que se repete

No agendamento dá para escolher **toda semana**, **a cada quinze dias**,
**todo mês**, **a cada dois, três ou seis meses**, ou **uma vez por ano** — e
por quantas vezes (até 52). As ocorrências são criadas de
uma vez, e não calculadas na hora de mostrar: assim cada reunião pode ser
remarcada, cancelada ou concluída sozinha, que é o que acontece na prática.

Cada ocorrência mostra onde está na série — *“3 de 8”*. Ao excluir uma
reunião de série, o sistema pergunta se é **só esta** ou **esta e as
seguintes** — e o que já passou nunca é apagado, porque isso apagaria
histórico.

Nas frequências que andam em meses, o dia escolhido é o teto: quem marca dia 31 cai no dia 28 ou 29
em fevereiro, e volta ao 31 nos meses que o têm.

### Pauta combinada

No agendamento há o campo **Pauta**, um assunto por linha. A pauta vale
para **todas as reuniões da série**, e cada assunto vira um item para
marcar durante a conversa — o mesmo gesto das etapas na Evolução.

Dá para acrescentar assunto depois, direto na lista, e apagar o que não
vale mais.

---

## Como as partes se ligam

O sistema não é um conjunto de telas soltas. O caminho de um cliente passa
por elas em ordem, e cada passagem é automática:

```
Agenda            briefing marcado → empresa nasce como PROSPECTO
  ↓
Ficha             o briefing é digitado durante a reunião
  ↓
Escopo            primeiro serviço combinado → a empresa vira ATIVO
  ↓
Agenda            visita marcada, ligada ao serviço
  ↓
Evolução          concluir a visita marca as etapas cumpridas naquele dia
```

### Prospecto vira cliente sozinho

A empresa aberta pelo briefing fica como **PROSPECTO**. Quando o primeiro
serviço entra no escopo, ela passa a **ATIVO** e o fluxo de atividades
registra a mudança. Ninguém precisa lembrar de editar o campo: o que define
cliente é haver trabalho combinado.

### A visita vira evolução

Marcar uma visita como **realizada**, quando ela está ligada a um serviço,
abre a pergunta *“o que avançou nessa visita?”* com as etapas ainda abertas
daquele serviço. As etapas marcadas ficam concluídas **com a data da
visita**, e a Evolução passa a mostrar *“cumprida na visita de 10/09”* em
cada uma.

Isso vale nos dois sentidos: **desmarcar a visita solta as etapas**. Manter
uma etapa concluída apontando para uma visita que não aconteceu seria
mentira no relatório do cliente.

A visita não é obrigada a ter serviço. Sem serviço, ela é só compromisso e
a conclusão é direta, sem perguntar nada.

### O exame aparece na agenda

O exame ocupacional é marcado na ficha do colaborador, mas ocupa o dia de
alguém — então aparece na agenda, em azul, **em leitura**. Clicar leva para
a ficha, que é onde ele é editado. Na visão de semana ele fica na tira do
topo, junto do que cai fora das 08h–22h.

### A anotação vira etapa

Uma anotação solta é lida pela IA e vira etapa na Evolução do cliente certo.
A etapa guarda de qual anotação veio, como as ações que nascem de reunião.

### O que ainda não se liga

- A **proposta** não existe: entre o briefing e o escopo há um vazio, e é
  ele que deixa o painel Comercial da Gestão sem números (item G1).
- A **despesa** lançada na Gestão não sabe de qual cliente veio, então não
  há custo por contrato.
- O **lead** da aba Leads ainda não vira empresa com um clique — hoje o
  caminho de entrada é o briefing na agenda.

---

## Marketing e comercial (esqueleto)

Quatro telas existem hoje apenas como **esqueleto**: elas ocupam o lugar no
menu e registram, dentro da própria página, a ideia do módulo, a origem dos
dados, o que depende de credencial de fora e o que ainda está por decidir.
Nenhuma consulta o banco.

| Tela | O que vai resolver |
|---|---|
| **Marketing** | Métricas do Instagram da consultoria: o que performou, retenção dos reels, e o funil do alcance até o cliente |
| **Publicações** | Publicar o vídeo daqui, com a legenda que veio do roteiro, e trazer o desempenho de volta |
| **Tráfego pago** | Campanhas pelo que trazem: custo por lead e por cliente, não impressões |
| **Leads** | O funil comercial com WhatsApp, até o lead ganho virar empresa cliente |

A ordem de construção, o que precisa ser providenciado na Meta e as decisões
em aberto estão em [ROADMAP.md](ROADMAP.md), na seção **Marketing e comercial
— os cinco esqueletos**. Resumo do que trava: as três telas de Instagram e
anúncios dependem de conta Profissional, app aprovado na Meta e, no caso de
Publicações, de armazenamento de arquivos e do sistema no ar. **Leads** e
**Roteiros** não dependem de nada disso, e por isso vêm primeiro.

---

## Exames ocupacionais

Os exames ficam **dentro da ficha de cada colaborador**, em Equipe, e o
exame ocupacional é tratado como **tarefa**: agendar, acompanhar e registrar o resultado. É o mesmo gesto do
resto do sistema — a caixinha à esquerda conclui, e desmarcar reabre.

O ciclo de cada tarefa:

1. **A agendar** — quem vai fazer, de que tipo e até quando.
2. **Agendado** — dia, hora, clínica e telefone.
3. **Realizado** — data, resultado do ASO e até quando ele vale.

Os cinco tipos previstos na NR-7 estão no seletor: admissional, periódico,
retorno ao trabalho, mudança de função e demissional. Cada um traz, como
dica, quando deve acontecer.

**O admissional é o caso que puxou a tela.** Ele precisa acontecer antes do
primeiro dia de trabalho, então o prazo sugerido é **o dia anterior à
admissão**, calculado sozinho a partir da data de admissão do colaborador. E
como o exame vem antes da contratação, a tarefa aceita alguém **ainda sem
ficha**: basta escrever o nome. Quando a pessoa for cadastrada, a tarefa pode
ser refeita já vinculada a ela.

**Prazo à vista.** Cada pendência mostra "vence hoje", "em 5 dias" ou
"vencido há 3 dias", em âmbar quando está perto e em vermelho quando passou.
O que está vencido aparece primeiro.

### Onde fica

Na ficha do colaborador, em **Documentos e exames ocupacionais**: os exames
daquela pessoa, com resultado, validade do ASO e restrições descritas. É ali
que se cria, agenda e conclui.

### Na tela Início

Os exames pendentes de **todas as empresas** aparecem em *Exames ocupacionais
a fazer*, com o número dos que estão com prazo vencido ao lado do título.
Clicar leva à ficha da pessoa.

### Decisões que valem saber

- **O exame não é uma `Task`.** Ele carrega o que uma etapa de serviço não
  carrega — tipo, clínica, resultado e validade do ASO — e tem data, que a
  etapa deliberadamente não tem. Então é um registro próprio, que *aparece*
  como tarefa nas telas. Isso evita duas verdades sobre o mesmo trabalho.
- **A validade do ASO é sugestão, não regra.** O sistema propõe doze meses e
  deixa mudar: quem decide o prazo é o médico do trabalho, e a NR-7 pede seis
  meses em vários casos. Resultado *inapto* não gera validade.
- **Nada de diagnóstico.** Como nos atestados, só entram aqui a restrição
  descrita no ASO e a aptidão. Não há campo para CID nem para diagnóstico, e
  o formulário avisa isso.
- **O arquivo do ASO ainda não é guardado**: o sistema não tem armazenamento
  de arquivos (item M5). O que fica registrado é o que o documento diz.

---

## Testes

```bash
npm test
```

Usa o runner do próprio Node (`node --test` via tsx), sem dependência de
teste no projeto. São 217 testes sobre a lógica pura: datas em UTC, as grades
de mês e de semana da agenda, o encaixe dos horários e as datas das reuniões
que se repetem, os formatos de arquivo
aceitos e o reconhecimento do tipo de cargo, os prazos e a validade dos
exames ocupacionais, a leitura de valor em reais, a sintaxe das anotações, o método
dos roteiros, geração de CSV e as transformações de texto (slug, iniciais,
listas coladas).

**O que ainda não é coberto:** as server actions e as consultas Prisma, que
precisam de um banco de teste. É justamente onde escapou o bug de um campo
removido do schema continuar sendo enviado — os tipos de `create` aninhado do
Prisma não reprovam propriedade excedente.
---

## Modo de trabalho

O que ainda falta está em [ROADMAP.md](ROADMAP.md), separado por urgência.

Telas novas entram primeiro como **esqueleto**: o item aparece no menu lateral
com um ponto âmbar, e a tela registra o propósito do módulo, de onde virão os
dados e quais blocos ela terá — sem nenhuma consulta ao banco. Itens que ainda
não têm tela aparecem no menu marcados como "em breve" e desabilitados.

A navegação vem de [src/lib/nav.ts](src/lib/nav.ts): `NAV` monta o menu
lateral e `FICHA_TABS` monta as abas da empresa. Para acrescentar uma seção
à ficha do cliente, basta declarar o rótulo e o slug em `FICHA_TABS`.

---

## Serviços, escopo e evolução

A empresa de RH tem um **catálogo de serviços** padrão (`Service` +
`ServiceStep`), definido em [src/lib/servicos.ts](src/lib/servicos.ts) e
carregado no banco com:

```bash
npm run db:servicos
```

O comando é idempotente e casa cada serviço pelo `slug`. Ele serve como carga
inicial: no dia a dia o catálogo é editado em **Configurações**, e rodar o
seed de novo sobrescreve as etapas com o conteúdo do arquivo.

Na ficha do cliente, **Escopo** define quais serviços foram combinados. Ao
marcar um serviço, cada etapa do catálogo vira uma `Task` ligada ao
`CompanyService`, sem data. **Evolução** é a visão dessas mesmas tarefas
agrupadas por serviço, para marcar o que já foi cumprido.

A etapa de serviço **é** uma tarefa — não existe uma segunda lista de
pendências. Por isso `Task.scheduledDate` é opcional: a etapa nasce sem data e
aparece na aba Tarefas sob "Sem data agendada" até ser agendada no quadro.
