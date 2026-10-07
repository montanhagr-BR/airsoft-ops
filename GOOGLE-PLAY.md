# Preparação para Google Play e mensalidades

Pacote Android: `br.com.airsoftops`. Nome: Montanha Bomb System.
Painel administrativo: `/admin.html`. A conta administrativa indicada é `montanhagr@gmail.com`; esse e-mail foi confirmado no banco e autorizado pelo proprietário como administrador.

## O que está preparado

- Ícone adaptativo, nome do app e build Android App Bundle.
- Build release não usa mais a chave pública de debug. Configure uma chave privada de upload nos segredos do ambiente, nunca no Git.
- Painel protegido por verificações de permissão no servidor, consultas de usuários, jogos, mensalidades e histórico administrativo.
- Migração 013 cria as estruturas administrativas e pagamentos manuais. Não aplica cobrança nem bloqueia os usuários atuais.
- Especificação da assinatura mensal em google-play/subscription-config.json; produto e plano são propostas e devem ser cadastrados no Play Console.

## Ainda necessário para cobrança automática real

1. Confirmado: Google Play, R$ 30 por mês para todos os usuários. O preço final deve ser configurado e conferido no Play Console.
2. Conta Play Console, perfil comercial, produto montanha_monthly com plano monthly e preço. Não há produto ativado ou cobrança automática nesta preparação.
3. Chave privada de upload: ANDROID_UPLOAD_KEYSTORE, ANDROID_UPLOAD_STORE_PASSWORD, ANDROID_UPLOAD_KEY_ALIAS, ANDROID_UPLOAD_KEY_PASSWORD. O AAB local sem essas variáveis está sem assinatura e não deve ser enviado como versão final.
4. Integrar Google Play Billing no Android e validar compras no backend com purchases.subscriptionsv2.get. Nunca liberar acesso apenas pelo token enviado pelo celular.
5. Conta de serviço com acesso mínimo à API do Google Play, guardada nos segredos do servidor. Associar compra ao usuário autenticado por identificador ofuscado; impedir reutilização do token por outro usuário.
6. Reconhecer compras válidas no servidor; tratar pendências, cancelamento, expiração, reembolso, período de graça e suspensão. Configurar notificações de renovação (RTDN) e reconciliação periódica.
7. Implementar e testar as regras de acesso pago no servidor após definir o público. Testar compras com a faixa de testes internos do Play Console antes de ativar monetização.
8. Preencher política de privacidade, segurança de dados, classificação indicativa e declarações de câmera/localização. O app mantém a tela ligada em primeiro plano; não garante funcionamento em segundo plano.

## Administração

Aplicar 013_platform_admin.sql. Para liberar somente o proprietário, conferir que auth.users contém o e-mail confirmado e inserir seu UUID em platform_admins pelo SQL Editor; não fornecer uma rota pública de autoatribuição. As tabelas administrativas não permitem acesso direto aos clientes; as funções verificam auth.uid(). Não há acesso a senhas.

Referências: https://developer.android.com/google/play/billing/integrate ; https://developer.android.com/google/play/billing/lifecycle/subscriptions
