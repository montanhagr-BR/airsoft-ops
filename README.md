# Airsoft Ops

Sistema cenográfico para jogos de airsoft. O repositório agora contém o protótipo visual HTML e o início do aplicativo Android nativo.

## Aplicativo Android

A primeira versão nativa está em `android-app/` e usa Kotlin com Jetpack Compose. Ela já contém uma fatia funcional do modo Bomba com os módulos Controlador, Artefato e Jogador, cronômetros e uma máquina de estados testável.

Consulte `android-app/README.md` para requisitos e próximos passos.

## Protótipo HTML

O protótipo é composto por três interfaces sincronizadas:

- `controle.html`: configuração e operação pelo Controlador.
- `bomba.html`: artefato, bomba, notebook e terminal.
- `jogador.html`: objetivos, ações e localização no celular.

## Executar o protótipo

Abra `outputs/teste-integrado.html` para testar as três interfaces juntas ou abra separadamente:

- `outputs/controle.html`
- `outputs/bomba.html`
- `outputs/jogador.html`

As telas trocam informações pelo armazenamento local do navegador. Para testes entre aparelhos reais será necessário substituir essa comunicação por um servidor, Wi-Fi ou Bluetooth.

## Documentação

- `outputs/manual-beta-tester.md`
- `outputs/esquema-modo-bomba.md`

## Estado do projeto

O aplicativo Android está em desenvolvimento. A versão nativa atual compartilha o estado apenas dentro do processo; o próximo marco será persistência local e pareamento real antes da integração com a nuvem.
# Google Maps tático

O módulo de mapas aceita fotografia aérea do Google Maps, bases de saída, jogadores, artefatos e áreas circulares com visibilidade por equipe.

1. No Google Cloud, habilite a **Maps JavaScript API** e o faturamento do projeto.
2. Crie uma chave de API e aplique restrições adequadas antes de publicar.
3. Copie `outputs/maps-config.example.js` para `outputs/maps-config.js` e informe a chave.
4. Para gerar o APK, faça o mesmo em `android-app/app/src/main/assets/www/maps-config.js`.

Sem uma chave válida, o sistema mantém o mapa esquemático offline como alternativa.

# Portal web

A página `outputs/index.html` é o acesso para notebooks usados como Controle ou Artefato. Ela oferece cadastro por e-mail/senha e login Google, mas não cria jogos. Consulte `AUTENTICACAO-WEB.md` para ativar os provedores e executar a migração de segurança do Controle.

