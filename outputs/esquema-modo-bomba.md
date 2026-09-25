# Esquema de Passos - Modo Bomba

## Conceito

O Modo Bomba e um jogo cenografico para airsoft em que o tablet/artefato exibe a bomba, o Controlador controla a partida e os jogadores usam o celular para obter senha, validar presenca e executar arme/desarme.

## Tempos Configuraveis

- Tempo de jogo: duracao total da partida.
- Tempo de acao: tempo que o jogador precisa interagir para armar, desarmar ou decodificar.
- Tempo da bomba / resultado: tempo de contagem da bomba depois de armada ou janela de consequencia.
- Toda barra de status progressiva aparece em popup, nunca fixa na tela principal.
- Todo popup desaparece automaticamente em ate 15 segundos.

## Configuracao do Controlador

1. Escolher o modo de jogo: Bomba classica.
2. Definir tempo de jogo.
3. Definir tempo de acao.
4. Definir tempo da bomba / resultado.
5. Definir senha de arme.
6. Definir senha de desarme.
7. Definir se arme exige 1 ou 2 fatores.
8. Definir se desarme exige 1 ou 2 fatores.
9. Iniciar o jogo.
10. Encerrar o jogo manualmente, se necessario.

## Caminhos Para Obter Senha

A decodificacao nao e obrigatoria. Ela e apenas um caminho extra para obter a senha quando o Controlador nao entrega a senha manualmente.

### Caminho A - Controlador Passa a Senha

1. Controlador decide passar a senha para um time.
2. Se for CT, o celular CT mostra a senha de desarme.
3. Se for Terrorista, o celular Terrorista mostra a senha de arme.
4. A partir desse momento, o jogador ja tem a senha e pode usar o teclado da bomba.
5. O jogador ainda precisa ir ate a bomba, escanear o QR e digitar a senha no teclado da bomba.

### Caminho B - Jogador Decodifica a Senha

1. Jogador escaneia o QR da bomba.
2. Celular registra presenca perto do artefato.
3. Jogador toca em pedir decodificacao.
4. A tela da bomba mostra uma solicitacao de decodificacao.
5. Aparece automaticamente um popup avisando que a decodificacao foi solicitada.
6. Na bomba, alguem usa o teclado/OK para liberar a decodificacao.
7. Comeca o tempo de acao da decodificacao.
8. A barra de decodificacao aparece em popup e o popup some sozinho em ate 15 segundos.
9. Ao terminar, a senha aparece no celular do jogador.
10. O jogador pode usar essa senha no teclado da bomba para armar ou desarmar.

## Fluxo Para Armar a Bomba

1. Terrorista precisa ter a senha de arme.
2. Terrorista escaneia o QR da bomba.
3. Se o arme exigir 2 fatores, outro jogador terrorista tambem precisa escanear o QR em ate 3 segundos.
4. A bomba mostra que esta aguardando senha de arme.
5. Terrorista digita a senha de arme no teclado da bomba.
6. Terrorista aperta OK no teclado da bomba.
7. Se a senha estiver correta, a acao de armar fica liberada no celular.
8. Terrorista toca em armar bomba no celular.
9. Comeca o tempo de acao de arme.
10. A barra de arme aparece em popup.
11. Ao terminar o tempo de acao, a bomba entra em contagem.
12. Comeca o tempo da bomba / resultado.
13. A barra do tempo de resultado aparece em popup.
14. Se o CT nao desarmar antes do fim, ocorre explosao cenografica.
15. O jogo termina por finalidade alcancada.

## Fluxo Para Desarmar a Bomba

1. CT precisa ter a senha de desarme.
2. CT escaneia o QR da bomba.
3. Se o desarme exigir 2 fatores, outro jogador CT tambem precisa escanear o QR em ate 3 segundos.
4. A bomba mostra que esta aguardando senha de desarme.
5. CT digita a senha de desarme no teclado da bomba.
6. CT aperta OK no teclado da bomba.
7. Se a senha estiver correta, a acao de desarmar fica liberada no celular.
8. CT toca em desarmar bomba no celular.
9. Comeca o tempo de acao de desarme.
10. A barra de desarme aparece em popup.
11. Ao terminar o tempo de acao, a bomba e neutralizada.
12. O jogo termina por finalidade alcancada.

## Regra de Popups Progressivos

1. Toda etapa com contagem progressiva abre em popup.
2. A tela principal nao mostra barra progressiva fixa.
3. O popup mostra nome da etapa, tempo restante e barra de progresso.
4. O popup aparece automaticamente quando a etapa comeca.
5. O usuario nao precisa apertar OK para o popup aparecer.
6. Todo popup desaparece automaticamente em ate 15 segundos.
7. Se a etapa durar mais de 15 segundos, a acao continua em segundo plano e a tela principal mostra apenas o estado atual.
8. Ao terminar o tempo, a tela principal recebe o novo estado.
9. Exemplos de popup progressivo: decodificacao, arme, desarme, interferencia, roubo de dados, dominio de terminal e tempo de resultado.

## Regra de Dois Fatores

1. Controlador escolhe se a acao exige 1 ou 2 fatores.
2. Em 1 fator, um jogador pode completar a validacao sozinho.
3. Em 2 fatores, dois jogadores do mesmo time precisam escanear o QR para a mesma etapa.
4. A diferenca entre os dois scans deve ser de no maximo 3 segundos.
5. Se passar de 3 segundos, a etapa volta a aguardar o segundo scan.
6. Depois dos dois fatores, a senha ainda precisa ser digitada no teclado da bomba.

## Estados da Bomba

- Aguardando inicio
- Jogo em andamento
- QR aguardando scan
- QR validado
- Solicitacao de decodificacao
- Decodificacao em progresso
- Aguardando senha de arme
- Aguardando senha de desarme
- Senha correta
- Senha incorreta
- Arme em progresso
- Bomba armada
- Desarme em progresso
- Bomba neutralizada
- Explosao cenografica
- Fim de jogo

## Estados do Celular CT

- Sem senha
- QR escaneado
- Decodificacao solicitada
- Decodificando
- Senha recebida
- Senha validada na bomba
- Desarme liberado
- Desarme em progresso
- Bomba neutralizada

## Estados do Celular Terrorista

- Sem senha
- QR escaneado
- Decodificacao solicitada
- Decodificando
- Senha recebida
- Senha validada na bomba
- Arme liberado
- Arme em progresso
- Bomba armada

## Pontos Para Decidir

- O QR deve ser escaneado antes de pedir decodificacao?
- O QR deve expirar depois de alguns segundos?
- A senha deve ser numerica com 4, 5 ou 6 digitos?
- O Controlador pode mudar senha durante a partida?
- Em dois fatores, os dois jogadores precisam ser celulares diferentes?
- Depois de senha incorreta, deve haver penalidade de tempo?
- Quantas tentativas de senha errada sao permitidas?
- O jogador precisa manter o celular perto da bomba durante todo o tempo de acao?
- A caixa de som toca efeitos em quais estados?
