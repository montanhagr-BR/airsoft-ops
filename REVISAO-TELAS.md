# Revisão das telas — 05/10/2026

O site móvel e o Android usam o mesmo portal e os mesmos arquivos HTML, CSS e JavaScript. O Android abre index.html em uma única WebView; não existe mais uma seleção nativa paralela que possa contornar o login.

## Telas verificadas

- Início, login, cadastro de dados e senha, confirmação do cadastro, reenvio de confirmação, recuperação, aviso de envio e nova senha.
- Painel de operações, inscrição antecipada e organização da lista de espera.
- Controle: operação, configuração, pré-cadastro/equipes e mapa.
- Jogador: objetivos, terminal, localizador e equipe.
- Artefato: cadastro do aparelho, bomba, roubo de dados, dominação e localização.

## Acessos e navegação

- Os módulos exigem uma conta não anônima. A entrada direta mostra orientação para acessar o painel.
- Abrir o Controle exige que o usuário seja o proprietário da sala, inclusive quando existe uma conexão salva. As políticas do banco continuam responsáveis por autorizar leitura e escrita no servidor.
- O painel e os módulos mantêm o contexto Android nas navegações.
- O botão Voltar do Android retorna ao painel nos módulos, volta ao login nas abas de autenticação e ao início quando adequado. Ele não usa o histórico para reabrir uma sala depois de sair.
- QR Codes de sala usam o site público e preenchem o código no painel.
- O Artefato usa paisagem no Android; voltar ao painel libera a orientação.
- Celular no navegador e WebView aplicam as mesmas regras de layout móvel.

## Validação

- 114 capturas em navegador, nos contextos web e Android, a 320, 390 e 412 pixels. Sem erros JavaScript ou rolagem horizontal nessas telas.
- 23 telas abertas na WebView real do emulador Android, com capturas da tela do emulador e teste do botão Voltar nativo em Controle, Jogador e Artefato.
- Verificação de acesso sem conta nos três módulos e rejeição de uma conexão de Controle pertencente a outro proprietário.
- Testes locais de portal, navegação e preparação passaram. Testes Kotlin e geração do APK 0.7.2 passaram.

Os testes visuais usam um serviço simulado e bloqueiam serviços externos. Eles não validam envio real de e-mail, OAuth Google, câmera, localização física, imagem de satélite ou sincronização entre aparelhos em campo. Os testes preservam o armazenamento anterior do emulador. Evidências locais ficam em work/revisao-telas.

Execute tests/interface-review.cjs com Playwright disponível para repetir a revisão do navegador. Para tests/android-interface-review.cjs, abra o APK debug no emulador e exponha a porta de depuração da WebView na porta local 9223 por adb. O APK para instalação está em outputs/Airsoft-Ops-0.7.2.apk.
