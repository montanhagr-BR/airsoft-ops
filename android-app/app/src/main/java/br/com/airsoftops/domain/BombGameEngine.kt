package br.com.airsoftops.domain

import br.com.airsoftops.model.ActionType
import br.com.airsoftops.model.BombConfig
import br.com.airsoftops.model.BombStatus
import br.com.airsoftops.model.GameState
import br.com.airsoftops.model.PendingAction
import br.com.airsoftops.model.Team

object BombGameEngine {
    fun configure(state: GameState, config: BombConfig): GameState = state.copy(
        config = config,
        gameSeconds = config.gameDurationSeconds,
        bombSeconds = null,
        status = BombStatus.WAITING,
        running = false,
        pendingAction = null,
        winner = null,
        message = "Configuração salva"
    )

    fun start(state: GameState): GameState = state.copy(
        running = true,
        status = BombStatus.ACTIVE,
        gameSeconds = state.config.gameDurationSeconds,
        bombSeconds = null,
        pendingAction = null,
        winner = null,
        message = "Partida iniciada pelo Controlador"
    )

    fun requestAction(state: GameState, team: Team, action: ActionType): GameState {
        if (!state.running || state.winner != null) return state.copy(message = "A partida não está ativa")
        if (action == ActionType.ARM && team != Team.TERRORIST) return state.copy(message = "Somente o Time 2 pode armar")
        if (action == ActionType.DEFUSE && team != Team.CT) return state.copy(message = "Somente o Time 1 pode desarmar")
        if (action == ActionType.ARM && state.bombSeconds != null) return state.copy(message = "A bomba já está armada")
        if (action == ActionType.DEFUSE && state.bombSeconds == null) return state.copy(message = "A bomba ainda não está armada")

        return state.copy(
            pendingAction = PendingAction(team, action, qrValidated = !state.config.qrRequired),
            status = if (action == ActionType.ARM) BombStatus.ARM_REQUESTED else BombStatus.DEFUSE_REQUESTED,
            message = if (state.config.qrRequired) "Leia o QR do artefato" else "Digite a senha no artefato"
        )
    }

    fun validateQr(state: GameState): GameState {
        val pending = state.pendingAction ?: return state.copy(message = "Nenhuma ação solicitada")
        return state.copy(
            pendingAction = pending.copy(qrValidated = true),
            message = "QR validado. Digite a senha no artefato"
        )
    }

    fun submitCode(state: GameState, code: String): GameState {
        val pending = state.pendingAction ?: return state.copy(message = "Nenhuma ação aguardando senha")
        if (!pending.qrValidated) return state.copy(message = "Valide o QR antes da senha")
        val expected = if (pending.type == ActionType.ARM) state.config.armCode else state.config.defuseCode
        if (code != expected) return state.copy(message = "Senha incorreta")

        return when (pending.type) {
            ActionType.ARM -> state.copy(
                pendingAction = null,
                status = BombStatus.ARMED,
                bombSeconds = state.config.bombDurationSeconds,
                message = "Bomba ativada"
            )
            ActionType.DEFUSE -> state.copy(
                pendingAction = null,
                status = BombStatus.DEFUSED,
                bombSeconds = null,
                running = false,
                winner = "Time 1 venceu",
                message = "Bomba neutralizada"
            )
        }
    }

    fun tick(state: GameState): GameState {
        if (!state.running || state.winner != null) return state
        val nextGame = (state.gameSeconds - 1).coerceAtLeast(0)
        val nextBomb = state.bombSeconds?.let { (it - 1).coerceAtLeast(0) }

        if (nextBomb == 0) return state.copy(
            gameSeconds = nextGame,
            bombSeconds = 0,
            running = false,
            status = BombStatus.EXPLODED,
            winner = "Time 2 venceu",
            message = "Detonação cenográfica"
        )
        if (nextGame == 0) return state.copy(
            gameSeconds = 0,
            bombSeconds = nextBomb,
            running = false,
            winner = "Time 1 venceu",
            message = "Tempo de jogo encerrado"
        )
        return state.copy(gameSeconds = nextGame, bombSeconds = nextBomb)
    }
}
