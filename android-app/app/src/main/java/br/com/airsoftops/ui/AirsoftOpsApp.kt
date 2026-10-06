package br.com.airsoftops.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import br.com.airsoftops.model.AppRole

@Composable
fun AirsoftOpsApp(viewModel: GameViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Scaffold(containerColor = Color(0xFF0F171A)) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (state.selectedRole) {
                null -> PrototypeWebScreen(AppRole.PORTAL, viewModel::leaveRole)
                AppRole.CONTROLLER -> PrototypeWebScreen(AppRole.CONTROLLER, viewModel::leaveRole)
                AppRole.ARTIFACT -> PrototypeWebScreen(AppRole.ARTIFACT, viewModel::leaveRole)
                AppRole.PLAYER -> PrototypeWebScreen(AppRole.PLAYER, viewModel::leaveRole)
                AppRole.PORTAL -> PrototypeWebScreen(AppRole.PORTAL, viewModel::leaveRole)
            }
        }
    }
}
