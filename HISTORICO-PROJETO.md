# Histórico Técnico - Airsoft Ops

## 1. Objetivo do projeto

O Airsoft Ops é um protótipo de sistema cenográfico para partidas de airsoft. O sistema simula artefatos tecnológicos de filmes de ação, sem controlar dispositivos perigosos reais.

O conceito possui três interfaces sincronizadas:

- **Controlador:** configura e acompanha a partida.
- **Artefato:** representa bomba, notebook, terminal ou localizador.
- **Jogador:** funciona no celular de cada participante.

O protótipo atual foi construído em HTML, CSS e JavaScript. A comunicação entre as telas usa `localStorage`, portanto funciona entre abas do mesmo navegador. Comunicação real entre aparelhos ainda precisará de servidor, Wi-Fi ou Bluetooth.

## 2. Arquivos principais

- `outputs/controle.html`: painel do Controlador.
- `outputs/bomba.html`: tela do artefato.
- `outputs/jogador.html`: interface dos jogadores.
- `outputs/teste-integrado.html`: reúne as três telas para testes.
- `outputs/airsoft-shared.js`: estado compartilhado e sincronização.
- `outputs/airsoft-theme.css`: identidade visual das interfaces.
- `outputs/manual-beta-tester.md`: orientação para testes.
- `outputs/esquema-modo-bomba.md`: regras detalhadas do modo bomba.
- `outputs/assets/`: imagens usadas como estrutura visual.

## 3. Conceitos gerais

Todos os modos usam três categorias de tempo:

- **Tempo de jogo:** duração total da partida.
- **Tempo de ação:** duração de uma interação do jogador.
- **Tempo de resultado:** janela até uma consequência, como explosão, validação ou perda de domínio.

Os tempos longos são configurados em horas e minutos. Ações e barras de progresso usam minutos e segundos.

As operações temporizadas aparecem em popups com barra de progresso e porcentagem. Durante uma barra ativa, os controles relacionados ficam bloqueados e o popup não possui botão para fechar.

## 4. Times e cadastro dos celulares

O Controlador define o nome dos dois times:

- **Time 1:** normalmente CT ou equipe de defesa.
- **Time 2:** normalmente Terrorista ou equipe invasora.

O painel possui dois QRs cenográficos para cadastrar os celulares. Depois do cadastro, o aparelho fica travado no módulo do time escolhido.

Ao reiniciar o sistema, os celulares também perdem o cadastro e precisam ser vinculados novamente.

## 5. Interface do jogador

A tela do jogador possui três abas:

### Objetivos

Mostra as instruções enviadas em texto pelo Controlador e o modo atual da partida.

### Terminal

Mostra estado do artefato, senha conhecida, validações, decodificação e ações disponíveis para o time.

### Localizador

Mostra:

- Direção aproximada do artefato.
- Distância em metros ou quilômetros.
- Precisão do GPS.
- Estado da transmissão.
- Alerta de primeiro deslocamento.

O botão usa o texto **Ativar localizador**. O visual segue o tema de maleta e terminal militar usado no restante do sistema.

## 6. QR por etapa

O QR exibido no artefato muda visualmente a cada etapa de validação.

O Controlador pode marcar ou desmarcar **Exigir QR nas etapas**:

- Marcado: o jogador precisa cumprir a validação de QR.
- Desmarcado: o sistema pula o QR e segue diretamente para a próxima etapa.

Ao mudar essa configuração, validações antigas são zeradas para evitar reaproveitamento indevido.

## 7. Modo Bomba

### Fluxo de arme

1. O jogador Terrorista obtém a senha pelo Controlador ou pelo decodificador.
2. Solicita o arme no celular.
3. Valida o QR da etapa, quando exigido.
4. Digita a senha no teclado da bomba.
5. Aguarda o tempo de ação.
6. A bomba entra em contagem regressiva.

### Fluxo de desarme

1. O jogador CT obtém a senha pelo Controlador ou pelo decodificador.
2. Solicita o desarme no celular.
3. Valida o QR da etapa, quando exigido.
4. Digita a senha no teclado da bomba.
5. Aguarda o tempo de ação.
6. A bomba é neutralizada.

### Resultado

- Fim do tempo de jogo ou desarme: Time 1 vence.
- Explosão cenográfica: Time 2 vence.

### Dois fatores

O Controlador pode exigir um ou dois jogadores. Em dois fatores, dois celulares do mesmo time precisam validar a etapa com diferença máxima de três segundos.

### Alerta de ativação

O painel possui caixas marcáveis para:

- Enviar popup de **Bomba ativada** aos celulares.
- Ligar automaticamente o GPS da bomba quando ela for armada.

Cada celular mostra o alerta uma única vez por ativação.

## 8. Localização e GPS

O GPS do artefato pode ficar ligado ou desligado pelo Controlador.

- Ligado: a tela da bomba publica sua posição a cada 10 segundos.
- Desligado: não são enviadas novas coordenadas aos celulares.

Também é possível informar latitude e longitude manualmente como posição inicial ou alternativa.

O sistema pode avisar os jogadores quando o artefato for deslocado pela primeira vez. O Controlador define a distância mínima necessária para esse alerta.

Todas as configurações binárias do painel usam caixas marcáveis:

- Marcado significa **Sim**.
- Desmarcado significa **Não**.

## 9. Modo Roubo de Dados

O artefato se transforma visualmente em um notebook cenográfico.

### Etapas

1. **Acessar:** quebrar ou receber a senha do notebook.
2. **Escolher pasta:** selecionar uma entre quatro pastas configuradas.
3. **Baixar:** download executado visualmente no notebook.
4. **Descriptografar:** usar senha própria, com progresso no artefato.
5. **Validar descriptografia:** confirmação final pelo jogador.
6. **Enviar:** solicitar pelo celular e digitar o endereço correto no notebook.

### Defesa

O Time 1 pode:

- Alterar a senha do notebook.
- Impedir novo acesso.
- Apagar dados baixados antes da conclusão.
- Interromper o avanço conforme a etapa alcançada.

### Visual

- Tela inicial semelhante a notebook bloqueado.
- QR integrado ao perfil de acesso.
- Teclado QWERTY integrado à tela.
- Gerenciador de arquivos com quatro pastas.
- Arquivo de texto aberto após descriptografia.
- Símbolo de email enviado ao concluir.
- Relógios pequenos, semelhantes aos indicadores de um sistema operacional.

## 10. Modo Dominação de Terminal

O terminal começa neutro. Um time captura e precisa manter o domínio durante o tempo configurado.

### Captura

1. Jogador inicia a captura no celular.
2. Valida QR, quando exigido.
3. Confirma também na tela do terminal.
4. Digita a senha de captura, quando configurada.
5. Aguarda a barra de captura.

### Revalidação

- O domínio precisa ser revalidado periodicamente.
- A confirmação acontece no celular e no terminal.
- Se a validação não terminar dentro da janela configurada, o terminal volta a neutro.
- Pode existir uma senha randômica nova a cada revalidação.
- A senha randômica precisa ser descoberta pelo decodificador do jogador.

## 11. Identidade visual

O modo bomba foi inspirado em uma maleta militar desgastada, com:

- Chapas metálicas escuras.
- Molduras quadradas.
- Parafusos, fios e módulos físicos.
- Etiquetas envelhecidas.
- Temporizadores vermelhos de sete segmentos.
- Teclado numérico integrado.
- QR integrado à estrutura.

A interface do jogador usa uma moldura vertical da mesma família visual, adaptada para celular.

O objetivo visual é evitar aparência de aplicativo genérico e transmitir a sensação de um equipamento cenográfico físico.

## 12. Decisões importantes

- A senha pode ser entregue manualmente pelo Controlador.
- A decodificação é uma alternativa, não uma exigência universal.
- O jogador não pede autorização ao Controlador para possuir uma senha.
- O teclado do artefato fica bloqueado até existir uma ação válida.
- Popups informativos desaparecem automaticamente quando apropriado.
- Barras temporizadas não podem ser fechadas durante o progresso.
- O protótipo não controla explosivos, ignição ou qualquer dispositivo perigoso.

## 13. Limitações atuais

- Sincronização somente entre abas do mesmo navegador.
- QRs são cenográficos; não existe leitura real pela câmera.
- GPS depende da permissão e capacidade do navegador.
- Bluetooth e Wi-Fi entre aparelhos ainda não foram implementados.
- Não existe autenticação real de jogadores ou servidor central.
- O projeto ainda não é um APK Android.
- Sons e caixa de som ainda precisam de integração real.

## 14. Próximas etapas recomendadas

1. Transformar o estado compartilhado em servidor WebSocket.
2. Criar sessões e códigos únicos para cada partida.
3. Implementar leitura real de QR pela câmera.
4. Registrar jogadores e aparelhos por identificadores únicos.
5. Definir estratégia de GPS, permissões e atualização em segundo plano.
6. Criar aplicativo Android com interface responsiva ou empacotar a aplicação web.
7. Implementar conexão com caixa de som e biblioteca de efeitos.
8. Criar testes automatizados para os fluxos de cada modo.
9. Fazer testes em campo com múltiplos celulares e um tablet.
10. Revisar segurança, privacidade e consumo de bateria.

## 15. Como continuar em outro computador

Clone o repositório privado:

```powershell
gh repo clone montanhagr-BR/airsoft-ops
cd airsoft-ops
```

Abra a pasta no Codex e use esta orientação inicial:

> Leia `HISTORICO-PROJETO.md`, `README.md`, `outputs/manual-beta-tester.md` e os arquivos principais dentro de `outputs`. Continue o protótipo Airsoft Ops preservando as regras, o estilo militar e a separação entre Controlador, Artefato e Jogador. Antes de alterar uma dinâmica, verifique o estado compartilhado em `outputs/airsoft-shared.js` e teste as três interfaces juntas em `outputs/teste-integrado.html`.

## 16. Atualização do repositório

Depois de novas alterações:

```powershell
git add .
git commit -m "Descrever a alteração realizada"
git push
```

