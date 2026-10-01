package br.com.airsoftops.model

enum class AppRole(val title: String, val description: String) {
    CONTROLLER("Controlador", "Configura e acompanha a operação"),
    ARTIFACT("Artefato", "Transforma este aparelho em uma bomba"),
    PLAYER("Jogador", "Recebe objetivos e interage com o artefato"),
    PORTAL("Portal Web / Conta", "Acesse sua conta do Montanha Bomb System")
}

enum class Team(val title: String) {
    CT("Time 1 · CT"),
    TERRORIST("Time 2 · Terrorista")
}

enum class BombStatus(val label: String) {
    WAITING("Aguardando início"),
    ACTIVE("Partida em andamento"),
    ARM_REQUESTED("Arme solicitado"),
    ARMED("Bomba ativada"),
    DEFUSE_REQUESTED("Desarme solicitado"),
    DEFUSED("Bomba neutralizada"),
    EXPLODED("Bomba detonada")
}

data class BombConfig(
    val name: String = "Bomba Alfa",
    val gameDurationSeconds: Int = 60 * 60,
    val bombDurationSeconds: Int = 10 * 60,
    val actionDurationSeconds: Int = 10,
    val armCode: String = "2468",
    val defuseCode: String = "1357",
    val qrRequired: Boolean = true
)

data class PendingAction(
    val team: Team,
    val type: ActionType,
    val qrValidated: Boolean = false
)

enum class ActionType { ARM, DEFUSE }

data class GameState(
    val selectedRole: AppRole? = null,
    val selectedTeam: Team = Team.CT,
    val config: BombConfig = BombConfig(),
    val status: BombStatus = BombStatus.WAITING,
    val gameSeconds: Int = BombConfig().gameDurationSeconds,
    val bombSeconds: Int? = null,
    val running: Boolean = false,
    val pendingAction: PendingAction? = null,
    val message: String = "Sistema pronto",
    val winner: String? = null
)
