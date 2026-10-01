# Autenticação do portal web

O portal em `outputs/index.html` permite cadastro e acesso por e-mail/senha ou conta Google. Ele não cria salas. Depois de autenticado, o usuário informa o código de uma sala existente e abre o módulo Artefato ou Controle.

## Preparar o banco

Execute no SQL Editor do Supabase, depois das migrações anteriores:

`supabase/migrations/004_rejoin_controller.sql`

Essa função permite reabrir o Controle somente quando o usuário autenticado é o proprietário que criou a sala.

## E-mail e senha

1. Abra **Authentication > Sign In / Providers** no Supabase.
2. Mantenha o provedor **Email** habilitado.
3. Escolha se novos usuários precisarão confirmar o e-mail.
4. Para produção, configure um SMTP próprio.

## Conta Google

1. No Google Auth Platform, crie um cliente OAuth do tipo aplicação Web.
2. Adicione como URI de redirecionamento autorizado a URL de callback exibida em **Supabase > Authentication > Sign In / Providers > Google**.
3. Copie o Client ID e o Client Secret para o provedor Google no Supabase e habilite-o.
4. Em **Authentication > URL Configuration**, use a URL pública do site como Site URL.
5. Adicione a URL pública e as URLs de preview permitidas na lista de Redirect URLs.

O Client Secret do Google deve existir apenas no painel do Supabase. Nunca coloque esse segredo nos arquivos HTML ou JavaScript.

## Publicação

Publique o conteúdo da pasta `outputs`. O arquivo `supabase-config.js` precisa conter somente a URL do projeto e a chave pública/publishable do Supabase.
