# Contas e autenticação — Airsoft Ops

O portal usa Supabase Auth para contas, verificação de e-mail, senhas e sessões. Senhas são enviadas diretamente ao serviço pelo SDK e não são gravadas no armazenamento local do site.

## Fluxos

- Cadastrar: nome/indicativo e e-mail, depois senha e confirmação. Mostra instruções de confirmação ou abre o painel quando o serviço devolve uma sessão.
- Entrar: mensagens em português para credenciais incorretas, e-mail não confirmado, limite de tentativas e falha de conexão.
- Confirmar e-mail: formulário independente para solicitar outro link sem repetir o cadastro.
- Recuperar: solicita um link e mostra uma resposta neutra, sem revelar se a conta existe.
- Nova senha: retorno com flow=recovery e sessão válida abre o formulário; links expirados oferecem nova solicitação. Depois de atualizar, remove o contexto de recuperação da URL.
- Sair: encerra a sessão e remove as conexões locais dos módulos.

Envios simultâneos são bloqueados. Pedidos de e-mail têm intervalo de um minuto na interface; os limites efetivos são impostos pelo Supabase.

## Configuração do serviço

1. Habilite o provedor Email e o cadastro de usuários no Supabase. Para produção, habilite confirmação de e-mail.
2. Configure SMTP próprio, com remetente e domínio verificados no provedor. O serviço padrão do Supabase restringe destinatários aos membros da equipe do projeto; sem SMTP próprio, o envio para o público pode falhar.
3. Em URL Configuration, informe https://warm-hummingbird-8988f6.netlify.app/ como Site URL. Permita os caminhos e parâmetros do portal em Redirect URLs, por exemplo https://warm-hummingbird-8988f6.netlify.app/**. Inclua somente os ambientes de teste utilizados.
4. Nos modelos Confirm signup e Reset password, mantenha o link {{ .ConfirmationURL }} para validar o token antes de retornar ao site. Um link direto à página inicial não verifica o token.
5. Configure limites e proteção contra abuso no Supabase. Credenciais SMTP e chaves administrativas ficam no serviço, nunca no JavaScript público.
6. Para Google, habilite o provedor e configure o cliente OAuth com o callback indicado no Supabase. O Client Secret fica somente no serviço.

O fallback local Android encaminha links de e-mail ao site público. Uma sessão criada no navegador não é transferida automaticamente para a WebView local.

## Publicação e testes

Publique a pasta outputs conforme netlify.toml. Ela precisa de supabase-config.js com URL e chave pública do projeto. Os arquivos do portal também estão sincronizados em android-app/app/src/main/assets/www para gerar outro APK.

Testes locais:

- node tests/portal.test.cjs
- node tests/room-navigation.test.cjs
- node tests/preparation.test.cjs

Os testes simulam o serviço e não confirmam entrega de e-mails. Após publicar e configurar SMTP, valide com uma conta de teste: cadastro, confirmação, login, logout, recuperação, troca de senha, login com a nova senha e rejeição de link expirado ou já utilizado. Consulte Auth Logs quando a solicitação falhar ou o e-mail não chegar.

Documentação oficial:

- https://supabase.com/docs/guides/auth/passwords
- https://supabase.com/docs/guides/auth/auth-smtp
- https://supabase.com/docs/guides/auth/debugging/error-codes
