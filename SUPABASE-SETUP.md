# Supabase - Airsoft Ops

## 1. Criar o projeto

1. Crie um projeto em https://supabase.com/dashboard.
2. Abra **SQL Editor**.
3. Execute `supabase/migrations/001_airsoft_ops.sql`.
4. Em **Authentication > Providers**, habilite **Anonymous Sign-Ins**.

Se uma versão anterior da migração já foi executada, execute o arquivo inteiro
novamente. Ele é reaplicável e atualiza as funções existentes sem apagar partidas.

## 2. Dados necessários no aplicativo

Abra **Connect** no painel do projeto e obtenha:

- Project URL, no formato `https://xxxx.supabase.co`.
- Publishable key, iniciada normalmente por `sb_publishable_`.

Nunca coloque a chave `service_role` no aplicativo, HTML, GitHub ou APK.

Este projeto já está configurado em `outputs/supabase-config.js` com a URL e a
chave pública fornecidas. A chave pública pode estar no aplicativo; a proteção
dos dados é feita pelas políticas RLS da migração.

## 3. Modelo de comunicação

- O Controlador cria uma sala e recebe um código de seis caracteres.
- Jogadores e artefatos fazem autenticação anônima e entram usando o código.
- O cadastro fica em `game_members` com estado `pending`.
- O Controlador aprova o aparelho e define equipe ou bomba.
- Ações dos aparelhos entram em `game_events`.
- Somente o Controlador consolida alterações no estado oficial da partida.
- Supabase Realtime distribui estado, cadastros e eventos aos aparelhos conectados.

## Segurança

As tabelas usam Row Level Security. Uma sala só pode ser lida por seus membros, e somente o Controlador pode alterar o estado oficial e aprovar cadastros.
