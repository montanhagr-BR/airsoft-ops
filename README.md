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

O teste integrado usa armazenamento local do navegador. As salas online usam Supabase para autenticacao, dados e atualizacoes entre aparelhos. Consulte `SUPABASE-SETUP.md` para configurar o banco.

## Documentação

- `outputs/manual-beta-tester.md`
- `outputs/esquema-modo-bomba.md`

## Estado do projeto

O aplicativo Android esta em desenvolvimento e abre as interfaces web em uma WebView com recursos locais e comunicacao Supabase. A maquina de estados Kotlin tem testes separados; o fluxo visual utilizado no app ainda precisa de testes de aparelho e reconexao.
# Google Maps tático

O módulo de mapas aceita fotografia aérea do Google Maps, bases de saída, jogadores, artefatos e áreas circulares com visibilidade por equipe.

1. No Google Cloud, habilite a **Maps JavaScript API** e o faturamento do projeto.
2. Crie uma chave de API e aplique restrições adequadas antes de publicar.
3. Copie `outputs/maps-config.example.js` para `outputs/maps-config.js` e informe a chave.
4. Para gerar o APK, faça o mesmo em `android-app/app/src/main/assets/www/maps-config.js`.

Sem uma chave válida, o sistema mantém o mapa esquemático offline como alternativa.

# Portal web

A página `outputs/index.html` e o inicio compartilhado pelo site e Android. O login aparece ao acessar; a sessao e mantida para usos posteriores. O painel permite criar operacoes, entrar como Controle, Artefato ou Jogador e preparar inscricoes antecipadas por link.

Execute `supabase/migrations/005_pre_registration.sql` para ativar as inscricoes. Consulte `REVISAO-E-MELHORIAS.md` para o fluxo, limites atuais e opcoes visuais, de sistema e jogabilidade. Os testes locais do portal podem ser executados com `node tests/portal.test.cjs`.

