# Airsoft Ops

Protótipo de sistema cenográfico para jogos de airsoft, composto por três interfaces sincronizadas:

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

Este repositório contém um protótipo HTML interativo. Ele ainda não é um aplicativo Android nativo e a comunicação atual funciona entre abas do mesmo navegador.
