# Airsoft Ops Android

Primeira base nativa do aplicativo comercial Airsoft Ops.

## O que já funciona

- Seleção de módulo: Controlador, Artefato ou Jogador.
- Configuração de nome, tempos, senhas e exigência de QR.
- Início e reinício da partida.
- Solicitação de arme pelo Time 2 e desarme pelo Time 1.
- Validação simulada de QR e senha no teclado do artefato.
- Cronômetros reais e resultado por desarme, explosão ou fim do jogo.
- Máquina de estados isolada e coberta por testes unitários iniciais.

## Requisitos de desenvolvimento

- Android Studio Quail 4 ou compatível.
- JDK 17 ou superior. O projeto foi validado com o JDK incluído no Android Studio.
- Android SDK 37 e Build Tools 36.0.0 ou superior.
- Gradle 9.6.0.

O projeto foi compilado com Android SDK 37, Build Tools 36.0.0, Android Gradle Plugin 9.4.0 e Gradle 9.6.0.

## Compilar

No Android Studio, abra a pasta `android-app` e use Run. Pelo terminal, com `JAVA_HOME` e `ANDROID_HOME` configurados:

```powershell
.\gradlew.bat testDebugUnitTest assembleDebug
```

O APK de desenvolvimento é criado em `app/build/outputs/apk/debug/app-debug.apk`.

## Próximas entregas

1. Persistência local com Room/DataStore.
2. Cadastro e pareamento real de dispositivos.
3. Leitura de QR pela câmera.
4. Bluetooth e Wi-Fi local offline-first.
5. API, autenticação e sincronização WebSocket.
6. Assinaturas e painel administrativo.
