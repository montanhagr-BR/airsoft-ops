package br.com.airsoftops.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import br.com.airsoftops.domain.BombGameEngine
import br.com.airsoftops.model.ActionType
import br.com.airsoftops.model.AppRole
import br.com.airsoftops.model.BombConfig
import br.com.airsoftops.model.GameState
import br.com.airsoftops.model.Team
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

class GameViewModel : ViewModel() {
    private val _state = MutableStateFlow(GameState())
    val state: StateFlow<GameState> = _state.asStateFlow()

    init {
        viewModelScope.launch {
            while (isActive) {
                delay(1_000)
                _state.update(BombGameEngine::tick)
            }
        }
    }

    fun selectRole(role: AppRole) = _state.update { it.copy(selectedRole = role) }
    fun leaveRole() = _state.update { it.copy(selectedRole = null) }
    fun selectTeam(team: Team) = _state.update { it.copy(selectedTeam = team) }
    fun configure(config: BombConfig) = _state.update { BombGameEngine.configure(it, config) }
    fun startGame() = _state.update(BombGameEngine::start)
    fun requestAction(action: ActionType) = _state.update { BombGameEngine.requestAction(it, it.selectedTeam, action) }
    fun validateQr() = _state.update(BombGameEngine::validateQr)
    fun submitCode(code: String) = _state.update { BombGameEngine.submitCode(it, code) }
    fun reset() = _state.update { current -> GameState(selectedRole = current.selectedRole) }
}
