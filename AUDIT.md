# Auditoria do RH Resultados — 2026-10-15

Branch: `audit/2026-10-15-jcjeum`. Fase 0 (somente leitura): nenhum código, `.env`, migration ou política de banco foi alterado.

Legenda: 🔴 Crítico · 🟠 Alto · 🟡 Médio · ⚪ Baixo. Cada achado tem um código (S = segurança, P = performance, C = código, D = design) para ser citado na aprovação.

Marcados com **⚠ precisa de aprovação** são os que mexem em banco, regra de negócio ou comportamento visível. Esses só serão feitos com o seu ok explícito.

---

## 1. Mapeamento

### Stack
| Camada | O que é |
|---|---|
| Framework | Next.js 15.5.27 (App Router, Server Components e Server Actions), React 19.1.9, TypeScript 5.9 (`strict`) |
| Estilo | Tailwind CSS 4 com paleta `brand` em `src/app/globals.css:11` |
| Banco | PostgreSQL via Prisma 6 (`prisma/schema.prisma`, 49 modelos, 21 enums, 50 migrations). Produção: Supabase `rh-resultados` (sa-east-1). Local: `embedded-postgres` na porta 5433 |
| Autenticação | Própria: e-mail e senha com bcrypt (`src/lib/auth.ts`), sessão em JWT HS256 num cookie httpOnly de 7 dias (`src/lib/session.ts`), conferida no banco a cada requisição |
| Hospedagem | Vercel, região `gru1`, cron diário em `/api/manter-ativo` (`vercel.json`) |
| IA (opcional) | OpenRouter, chamada só no servidor (`src/lib/ai-cliente.ts`) |
| Testes | `node:test` via `tsx` (18 arquivos, 261 testes, todos passando) |
| Lint | **Não configurado**: `npm run lint` abre o assistente do `next lint` (ver C-1) |

### Linha de base (antes de qualquer mudança)
| Verificação | Resultado |
|---|---|
| `npx tsc --noEmit` | ✅ sem erros |
| `npm test` | ✅ 261/261 |
| `npm run build` | ✅ (40 rotas, JS compartilhado 103 kB) |
| `npm run lint` | ❌ sem configuração de ESLint |
| `npm audit` | 7 alertas (6 altos, 1 moderado), ver S-9 |

### Rotas e páginas
Todas as páginas em `src/app/(app)/` passam pelo layout `src/app/(app)/layout.tsx:9`, que chama `requireSession()`. Não existe `middleware.ts`.

| Rota | Acesso |
|---|---|
| `/` | redireciona para `/inicio` ou `/login` |
| `/login` | pública |
| `/inicio`, `/agenda`, `/equipe`, `/empresas`, `/empresas/nova`, `/selecao`, `/selecao/[vagaId]`, `/testes`, `/testes/cadastro/[id]`, `/testes/resultado/[id]`, `/roteiros`, `/gestao`, `/relatorios`, `/configuracoes` | qualquer usuário logado |
| `/empresas/[id]` e abas `dados`, `planejamento`, `agenda`, `reunioes` (+`nova`, `[reuniaoId]`), `evolucao`, `selecao`, `equipe` (+`[pessoaId]`), `treinamentos`, `pdi` (+`[pessoaId]`, `imprimir`), `ponto` | qualquer usuário logado |
| `/admin/usuarios` | somente ADMIN (`requireAdmin`) |
| `/teste/[token]` | **pública**: o token (48 hex) é a credencial; uma resposta por link |
| `/ponto/[token]` | **pública**: relógio de ponto; a pessoa entra com CPF + PIN |

### Endpoints
| Endpoint | Proteção |
|---|---|
| `GET /api/manter-ativo` | `CRON_SECRET` opcional (`src/app/api/manter-ativo/route.ts:16`) |
| `GET /api/ponto/csv` | sessão |
| `GET /api/relatorio/csv` | sessão |
| `GET /api/reunioes/arquivo/[arquivoId]` | sessão |
| Server Actions (18 arquivos, 183 funções exportadas) | todas chamam `requireSession`/`requireAdmin`, exceto `login`, `responderTeste` e `baterPonto`, que são públicas por desenho |

### Modelo de permissão
Só existem dois perfis: ADMIN e MEMBRO. Qualquer usuário logado vê e edita todas as empresas (não há vínculo usuário ↔ empresa). ADMIN é exigido no servidor para: usuários, configurações/catálogo e excluir empresa (`src/app/(app)/empresas/actions.ts:245`). O menu esconde "Usuários" de quem não é ADMIN, e o servidor também bloqueia. Não encontrei ação sensível validada só no front.

### Banco
49 tabelas Prisma + `_prisma_migrations` no schema `public` do Supabase. O app conecta com o usuário `postgres` pela `DATABASE_URL` (ignora RLS). Dados sensíveis: CPF, telefone, e-mail, exames ocupacionais, advertências, ponto, despesas, hashes de senha e de PIN.

---

## 2. Achados por severidade

### 🔴 Crítico

**S-1 · RLS desligado e acesso total para `anon` em todas as 50 tabelas do Supabase** — **⚠ precisa de aprovação (política de banco)**
- Onde: banco Supabase `rh-resultados`, schema `public` (o advisor do Supabase acusa `rls_disabled_in_public` em 50 tabelas). Conferi: os papéis `anon` e `authenticated` têm `SELECT, INSERT, UPDATE, DELETE, TRUNCATE` em todas elas.
- Risco: a API REST automática do Supabase (`https://cedggbqqqgkhebdcdlmn.supabase.co/rest/v1/...`) fica aberta para quem tiver a chave `anon`, que o Supabase trata como pública. Com ela dá para ler a tabela `User` (hashes de senha), CPFs, exames, ponto, e apagar tudo.
- Correção proposta: migration que liga RLS em todas as tabelas sem criar políticas (o Prisma conecta como `postgres` e continua funcionando) e revoga os privilégios de `anon`/`authenticated` no schema `public`. Não muda nada no app.

### 🟠 Alto

**S-2 · Força bruta no PIN do ponto sem limite por IP**
- `src/app/ponto/[token]/actions.ts:48-56`: o limite é 5 erros por CPF a cada 15 min, mas não existe limite por IP nem por link. Com o link do ponto (que fica aberto num tablet), dá para testar PINs de 4 dígitos em vários CPFs ao mesmo tempo. Cada tentativa também carrega todos os funcionários da empresa (`:58`).
- Correção: somar um limite por IP e por link (como o login já faz em `src/lib/rate-limit.ts:43`), sem mudar o fluxo de quem bate o ponto.

**S-3 · Sem cabeçalhos de segurança**
- `next.config.ts:3`: nenhum `headers()`. Confirmei na resposta: sem `Content-Security-Policy`, `X-Frame-Options`/`frame-ancestors`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`, e com `X-Powered-By: Next.js`. Sem proteção contra clickjacking no `/ponto/[token]` e no login.
- Correção: cabeçalhos no `next.config.ts` e `poweredByHeader: false`. A CSP começa em modo compatível com o Next (sem quebrar o app).

**P-1 · Upload de apresentação e de AFD acima de 4,5 MB falha na Vercel**
- `next.config.ts:7` libera 30 MB e `src/app/(app)/empresas/[id]/reunioes/actions.ts:28` aceita 25 MB, mas as funções da Vercel recusam corpo de requisição acima de 4,5 MB. Na prática o usuário recebe erro genérico em arquivos maiores. Os arquivos ainda ficam como `bytea` no Postgres (`prisma/schema.prisma:299`), o que pesa no limite de 500 MB do Supabase gratuito.
- Correção mínima (Fase 2): avisar o limite real de 4,5 MB na tela e no servidor. Correção definitiva (recomendação, mexe em arquitetura): enviar direto para o Supabase Storage com URL assinada. **⚠ a mudança do limite é comportamento visível.**

**P-2 · Banco de horas recalculado desde o primeiro dia a cada abertura do Ponto**
- `src/lib/ponto-dados.ts:236` (`saldosDoBanco`) chama `calcularPessoas` do início do ponto até hoje, carregando todas as marcações e ocorrências da empresa, a cada visita em `src/app/(app)/empresas/[id]/ponto/page.tsx:196` e `:323`. O custo cresce sem limite com o tempo. Estimativa: com 30 pessoas e 1 ano de ponto, ~40 mil marcações lidas por página.
- Correção: carregar só as colunas necessárias e paralelizar; recomendação maior (saldo fechado por mês) fica listada.

### 🟡 Médio

**S-4 · Senha trocada não derruba sessões abertas**
- `src/app/(app)/admin/usuarios/actions.ts:111` e `src/lib/session.ts:79`: a sessão confere se o usuário está ativo, mas não se a senha mudou. Um cookie roubado vale 7 dias (`src/lib/session.ts:9`) mesmo depois da troca.
- Correção: guardar `sessionVersion` (ou `passwordChangedAt`) no usuário e conferir no `getSession`. **⚠ exige migration.**

**S-5 · Exportações CSV aceitam fórmulas (CSV injection)**
- `src/lib/csv.ts:14`: um nome que comece com `=`, `+`, `-` ou `@` (cadastro de candidato, pessoa ou reunião) vira fórmula ao abrir no Excel.
- Correção: prefixar essas células com `'`. Muda o texto exportado só nesses casos.

**S-6 · `/api/manter-ativo` aberto quando `CRON_SECRET` não está definido**
- `src/app/api/manter-ativo/route.ts:16-19`. O impacto é pequeno (só `SELECT 1`), mas qualquer um pode acordar o banco. Correção: exigir o segredo em produção. **Teste manual: conferir se `CRON_SECRET` existe na Vercel.**

**S-7 · Login revela pelo tempo de resposta se o e-mail existe**
- `src/app/login/actions.ts:50`: e-mail inexistente responde sem rodar o bcrypt, então volta mais rápido. Correção: comparar com um hash fictício.

**S-8 · Arquivo de reunião devolvido com o `Content-Type` enviado pelo usuário**
- `src/app/api/reunioes/arquivo/[arquivoId]/route.ts:22`. O `attachment` + `nosniff` já seguram o risco; fica melhor validar a extensão no upload (`src/app/(app)/empresas/[id]/reunioes/actions.ts:423`) e forçar uma lista de tipos permitidos.

**S-9 · Dependências com vulnerabilidade conhecida (`npm audit`)**
- `sharp` (libvips/libheif/librsvg) e `source-map-js`: correção sem quebra (`npm audit fix`).
- `postcss` via `next` (só no build) e `deepmerge-ts` via `prisma` (só CLI): a correção exige Next 16 e Prisma 7, que são versões maiores. Fica como recomendação, não entra nesta auditoria.

**S-10 · Módulo Gestão (despesas da consultoria) aberto para MEMBRO** — **⚠ regra de negócio, preciso que você decida**
- `src/app/(app)/gestao/page.tsx:15` e `src/app/(app)/gestao/actions.ts:18-150` usam só `requireSession`. Se despesas forem só da administração, passa a exigir ADMIN no servidor e no menu. Se todos devem ver, fica como está.

**S-11 · `scripts/reset-db.mjs` apaga todas as empresas sem perguntar**
- `scripts/reset-db.mjs:18`: se o `.env` estiver apontando para a nuvem, apaga a produção. Correção: pedir confirmação e recusar URLs que não sejam locais sem `--forcar`.

**P-3 · Importação de AFD faz uma consulta por pessoa**
- `src/app/(app)/empresas/[id]/ponto/actions.ts:458` (N+1). Correção: buscar todas as marcações do período numa consulta só.

**P-4 · Remarcar encontros e renomear plano fazem updates em série, sem transação**
- `src/app/(app)/empresas/[id]/planejamento/actions.ts:196-203` e `:572-580`; `src/app/(app)/empresas/[id]/treinamentos/actions.ts:220` (cópia de treinamentos). Lentidão proporcional ao número de encontros e risco de ficar pela metade se cair no meio. Correção: `prisma.$transaction`.

**P-5 · Copiar plano para outra filial lê os arquivos binários das reuniões**
- `src/app/(app)/empresas/[id]/planejamento/actions.ts:625` seleciona `data` (até 25 MB por arquivo) para duplicar. Correção: copiar no banco com `INSERT ... SELECT` ou referenciar o mesmo arquivo.

**P-6 · Bater o ponto carrega todos os funcionários da empresa**
- `src/app/ponto/[token]/actions.ts:58`: lê todos com PIN para achar um CPF. Correção: guardar o CPF normalizado (só dígitos) e buscar direto. **⚠ exige migration**; sem ela dá para filtrar por `endsWith` dos últimos dígitos.

**P-7 · 30 chaves estrangeiras sem índice** — **⚠ exige migration**
- Advisor de performance do Supabase. As mais usadas nas telas: `Meeting.planoId`, `Meeting.serviceId`, `Employee.cargoId`, `Employee.branchId`, `Candidate.etapaId`, `TesteEnviado.companyId`, `PontoOcorrencia.employeeId`, `PontoLancamento.companyId`. Lista completa no advisor.

**C-1 · ESLint não configurado**
- `package.json` (`"lint": "next lint"`): o comando abre o assistente interativo e não verifica nada. A regra "lint precisa passar" não pode ser cumprida hoje. Correção: `eslint.config.mjs` com `next/core-web-vitals` + `next/typescript` e o script `eslint .`.

**C-2 · Nenhum `error.tsx`**
- `src/app/` não tem `error.tsx` nem `global-error.tsx`. Uma falha do banco mostra a tela padrão do Next em inglês. Correção: telas de erro em português no `(app)` e na raiz.

**C-3 · Server Actions chamadas sem tratamento de falha de rede**
- 89 `startTransition(...)` nos componentes, nenhum com `try/catch`. Exemplos: `src/components/agenda-calendar.tsx:253`, `src/components/pdi-cargos.tsx:191`, `src/components/selecao-vagas.tsx:122`. Se a conexão cair, o clique some sem aviso. Correção: um helper compartilhado que mostra a mensagem.

**D-1 · Textos de 8 a 11 px e cinza claro demais**
- 384 usos de `text-[8px]` a `text-[11px]` e 271 de `text-slate-400` (contraste ~2,6:1 no branco, abaixo do mínimo 4,5:1 da WCAG AA). Correção: escala tipográfica em tokens e `slate-500` no lugar de `slate-400` em texto. **⚠ muda a aparência.**

**D-2 · Diálogos nativos `alert()`/`confirm()` misturados com modais próprios**
- 79 chamadas em 23 componentes (ex.: `src/components/pdi-avaliacao.tsx`, `src/components/meeting-record.tsx`). Correção: um `ConfirmDialog` e avisos no padrão do sistema. **⚠ muda a aparência.**

**D-3 · Modais sem acessibilidade básica**
- Três cópias de `Modal` (`src/components/pdi-plano.tsx:95`, `src/components/treinamentos-tela.tsx:99`, `src/components/agenda-calendar.tsx:757`) sem `role="dialog"`, `aria-modal`, Esc para fechar ou foco preso. Só `src/components/new-meeting-dialog.tsx:65-80` faz certo. Correção: um `Modal` único em `src/components/ui.tsx`.

**D-4 · Alvos de toque pequenos**
- Medido com Playwright em 375 px: 29 botões/links menores que 24 px em `/configuracoes` e 22 em `/empresas/[id]/pdi` (setas de ordenar, ícones de excluir). Correção: área mínima de 24 a 44 px.

### ⚪ Baixo

- **S-12** · `src/lib/rate-limit.ts:22`: o IP vem do primeiro valor de `x-forwarded-for`. Na Vercel é confiável; fora dela pode ser forjado. Só documentar.
- **S-13** · Campos de texto sem tamanho máximo em parte das actions (ex.: `src/app/(app)/selecao/actions.ts:43`, `src/app/(app)/empresas/[id]/planejamento/actions.ts:41`), ao contrário de `treinamentos` e `pdi`. Padronizar com o `texto()` que já corta.
- **P-8** · `src/app/(app)/empresas/[id]/equipe/page.tsx:24` lê todas as ocorrências de cada pessoa só para contar. Trocar por `groupBy`.
- **P-9** · O layout da empresa (`src/app/(app)/empresas/[id]/layout.tsx:65`) dispara 9 consultas a cada troca de aba. Medido local: 600 a 1.000 ms por página com banco vazio. Cachear os contadores por requisição.
- **P-10** · `src/app/(app)/layout.tsx:13` busca todas as empresas em toda página, para o seletor do menu. Aceitável hoje; vira gargalo com centenas de clientes.
- **C-4** · Exports sem uso: `excluirCandidato` (`src/app/(app)/selecao/actions.ts:517`), `umAnoDepois` (`src/lib/dates.ts:39`), `SITUACOES` (`src/lib/selecao.ts:41`), `Linha` e `Progresso` (`src/components/ui.tsx:291`, `:342`).
- **C-5** · Funções duplicadas: `texto()` em 5 arquivos, `refresh()` em 12, `paraInput()` em 2 (`src/app/(app)/empresas/[id]/dados/page.tsx:21`, `src/app/(app)/empresas/[id]/equipe/[pessoaId]/page.tsx:21`), `semAcento()` em 2 (`src/lib/text.ts:4`, `src/lib/testes-cadastrados.ts:73`), `avisar()` em 3, `Modal` em 3.
- **C-6** · `src/app/(app)/testes/actions.ts:21` revalida `/testes/${id}`, rota que não existe (as reais são `/testes/cadastro/[id]` e `/testes/resultado/[id]`).
- **C-7** · `src/components/testes-painel.tsx:58` silencia `react-hooks/exhaustive-deps`; revisar quando o lint existir.
- **C-8** · Comentário desatualizado em `scripts/reset-db.mjs:6-8` (fala de tarefas, metas e projetos que já saíram do banco).
- **C-9** · `package.json#prisma` está obsoleto (aviso do Prisma 6); migrar para `prisma.config.ts`.
- **D-5** · Cores soltas repetidas fora da paleta: `#f4f7fa` em 4 lugares e `globals.css:37`, `#14293f`/`#0d1b2a` no menu (`src/components/sidebar.tsx:211`). Viram tokens.
- **D-6** · Raios e sombras sem padrão (`rounded`, `-md`, `-lg`, `-xl` usados para o mesmo tipo de cartão). Definir 2 ou 3 níveis.
- **D-7** · Em 375 px o cartão da empresa com nome longo estoura 19 px para a direita (`src/app/(app)/empresas/page.tsx`, falta `min-w-0`/`truncate`). Nas outras 24 rotas, sem overflow em 375, 768, 1280 e 1920.
- **D-8** · Em 375 px as abas da empresa viram uma lista vertical de 10 itens antes do conteúdo (`src/components/company-tabs.tsx`). Sugestão: abas roláveis na horizontal.
- **D-9** · Campos sem rótulo associado: busca de empresas, `/testes`, 2 em `/empresas/[id]/dados`, 1 em `/empresas/[id]/equipe` (medido com Playwright).
- **D-10** · Inputs com `outline-none` sem anel de foco substituto (`src/components/agenda-calendar.tsx:1918`, `src/components/treinamentos-tela.tsx:458`, `src/components/expense-grid.tsx:91`, `src/components/pdi-avaliacao.tsx:140`, `src/components/pdi-plano.tsx:362`).

---

## 3. Fase 2 — as 10 piores ofensoras de performance

| # | Onde | Impacto estimado |
|---|---|---|
| 1 | P-2 banco de horas desde o início (`src/lib/ponto-dados.ts:236`) | cresce todo dia; segundos por página depois de alguns meses |
| 2 | P-1 uploads em `bytea` e limite de 4,5 MB | falha total acima de 4,5 MB; banco enche |
| 3 | P-5 cópia de plano lendo binários (`planejamento/actions.ts:625`) | até dezenas de MB por clique |
| 4 | P-3 AFD com N+1 (`ponto/actions.ts:458`) | 1 consulta por pessoa; ~50 idas ao banco numa empresa de 50 pessoas |
| 5 | P-6 bater ponto lendo todos os funcionários (`ponto/[token]/actions.ts:58`) | 1 leitura completa por batida, no horário de pico |
| 6 | P-4 updates em série sem transação (`planejamento/actions.ts:572`) | 2 a 3 idas ao banco por encontro |
| 7 | P-7 FKs sem índice | varreduras completas nas tabelas que mais crescem |
| 8 | P-9 9 consultas no layout da empresa | 600 a 1.000 ms locais por aba |
| 9 | P-8 contagem de ocorrências lendo linhas (`equipe/page.tsx:24`) | cresce com o histórico de cada pessoa |
| 10 | P-10 lista de todas as empresas em toda página | pequeno hoje |

O bundle está saudável (103 kB compartilhado, maior página 125 kB) e não há imagens; não há ganho relevante em code splitting.

---

## 4. Recomendações de arquitetura (fora do escopo das fases)
- Arquivos no Supabase Storage em vez de `bytea` (resolve P-1 e P-5 de vez).
- Saldo do banco de horas fechado por mês, guardado em tabela (resolve P-2).
- Quebrar componentes gigantes: `src/components/agenda-calendar.tsx` (2.099 linhas), `src/components/meeting-record.tsx` (1.033), `src/components/treinamentos-tela.tsx` (973).
- Atualizar para Next 16 e Prisma 7 numa tarefa própria (S-9).
- Se um dia houver consultores que só atendem algumas empresas, criar vínculo usuário ↔ empresa.

---

## 5. Plano das próximas fases

| Fase | Entra sem nova aprovação | Precisa do seu ok |
|---|---|---|
| 1 Segurança | S-2, S-3, S-5, S-6, S-7, S-8, S-9 (só o `audit fix` sem quebra), S-11, S-12, S-13 | S-1 (RLS), S-4 (migration), S-10 (Gestão só para ADMIN?) |
| 2 Performance | P-3, P-4, P-5, P-8, P-9 e o essencial de P-2 | P-1 (limite visível), P-6 e P-7 (migrations) |
| 3 Código | C-1 a C-9 | nada |
| 4 Design | D-3, D-5, D-6, D-7, D-9, D-10 | D-1, D-2, D-4, D-8 (mudam a aparência) |

As skills `frontend-design` e `web-design-guidelines` não estão instaladas nesta sessão. Na Fase 4 sigo as mesmas práticas (WCAG AA, tokens, medição com Playwright nas 4 larguras).

## Entrega final
Branch `audit/2026-10-15-jcjeum`, um commit por fase e por tema. Ao fim de cada fase passaram build, lint (`npm run lint`), typecheck (`npm run typecheck`) e os 266 testes (`npm test`).

### Corrigido

| Código | O que mudou |
|---|---|
| S-1 🔴 | RLS ligado em todas as tabelas e acesso dos papéis `anon`/`authenticated` revogado (migration `20261015120000_rls_e_permissoes`). Conferido no Supabase: 0 tabelas sem RLS, 0 permissões para `anon`. |
| S-3 | Cabeçalhos de segurança (CSP, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy, HSTS) e `poweredByHeader: false` em `next.config.ts`. |
| S-4 | Trocar a senha derruba as outras sessões (`User.sessionVersion`, migration `20261015130000_versao_da_sessao`). |
| S-5 | Login com tempo de resposta igual para e-mail existente ou não. |
| S-7 | Apresentação só aceita PDF, PPT(X), ODP, Key, PNG e JPG, com tipo tirado da extensão (`src/lib/apresentacao.ts`). |
| S-8 | Exportação CSV neutraliza fórmulas (`=`, `+`, `-`, `@`) para não rodarem no Excel. |
| S-9 (parcial) | `npm audit fix` aplicado (sharp, source-map-js). |
| S-10 | Gestão só para ADMIN (página, actions e menu). |
| S-11 | `scripts/reset-db.mjs` só roda em banco local, salvo `--nuvem` e digitando APAGAR. |
| S-13 | Textos dos formulários com tamanho máximo (`textoDoFormulario`). |
| P-1 | Apresentação limitada a 4 MB, avisando antes do envio (o limite da Vercel é 4,5 MB). |
| P-4, P-5 | Planos atualizam encontros em paralelo; replicar plano copia arquivos dentro do banco, sem trazer o binário. |
| P-7 | 18 índices nas chaves estrangeiras (migration `20261015140000_indices_das_chaves`). |
| P-8 | Equipe conta ocorrências com `groupBy`. |
| C-1 a C-8 | ESLint configurado e sem avisos, scripts `lint`/`typecheck`, telas de erro e 404 em português, código morto removido, funções repetidas centralizadas, revalidação no caminho certo, comentário do reset atualizado. |
| D-1 a D-10 | Avisos e confirmações no visual do sistema (no lugar de `alert`/`confirm`), uma janela modal acessível (Esc, foco preso e devolvido), tipografia mínima de 11 px, contraste do cinza, tokens de cor, foco visível, alvos de toque maiores no celular, abas da empresa roláveis no celular, cartões sem estouro em 375 px e rótulos nos campos. Conferido com Playwright em 23 telas a 375, 768, 1280 e 1920 px: nenhuma rola para o lado. |

As três migrations já foram aplicadas no Supabase de produção e registradas em `_prisma_migrations`, então o `db:deploy` do próximo deploy as pula.

### Pendente, e por quê

- **Ponto (S-2, P-2, P-3, P-6):** fora do escopo por decisão sua; o ponto sairá do sistema.
- **S-6 (cron sem segredo):** a Vercel não tem `CRON_SECRET`. Exigir o segredo no código antes de criá-lo pararia o cron que mantém o banco acordado. Crie `CRON_SECRET` na Vercel; depois disso a checagem em `src/app/api/manter-ativo/route.ts` pode ser ligada.
- **S-9 (resto):** os avisos restantes (postcss dentro do Next, deepmerge-ts do Prisma) só somem com Next 16 e Prisma 7, que são atualizações grandes.
- **S-12:** o IP do limite de tentativas vem de `x-forwarded-for`, confiável na Vercel. Fica só documentado.
- **P-9, P-10:** as consultas do layout já rodam em paralelo; cache traria contadores desatualizados. Rever quando houver centenas de empresas.
- **C-9:** migrar para `prisma.config.ts` faz o Prisma parar de ler o `.env` sozinho; melhor junto com o Prisma 7.
- **Recomendações de arquitetura:** arquivos de reunião no banco em vez de um storage, e as demais da seção de arquitetura acima.
- **Alvos pequenos:** links de texto dentro de tabelas e uma caixa de seleção continuam abaixo de 24 px.
- **Supabase advisor:** mostra “RLS enabled, no policy” como informação. É o esperado: o app entra como `postgres`, que ignora RLS, e ninguém de fora deve ler as tabelas.

### Teste manual em produção (depois do merge)

1. Entrar e sair.
2. Trocar a senha de um usuário com ele logado em outro navegador: a outra sessão deve cair para o login.
3. Entrar como MEMBRO: Gestão não aparece no menu e `/gestao` volta para Empresas.
4. Enviar uma apresentação menor que 4 MB (deve funcionar) e uma maior (deve recusar com aviso).
5. Exportar um CSV e abrir no Excel.
6. Excluir algo com confirmação; na agenda, excluir um compromisso de série (“Esta e as seguintes” / “Só este dia”).
7. Abrir a ficha de uma empresa no celular: abas numa faixa que rola para o lado.
8. Usar o ditado por voz (o microfone continua liberado).
9. Replicar um plano que tenha arquivos e conferir os arquivos na cópia.
10. Copiar o catálogo de treinamentos para outra empresa.
11. Na Vercel, conferir que o cron `/api/manter-ativo` segue rodando.
