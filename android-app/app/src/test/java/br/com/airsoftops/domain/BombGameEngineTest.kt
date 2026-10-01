package br.com.airsoftops.domain

import br.com.airsoftops.model.ActionType
import br.com.airsoftops.model.BombConfig
import br.com.airsoftops.model.BombStatus
import br.com.airsoftops.model.GameState
import br.com.airsoftops.model.Team
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BombGameEngineTest {
    private val config = BombConfig(
        gameDurationSeconds = 120,
        bombDurationSeconds = 30,
        armCode = "1111",
        defuseCode = "2222",
        qrRequired = true
    )

    @Test
    fun terroristArmsAfterQrAndCorrectCode() {
        var state = BombGameEngine.start(BombGameEngine.configure(GameState(), config))
        state = BombGameEngine.requestAction(state, Team.TERRORIST, ActionType.ARM)
        state = BombGameEngine.validateQr(state)
        state = BombGameEngine.submitCode(state, "1111")

        assertEquals(BombStatus.ARMED, state.status)
        assertEquals(30, state.bombSeconds)
        assertNull(state.pendingAction)
    }

    @Test
    fun ctWinsAfterValidDefuse() {
        var state = BombGameEngine.start(BombGameEngine.configure(GameState(), config))
        state = BombGameEngine.requestAction(state, Team.TERRORIST, ActionType.ARM)
        state = BombGameEngine.validateQr(state)
        state = BombGameEngine.submitCode(state, "1111")
        state = BombGameEngine.requestAction(state, Team.CT, ActionType.DEFUSE)
        state = BombGameEngine.validateQr(state)
        state = BombGameEngine.submitCode(state, "2222")

        assertEquals(BombStatus.DEFUSED, state.status)
        assertEquals("Time 1 venceu", state.winner)
    }

    @Test
    fun explosionGivesVictoryToTeamTwo() {
        val state = GameState(config = config, running = true, status = BombStatus.ARMED, gameSeconds = 60, bombSeconds = 1)
        val result = BombGameEngine.tick(state)

        assertEquals(BombStatus.EXPLODED, result.status)
        assertEquals("Time 2 venceu", result.winner)
    }
}
