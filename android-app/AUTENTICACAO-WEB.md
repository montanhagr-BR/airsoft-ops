# Autenticação Web e Portal para Notebooks - Airsoft Ops

Este documento descreve o funcionamento e os passos para configurar a autenticação e o portal web do **Airsoft Ops / Montanha Bomb System**, permitindo que usuários acessem via navegador no computador/notebook como **Artefato (Bomba)** ou **Controle**.

---

## 🚀 Recursos do Portal Web

- **Identidade Visual Oficial**: Estilização baseada no tema Montanha Bomb System (`airsoft-brand.css`), com fundo de marca oficial sem distorção.
- **Autenticação Dupla**:
  - Cadastro e Login tradicional com **E-mail e Senha**.
  - Login com um clique utilizando **Conta Google (OAuth)**.
  - Recuperação de senha por e-mail.
- **Proteção do Controlador**:
  - Apenas o proprietário/criador da sala (identificado via `created_by` no Supabase) pode entrar no modo **Controle** daquela sala.
  - Tentativas não autorizadas de entrar no Controle de salas alheias são bloqueadas.
- **Sessões Compartilhadas**:
  - Salva a conexão ativa no `localStorage` sob a chave `airsoft-cloud-session-v1-controller` ou `airsoft-cloud-session-v1-artifact`, sincronizando perfeitamente com `bomba.html` e `controle.html`.

---

## 🛠️ Passos de Configuração no Supabase

### 1. Executar o Script SQL de Banco de Dados

1. Acesse o painel do Supabase no seu projeto (`https://app.supabase.com`).
2. Vá em **SQL Editor** → **New query**.
3. Copie todo o conteúdo do arquivo `004_rejoin_controller.sql` (disponível em `app/src/main/assets/www/004_rejoin_controller.sql`).
4. Clique em **Run** para executar e criar as funções e tabelas:
   - Tabela `game_sessions` (com coluna `created_by`).
   - RPC `create_game_session` (salva o `auth.uid()` do criador).
   - RPC `join_game` (valida permissão de controle para o proprietário da sala).

### 2. Habilitar o Provedor Google (OAuth)

1. No Supabase, vá para **Authentication** → **Providers** → **Google**.
2. Alterne para **Enabled**.
3. Insira o **Client ID** e o **Client Secret** obtidos do [Google Cloud Console](https://console.cloud.google.com/).
4. No Google Cloud Console, adicione o **Authorized redirect URI** fornecido pelo Supabase (ex.: `https://<seu-projeto>.supabase.co/auth/v1/callback`).

### 3. Configurar URLs de Redirecionamento (Netlify)

1. No Supabase, vá em **Authentication** → **URL Configuration**.
2. No campo **Site URL**, insira a URL pública principal do Netlify:
   ```text
   https://warm-hummingbird-8988f6.netlify.app/
   ```
3. No campo **Redirect URLs**, adicione as seguintes URLs:
   ```text
   https://warm-hummingbird-8988f6.netlify.app/
   https://warm-hummingbird-8988f6.netlify.app/**
   http://localhost:3000/
   ```

---

## 📦 Publicação no Netlify

Após alterar e salvar as configurações, envie os arquivos da pasta `assets/www` para o Netlify:
- `index.html` (Portal Principal)
- `portal.css`
- `portal.js`
- `supabase-config.js`
- `airsoft-cloud.js`
- `bomba.html`, `controle.html`, `jogador.html`
- Pasta `assets/` (imagens de fundo e marcas)

Acesse **https://warm-hummingbird-8988f6.netlify.app/** no seu navegador para testar a experiência completa no notebook!
