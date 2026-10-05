package br.com.airsoftops.ui

import android.app.Activity
import android.content.pm.ActivityInfo
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import br.com.airsoftops.model.ActionType
import br.com.airsoftops.model.AppRole
import br.com.airsoftops.model.BombConfig
import br.com.airsoftops.model.BombStatus
import br.com.airsoftops.model.GameState
import br.com.airsoftops.model.Team
import br.com.airsoftops.R
import br.com.airsoftops.ui.theme.OpsAmber
import br.com.airsoftops.ui.theme.OpsBlack
import br.com.airsoftops.ui.theme.OpsGreen
import br.com.airsoftops.ui.theme.OpsPaper
import br.com.airsoftops.ui.theme.OpsRed

@Composable
fun AirsoftOpsApp(viewModel: GameViewModel = viewModel()) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    Scaffold(containerColor = MaterialTheme.colorScheme.background) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (state.selectedRole) {
                null -> RoleSelection(onSelect = viewModel::selectRole)
                AppRole.CONTROLLER -> PrototypeWebScreen(AppRole.CONTROLLER, viewModel::leaveRole)
                AppRole.ARTIFACT -> PrototypeWebScreen(AppRole.ARTIFACT, viewModel::leaveRole)
                AppRole.PLAYER -> PrototypeWebScreen(AppRole.PLAYER, viewModel::leaveRole)
                AppRole.PORTAL -> PrototypeWebScreen(AppRole.PORTAL, viewModel::leaveRole)
            }
        }
    }
}

@Composable
private fun RoleSelection(onSelect: (AppRole) -> Unit) {
    var step by remember { mutableStateOf(1) } // 1 = Logo/Welcome, 2 = Login Screen (Portal), 3 = Main Operation Screen (Jogador/Bomba & Controle)
    var choosingPlayerType by remember { mutableStateOf(false) }

    Box(
        Modifier
            .fillMaxSize()
            .background(Color(0xFF080C0B))
    ) {
        when (step) {
            1 -> {
                // Screen 1: Logo with Login button
                Image(
                    painter = painterResource(R.drawable.airsoft_ops_identity),
                    contentDescription = "Airsoft Ops Logo",
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier
                        .fillMaxSize()
                        .align(Alignment.Center)
                )

                Box(
                    Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Black.copy(alpha = 0.2f),
                                    Color.Black.copy(alpha = 0.5f),
                                    Color.Black.copy(alpha = 0.88f)
                                )
                            )
                        )
                )

                Column(
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 48.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "AIRSOFT OPS",
                        color = Color(0xFFF2B84B),
                        fontSize = 32.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = "SISTEMA TÁTICO OPERACIONAL",
                        color = Color(0xFFE8E5DA),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        textAlign = TextAlign.Center
                    )
                }

                Column(
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 36.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Button(
                        onClick = { step = 2 },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(60.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF34D399),
                            contentColor = Color(0xFF03110C)
                        )
                    ) {
                        Text(
                            "ENTRAR / LOGIN",
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp
                        )
                    }
                }
            }
            2 -> {
                // Screen 2: Login & Signup Screen (Portal Web Auth) with top navigation bar
                Column(Modifier.fillMaxSize()) {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .background(Color(0xFF10171A))
                            .padding(horizontal = 16.dp, vertical = 10.dp),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        OutlinedButton(
                            onClick = { step = 1 },
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text("Voltar", color = Color.White)
                        }
                        Button(
                            onClick = { step = 3 },
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF34D399),
                                contentColor = Color(0xFF03110C)
                            )
                        ) {
                            Text("Avançar para o Jogo ->", fontWeight = FontWeight.Bold)
                        }
                    }
                    Box(Modifier.fillMaxSize()) {
                        PrototypeWebScreen(AppRole.PORTAL) {
                            step = 1
                        }
                    }
                }
            }
            3 -> {
                // Screen 3: Main Operation Screen (Jogador / Bomba & Controle)
                Image(
                    painter = painterResource(R.drawable.airsoft_ops_identity),
                    contentDescription = "Airsoft Ops Logo",
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier
                        .fillMaxSize()
                        .align(Alignment.Center)
                )

                Box(
                    Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                colors = listOf(
                                    Color.Black.copy(alpha = 0.3f),
                                    Color.Black.copy(alpha = 0.6f),
                                    Color.Black.copy(alpha = 0.92f)
                                )
                            )
                        )
                )

                Column(
                    Modifier
                        .align(Alignment.TopCenter)
                        .padding(top = 40.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(6.dp)
                ) {
                    Text(
                        text = "AIRSOFT OPS",
                        color = Color(0xFFF2B84B),
                        fontSize = 30.sp,
                        fontWeight = FontWeight.Black,
                        fontFamily = FontFamily.Monospace,
                        textAlign = TextAlign.Center
                    )
                    Text(
                        text = "PAINEL DE OPERAÇÃO",
                        color = Color(0xFFE8E5DA),
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        fontFamily = FontFamily.Monospace,
                        textAlign = TextAlign.Center
                    )
                }

                Column(
                    Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .padding(horizontal = 24.dp, vertical = 32.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp)
                ) {
                    Button(
                        onClick = { choosingPlayerType = true },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(60.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFF34D399),
                            contentColor = Color(0xFF03110C)
                        )
                    ) {
                        Text(
                            "JOGADOR / BOMBA",
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp
                        )
                    }

                    Button(
                        onClick = { onSelect(AppRole.CONTROLLER) },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(60.dp),
                        shape = RoundedCornerShape(10.dp),
                        colors = ButtonDefaults.buttonColors(
                            containerColor = Color(0xFFF2B84B),
                            contentColor = Color(0xFF171003)
                        )
                    ) {
                        Text(
                            "CONTROLE",
                            fontWeight = FontWeight.Black,
                            fontSize = 18.sp
                        )
                    }

                    OutlinedButton(
                        onClick = { step = 1 },
                        modifier = Modifier.fillMaxWidth(),
                        shape = RoundedCornerShape(8.dp)
                    ) {
                        Text("Sair da Conta", color = Color(0xFF8FA09A))
                    }
                }

                if (choosingPlayerType) {
                    Box(
                        Modifier
                            .fillMaxSize()
                            .background(Color.Black.copy(alpha = .85f))
                            .clickable { choosingPlayerType = false }
                    )
                    Column(
                        Modifier
                            .align(Alignment.Center)
                            .fillMaxWidth(.88f)
                            .background(Color(0xFF10171A), shape = RoundedCornerShape(12.dp))
                            .border(1.dp, Color(0xFF34D399), shape = RoundedCornerShape(12.dp))
                            .padding(22.dp),
                        verticalArrangement = Arrangement.spacedBy(14.dp)
                    ) {
                        Text(
                            "MODO JOGADOR",
                            color = Color(0xFF34D399),
                            fontSize = 20.sp,
                            fontWeight = FontWeight.Black
                        )
                        Text(
                            "Escolha o terminal para este dispositivo:",
                            color = Color(0xFFC4D2CE),
                            fontSize = 13.sp
                        )
                        Button(
                            onClick = { onSelect(AppRole.PLAYER) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFF34D399),
                                contentColor = Color(0xFF03110C)
                            )
                        ) {
                            Text("TERMINAL DO JOGADOR", fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        }
                        Button(
                            onClick = { onSelect(AppRole.ARTIFACT) },
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(52.dp),
                            shape = RoundedCornerShape(6.dp),
                            colors = ButtonDefaults.buttonColors(
                                containerColor = Color(0xFFFB4E4E),
                                contentColor = Color(0xFF190404)
                            )
                        ) {
                            Text("ARTEFATO / BOMBA", fontWeight = FontWeight.Bold, fontSize = 15.sp)
                        }
                        OutlinedButton(
                            onClick = { choosingPlayerType = false },
                            modifier = Modifier.fillMaxWidth(),
                            shape = RoundedCornerShape(6.dp)
                        ) {
                            Text("CANCELAR", color = Color(0xFF8FA09A))
                        }
                    }
                }
            }
        }
    }
}
