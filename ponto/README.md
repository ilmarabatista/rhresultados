# Ponto — RH Resultados

O registro de ponto dos colaboradores das empresas atendidas pela RH Resultados.
É um sistema à parte do RH: outro endereço, outro banco (o schema `ponto`), outro
login. Os dois conversam por uma API protegida pela chave `INTEGRACAO_SECRET`.

## Quem usa o quê

- **Administrador** (`/admin`): cria o ponto de uma empresa escolhendo da lista do
  RH, informa o horário padrão e cadastra os colaboradores pelo email. A senha do
  primeiro acesso é `12345`, trocada obrigatoriamente no primeiro login.
- **Colaborador** (`/`): vê os pontos do dia e registra a batida. O aplicativo pede a
  localização, abre a câmera da frente, mostra a foto e pergunta se quer tirar outra
  ou concluir. A hora é sempre a do servidor. Em `/relatorios` ele confere o espelho
  que o RH enviou e confirma que está ciente.
- **RH Resultados**: Empresa → Ponto → Colaboradores → Horários. Lá ficam os
  ajustes (incluir batida faltante, anular, feriados, férias, atestados, banco de
  horas), as regras, o relatório individual e a planilha do mês.

## A integração

| Momento | Quem chama | Caminho |
| --- | --- | --- |
| 1. Lista de empresas | ponto → RH | `GET {RH_URL}/api/integracao/empresas` |
| 2. Ler e ajustar o ponto | RH → ponto | `{PONTO_URL}/api/rh/empresas/<id da empresa no RH>/...` |

As duas pontas exigem `Authorization: Bearer <INTEGRACAO_SECRET>`.

## Horário padrão e horas extras

Cada empresa tem um horário por dia da semana (ex.: `08:00-12:00 13:00-17:00`). O
que é trabalhado fora dele é hora extra (50% em dia útil, 100% em domingo sem
expediente e feriado); o que dele fica sem trabalhar é atraso ou falta. A
tolerância diária (padrão 10 min, CLT art. 58 §1º) zera variações pequenas. O
colaborador pode ter horário próprio, ajustado no RH.

## Rodar no computador

```bash
cp .env.example .env          # ajuste DATABASE_URL (?schema=ponto) e as chaves
npm install
npx prisma migrate deploy
node --env-file=.env node_modules/.bin/tsx scripts/criar-admin.ts
npm run dev                   # http://localhost:3001
```

## Publicar

Um projeto próprio na Vercel apontando para este repositório, com **Root Directory
= `ponto`**. Variáveis: `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, `RH_URL`,
`INTEGRACAO_SECRET`. No RH, configurar `PONTO_URL` e a mesma `INTEGRACAO_SECRET`.
