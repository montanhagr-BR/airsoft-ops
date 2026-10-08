# Atualizações do APK beta

A partir da versão 1.0.0-beta.2, o app consulta a versão publicada ao abrir. Se houver uma versão maior, oferece “Baixar atualização” e “Agora não”. Sem internet, continua funcionando sem bloquear a abertura. A configuração inicial do aparelho termina antes de mostrar o aviso.

Instale esta versão uma vez para ativar o recurso. O download abre no navegador e a instalação exige confirmação do Android. Não há instalação silenciosa. Os APKs beta devem manter a mesma chave de assinatura.

Para publicar uma atualização, aumente versionCode e versionName no Android, gere e teste o APK, publique o arquivo em uma release do GitHub e então atualize outputs/app-update.json com o código, nome e URL do APK. Publique o manifesto apenas depois de disponibilizar o arquivo. Não coloque segredos no manifesto. Esta distribuição beta é independente das atualizações pela Google Play.
