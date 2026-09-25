# Airsoft Ops - Manual do Beta Tester

## Visao geral

Este pacote contem um prototipo HTML do sistema Airsoft Ops para jogos cenograficos de airsoft. Ele simula tres interfaces ao mesmo tempo:

- Controle do Controlador: configura o jogo, cadastra times, inicia, encerra e aplica comandos.
- Bomba / Artefato: tela principal do tablet ou notebook cenografico.
- Jogador: tela do celular do operador CT ou Terrorista.

O prototipo roda localmente no navegador e usa `localStorage` para sincronizar as telas abertas no mesmo computador/navegador.

## Arquivos principais

- `controle.html`: painel do Controlador.
- `bomba.html`: tela do artefato/tablet.
- `jogador.html`: tela do celular do jogador.
- `airsoft-shared.js`: estado compartilhado entre as telas.
- `airsoft-theme.css`: identidade visual militar/tecnologica.
- `esquema-modo-bomba.md`: documento de regras do modo bomba.

## Como abrir

1. Extraia o arquivo `.zip`.
2. Abra `controle.html` em uma aba do navegador.
3. Abra `bomba.html` em outra aba.
4. Abra `jogador.html` em uma terceira aba.
5. Mantenha as tres abas abertas ao mesmo tempo.

Importante: para a sincronizacao funcionar, abra os arquivos no mesmo navegador e a partir da mesma pasta extraida.

## Cadastro dos celulares

Na tela `controle.html`, existem dois QRs cenograficos:

- Time 1 / CT.
- Time 2 / Terrorista.

No prototipo, o celular nao usa camera real. Em `jogador.html`, escolha:

- `Cadastrar Time 1 - CT` para simular um celular CT.
- `Cadastrar Time 2 - Terrorista` para simular um celular Terrorista.

Ao reiniciar o sistema pelo controle, o celular tambem perde o cadastro e precisa ser cadastrado novamente.

## Modo Bomba Classica

Objetivo do Time 2 / Terrorista:

1. Obter a senha de arme, por Controlador ou decodificacao.
2. Pedir a acao de arme pelo celular.
3. Validar QR pelo popup.
4. Aguardar a barra de acao.
5. Digitar a senha na bomba.
6. Se a senha estiver correta, a bomba entra em contagem.
7. Se a contagem terminar, Time 2 vence.

Objetivo do Time 1 / CT:

1. Obter a senha de desarme, por Controlador ou decodificacao.
2. Pedir a acao de desarme pelo celular.
3. Validar QR pelo popup.
4. Aguardar a barra de acao.
5. Digitar a senha na bomba.
6. Se a senha estiver correta, a bomba e neutralizada.
7. Se a bomba for desarmada ou o tempo de jogo terminar, Time 1 vence.

## Modo Roubo de Dados

Neste modo, a tela da bomba vira um notebook cenografico travado. O fluxo principal do Time 2 / Terrorista e:

1. Acessar notebook.
2. Escolher a pasta correta.
3. Baixar dados.
4. Descriptografar arquivo.
5. Enviar dados por email.

### Etapa 1 - Acessar notebook

1. O Terrorista precisa ter a senha do notebook.
2. A senha pode ser entregue pelo Controlador ou obtida por decodificacao.
3. No celular, toque em `Acessar notebook`.
4. A leitura de QR acontece em popup.
5. A barra de acesso roda no celular.
6. Apos a barra, o notebook pede a senha.
7. Digite a senha no teclado numerico da tela `bomba.html`.

### Etapa 2 - Escolher pasta

1. Depois da senha correta, o notebook mostra pastas.
2. O Controlador pode configurar quatro nomes de pasta.
3. O Controlador tambem escolhe qual das quatro e a pasta correta.
4. O operador pode tocar em qualquer pasta no notebook.
5. Se escolher a pasta errada, o sistema registra erro e nao avanca.
6. Ao escolher a pasta correta, o download fica disponivel no celular.

### Etapa 3 - Baixar dados

1. No celular Terrorista, toque em `Baixar dados`.
2. A leitura de QR acontece em popup.
3. O notebook abre popup pedindo `OK` ou `Cancelar`.
4. Se confirmar, a barra de download roda no notebook.
5. Ao final, os dados ficam baixados no notebook.

### Etapa 4 - Descriptografar

1. No celular Terrorista, toque em `Descriptografar dados`.
2. A leitura de QR acontece em popup.
3. O notebook pede a senha de descriptografia.
4. Essa senha e diferente da senha do notebook.
5. A senha de descriptografia pode ser entregue pelo Controlador ou obtida pelo decodificador durante essa etapa.
6. A barra de descriptografia roda no notebook.
7. O operador pode cancelar durante a barra.
8. Ao final, o celular precisa executar `Validar descriptografia`.
9. Apos validar, o arquivo aparece aberto no notebook.

### Etapa 5 - Enviar dados

1. No celular Terrorista, toque em `Enviar dados`.
2. A leitura de QR acontece em popup.
3. O notebook pede o email correto configurado pelo Controlador.
4. Digite o email no teclado QWERTY da tela `bomba.html`.
5. Se o email estiver correto, a barra de envio roda no notebook.
6. Ao final, aparece a tela de email enviado.
7. Time 2 vence.

## Contramedidas CT no Roubo de Dados

O Time 1 / CT pode agir conforme o estado atual do notebook:

- Notebook travado ou pasta aberta: mudar senha / expulsar acesso.
- Dados baixados: apagar download.
- Arquivo descriptografado: deletar dados descriptografados.

As contramedidas tambem exigem validacao por QR em popup e respeitam os tempos configurados pelo Controlador.

## Modo Dominacao de Terminal

Neste modo, a tela da bomba vira um terminal cenografico neutro. Os times disputam o controle acumulando tempo de dominio.

Fluxo principal:

1. O jogador pede para capturar o terminal pelo celular.
2. A leitura de QR acontece em popup.
3. O terminal abre popup pedindo OK ou Cancelar.
4. Se a senha de captura estiver ativa, o teclado do terminal destrava e pede a senha configurada pelo Controlador.
5. Com a senha correta, a barra de captura roda no terminal.
6. Ao final, o terminal passa a pertencer ao time que capturou.
7. O sistema conta o tempo de dominio ate atingir o tempo necessario para vencer.

Revalidacao periodica:

1. Depois do intervalo configurado, o terminal exige revalidacao.
2. Se a senha randomica estiver desligada, basta QR no celular, OK no terminal e barra de guarda.
3. Se a senha randomica estiver ligada, o jogador precisa primeiro usar Decodificar no celular.
4. Ao terminar a decodificacao, a senha aparece no celular.
5. O jogador valida QR, confirma OK no terminal e digita a senha randomica.
6. Se a revalidacao nao terminar dentro da janela configurada, o terminal volta para neutro.

## Configuracoes do Controlador

No painel `controle.html`, o Controlador pode configurar:

- Modo de jogo.
- Nome do Time 1 / CT.
- Nome do Time 2 / Terrorista.
- Tempo total de jogo.
- Tempo de acao.
- Tempo de resultado.
- Penalidade por senha errada.
- Senhas e fatores de validacao.

No modo Roubo de Dados, tambem pode configurar:

- Nome do notebook.
- Quatro nomes de pasta.
- Qual pasta e a correta.
- Arquivo criptografado.
- Email de destino.
- Tamanho do pacote.
- Senha de descriptografia.
- Tempo para acessar.
- Tempo para baixar.
- Tempo para descriptografar.
- Tempo para enviar.

No modo Dominacao de Terminal, tambem pode configurar:

- Nome do terminal.
- Tempo de dominio para vencer.
- Tempo para capturar.
- Intervalo entre revalidacoes.
- Janela maxima para revalidar antes de voltar a neutro.
- Senha para capturar.
- Se a captura exige senha.
- Se a revalidacao usa senha randomica decodificada.

## Observacoes tecnicas

- Este prototipo nao usa Bluetooth, Wi-Fi real, camera real ou servidor.
- A comunicacao entre telas e simulada via `localStorage`.
- Para transformar em app Android real, o proximo passo e portar a logica para uma base como React Native, Flutter, Kotlin ou WebView com comunicacao local.
- O estado atual esta centralizado em `airsoft-shared.js`.
- As regras visuais principais estao em `airsoft-theme.css`.

## Pontos para testar

- Trocar modo no topo do controle e confirmar se as tres telas mudam.
- Cadastrar celular como CT e Terrorista.
- Reiniciar sistema e conferir se o celular volta para cadastro.
- Testar senha correta e incorreta.
- Testar penalidade.
- Testar cancelar etapas no notebook.
- Testar escolha de pasta errada e correta.
- Testar obtencao de senha por decodificacao.
- Testar digitar email correto no QWERTY.
- Testar captura, revalidacao normal e revalidacao randomica no terminal.
- Testar vitoria por tempo, desarme, explosao, envio de dados ou dominio de terminal.

## Feedback esperado do beta tester

Ao testar, anote:

- Etapas confusas.
- Botoes que nao deveriam aparecer.
- Textos que nao combinam com a regra.
- Fluxos que travam.
- Momentos em que o jogador fica sem saber a proxima acao.
- Sugestoes para deixar a experiencia mais cinematografica.
