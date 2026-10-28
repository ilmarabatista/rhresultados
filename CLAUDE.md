# Regras do projeto

## Nada vai para a `main` sem a aprovação da Ilmara

A `main` é o que está no ar (rhresultados.vercel.app e
rhresultados-ponto.vercel.app). Toda alteração, por menor que seja, passa
antes por um destes dois lugares:

1. **localhost**: o RH roda em `http://localhost:3000` (`npm run dev`, ou
   `iniciar.bat` no computador da Ilmara) e o ponto em
   `http://localhost:3001` (`cd ponto && npm run dev`).
2. **dev da Vercel**: o branch fixo `dev`. Cada push nele gera um preview, e
   o link abaixo sempre aponta para o último preview do `dev`:
   - RH: https://rhresultados-git-dev-disc12.vercel.app
   - Ponto: https://rhresultados-ponto-git-dev-disc12.vercel.app

Como fazer:

- Trabalhe no branch da tarefa e abra a PR para a `main`, mas **não faça o
  merge**.
- Para mostrar na Vercel, leve o branch da tarefa para o `dev`
  (`git push origin <branch-da-tarefa>:dev`, ou merge no `dev`) e mande à
  Ilmara **o link fixo do dev acima**. Nunca o link de um deploy específico
  (aquele com letras aleatórias no meio), porque ele muda a cada push.
- Diga a ela o que conferir e espere o ok dela, escrito na conversa.
- Só depois do ok: merge da PR na `main`.
- Se o `dev` estiver com o trabalho de outra tarefa ainda sem ok, avise a
  Ilmara antes de sobrescrever.

## Banco, migrations e secrets

O preview do `dev` pode estar usando o mesmo banco de produção (Supabase).
Então testar no dev mexe em dados reais, e migrations nunca rodam sozinhas
(o build da Vercel não roda `migrate`). Qualquer mudança em banco,
migrations, secrets ou regra de negócio precisa do ok da Ilmara antes, como
sempre.

## Respostas por link nunca somem sem confirmação

Regra da Ilmara (28/10/2026), depois que o questionário de cargo de uma
colaboradora sumiu ao juntar dois cargos. Valem como resposta: questionário
de cargo e autoavaliação respondidos, mapeamento de rotinas enviado, resposta
da pesquisa de clima e ficha de solicitação preenchida.

- Toda exclusão que leve resposta junto (do próprio envio, do cargo, da
  pessoa, da pesquisa, da vaga ou da empresa) conta antes com
  `respostasQueSomem` e devolve `respostas`; a tela pergunta com
  `excluirComPermissao` e só então apaga, dentro de `apagarComPermissao`
  (`src/lib/respostas-protegidas-dados.ts`).
- No banco, o gatilho `protege_resposta` recusa qualquer outro caminho,
  inclusive cascata. Não remova o gatilho nem contorne `apagarComPermissao`
  para "fazer funcionar": se der o erro "Resposta enviada por link protegida",
  o certo é mover as respostas ou pedir a confirmação.
- Tabela nova que guarde resposta por link entra no gatilho e na contagem.
