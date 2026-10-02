package br.com.airsoftops.ui

import android.app.Activity
import android.content.pm.ActivityInfo
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
                null -> PrototypeWebScreen(AppRole.PORTAL, viewModel::leaveRole)
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
    var choosingEntry by remember { mutableStateOf(false) }

    Box(Modifier.fillMaxSize().background(Color(0xFF090704))) {
        Image(
            painter = painterResource(R.drawable.airsoft_ops_identity),
            contentDescription = "Montanha Bomb System",
            contentScale = ContentScale.Crop,
            modifier = Modifier.fillMaxSize()
        )

        Text(
            text = "MONTANHA\nBOMB SYSTEM",
            modifier = Modifier.align(Alignment.TopCenter).padding(top = 22.dp),
            color = Color(0xFFFF7A22),
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center
        )

        Column(
            Modifier
                .align(Alignment.BottomCenter)
                .fillMaxWidth()
                .background(Color.Black.copy(alpha = .72f))
                .padding(horizontal = 12.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            BrandImageButton(
                bottomHalf = false,
                description = "Entrar em uma operação",
                onClick = { choosingEntry = true },
                modifier = Modifier.fillMaxWidth()
            )
            BrandImageButton(
                bottomHalf = true,
                description = "Criar jogo",
                onClick = { onSelect(AppRole.CONTROLLER) },
                modifier = Modifier.fillMaxWidth()
            )
        }

        if (choosingEntry) {
            Box(
                Modifier.fillMaxSize().background(Color.Black.copy(alpha = .78f))
                    .clickable { choosingEntry = false }
            )
            Column(
                Modifier
                    .align(Alignment.Center)
                    .fillMaxWidth(.86f)
                    .background(Color(0xFF0C0D09))
                    .border(1.dp, Color(0xFFC06C22))
                    .padding(20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("ENTRAR NA OPERAÇÃO", color = Color(0xFFF0DFB6), fontSize = 23.sp, fontWeight = FontWeight.Bold)
                Text("Escolha como este aparelho será usado.", color = Color(0xFFB7B09B))
                Button(
                    onClick = { onSelect(AppRole.ARTIFACT) },
                    modifier = Modifier.fillMaxWidth().height(58.dp),
                    shape = RoundedCornerShape(3.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4B5526), contentColor = Color(0xFFFFEBC0))
                ) { Text("ARTEFATO / BOMBA", fontWeight = FontWeight.Bold, fontSize = 17.sp) }
                Button(
                    onClick = { onSelect(AppRole.PLAYER) },
                    modifier = Modifier.fillMaxWidth().height(58.dp),
                    shape = RoundedCornerShape(3.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF4B5526), contentColor = Color(0xFFFFEBC0))
                ) { Text("JOGADOR", fontWeight = FontWeight.Bold, fontSize = 17.sp) }
                Button(
                    onClick = { onSelect(AppRole.PORTAL) },
                    modifier = Modifier.fillMaxWidth().height(52.dp),
                    shape = RoundedCornerShape(3.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = Color(0xFF2C3118), contentColor = Color(0xFFE8D4A8))
                ) { Text("MINHA CONTA / PORTAL WEB", fontWeight = FontWeight.Bold, fontSize = 15.sp) }
                OutlinedButton(
                    onClick = { choosingEntry = false },
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(3.dp)
                ) { Text("CANCELAR") }
            }
        }
    }
}

@Composable
private fun BrandImageButton(
    bottomHalf: Boolean,
    description: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier
            .aspectRatio(4f)
            .background(Color(0xFF252511))
            .border(1.dp, Color(0xFFEF6817))
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = if (bottomHalf) "CRIAR JOGO" else "ENTRAR",
            color = Color(0xFFFFE8BE),
            fontSize = 20.sp,
            fontWeight = FontWeight.Bold
        )
        Image(
            painter = painterResource(
                if (bottomHalf) R.drawable.button_criar_jogo else R.drawable.button_entrar
            ),
            contentDescription = description,
            contentScale = ContentScale.Fit,
            modifier = Modifier.fillMaxSize()
        )
    }
}

@Composable
private fun ScreenHeader(title: String, onBack: () -> Unit) {
    Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        OutlinedButton(onClick = onBack) { Text("Voltar") }
        Spacer(Modifier.width(12.dp))
        Column {
            Label("MODO BOMBA")
            Text(title, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ControllerScreen(state: GameState, viewModel: GameViewModel) {
    var name by remember(state.config.name) { mutableStateOf(state.config.name) }
    var gameMinutes by remember(state.config.gameDurationSeconds) { mutableStateOf((state.config.gameDurationSeconds / 60).toString()) }
    var bombMinutes by remember(state.config.bombDurationSeconds) { mutableStateOf((state.config.bombDurationSeconds / 60).toString()) }
    var actionSeconds by remember(state.config.actionDurationSeconds) { mutableStateOf(state.config.actionDurationSeconds.toString()) }
    var armCode by remember(state.config.armCode) { mutableStateOf(state.config.armCode) }
    var defuseCode by remember(state.config.defuseCode) { mutableStateOf(state.config.defuseCode) }
    var qrRequired by remember(state.config.qrRequired) { mutableStateOf(state.config.qrRequired) }

    Column(Modifier.fillMaxSize().padding(18.dp).verticalScroll(rememberScrollState())) {
        ScreenHeader("Controlador", viewModel::leaveRole)
        Spacer(Modifier.height(16.dp))
        StatusStrip(state)
        Spacer(Modifier.height(16.dp))
        Section("IDENTIFICAÇÃO") {
            OutlinedTextField(name, { name = it }, label = { Text("Nome da bomba") }, modifier = Modifier.fillMaxWidth())
        }
        Section("TEMPOS") {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                NumberField("Jogo (min)", gameMinutes) { gameMinutes = it }
                NumberField("Bomba (min)", bombMinutes) { bombMinutes = it }
                NumberField("Ação (seg)", actionSeconds) { actionSeconds = it }
            }
        }
        Section("SENHAS E VALIDAÇÃO") {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedTextField(armCode, { armCode = it.filter(Char::isDigit).take(8) }, label = { Text("Arme") }, modifier = Modifier.weight(1f))
                OutlinedTextField(defuseCode, { defuseCode = it.filter(Char::isDigit).take(8) }, label = { Text("Desarme") }, modifier = Modifier.weight(1f))
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Checkbox(qrRequired, { qrRequired = it })
                Text("Exigir QR antes da senha")
            }
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Button(onClick = {
                viewModel.configure(
                    BombConfig(
                        name = name.ifBlank { "Bomba Alfa" },
                        gameDurationSeconds = (gameMinutes.toIntOrNull() ?: 60).coerceAtLeast(1) * 60,
                        bombDurationSeconds = (bombMinutes.toIntOrNull() ?: 10).coerceAtLeast(1) * 60,
                        actionDurationSeconds = (actionSeconds.toIntOrNull() ?: 10).coerceAtLeast(1),
                        armCode = armCode.ifBlank { "2468" },
                        defuseCode = defuseCode.ifBlank { "1357" },
                        qrRequired = qrRequired
                    )
                )
            }) { Text("Salvar configuração") }
            Button(onClick = viewModel::startGame, enabled = !state.running, colors = ButtonDefaults.buttonColors(containerColor = OpsGreen)) { Text("Iniciar partida") }
            OutlinedButton(onClick = viewModel::reset) { Text("Reiniciar") }
        }
        MessagePanel(state)
    }
}

@Composable
private fun ArtifactScreen(state: GameState, viewModel: GameViewModel) {
    val activity = LocalContext.current as? Activity
    DisposableEffect(activity) {
        activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        onDispose { activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
    }
    var entry by remember { mutableStateOf("") }
    val pending = state.pendingAction
    val unlocked = pending != null && pending.qrValidated
    Box(Modifier.fillMaxSize().background(Color.Black)) {
        BoxWithConstraints(
            Modifier.fillMaxWidth().aspectRatio(1.5f).align(Alignment.Center)
        ) {
            val compact = maxWidth < 700.dp
            Image(
                painter = painterResource(R.drawable.maleta_bomba_interface),
                contentDescription = "Maleta de operação do artefato",
                contentScale = ContentScale.FillBounds,
                modifier = Modifier.fillMaxSize()
            )

            HardwareLabel("TEMPO DA BOMBA", Modifier.absoluteArea(maxWidth, maxHeight, .196f, .143f, .142f, .047f), compact)
            HardwareDisplay(
                value = formatTime(state.bombSeconds),
                color = OpsRed,
                modifier = Modifier.absoluteArea(maxWidth, maxHeight, .137f, .202f, .335f, .177f),
                large = true,
                compact = compact
            )

            HardwareLabel("TEMPO DE JOGO", Modifier.absoluteArea(maxWidth, maxHeight, .548f, .171f, .148f, .044f), compact)
            HardwareDisplay(
                value = formatTime(state.gameSeconds),
                color = OpsRed,
                modifier = Modifier.absoluteArea(maxWidth, maxHeight, .535f, .222f, .158f, .073f),
                large = false,
                compact = compact
            )

            HardwareLabel("STATUS", Modifier.absoluteArea(maxWidth, maxHeight, .548f, .317f, .148f, .041f), compact)
            HardwareDisplay(
                value = when {
                    state.winner != null -> state.winner.uppercase()
                    unlocked && entry.isNotEmpty() -> "*".repeat(entry.length)
                    else -> state.status.label.uppercase()
                },
                color = if (state.status == BombStatus.DEFUSED) OpsGreen else OpsRed,
                modifier = Modifier.absoluteArea(maxWidth, maxHeight, .535f, .366f, .158f, .073f),
                large = false,
                compact = compact
            )

            HardwareLabel(
                if (state.config.qrRequired) "ESCANEAR CÓDIGO" else "QR DESATIVADO",
                Modifier.absoluteArea(maxWidth, maxHeight, .533f, .486f, .207f, .045f),
                compact
            )
            MilitaryQr(
                enabled = state.running && state.config.qrRequired,
                modifier = Modifier.absoluteArea(maxWidth, maxHeight, .539f, .542f, .202f, .298f)
            )

            TransparentKeypad(
                enabled = unlocked,
                modifier = Modifier.absoluteArea(maxWidth, maxHeight, .222f, .505f, .211f, .351f),
                onKey = { key ->
                    when (key) {
                        "C" -> entry = ""
                        "OK" -> { viewModel.submitCode(entry); entry = "" }
                        else -> if (entry.length < 8) entry += key
                    }
                }
            )

            Box(
                Modifier.absoluteArea(maxWidth, maxHeight, .008f, .025f, .08f, .055f)
                    .background(Color.Black.copy(alpha = .72f))
                    .border(1.dp, OpsPaper.copy(alpha = .5f))
                    .clickable(onClick = viewModel::leaveRole),
                contentAlignment = Alignment.Center
            ) { Text("SAIR", color = OpsPaper, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
        }
    }
}

private fun Modifier.absoluteArea(
    width: androidx.compose.ui.unit.Dp,
    height: androidx.compose.ui.unit.Dp,
    x: Float,
    y: Float,
    w: Float,
    h: Float
): Modifier = offset(width * x, height * y).size(width * w, height * h)

@Composable
private fun HardwareLabel(text: String, modifier: Modifier, compact: Boolean) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Text(
            text = text,
            color = Color(0xFF231D14),
            fontSize = if (compact) 8.sp else 13.sp,
            fontFamily = FontFamily.Serif,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 1
        )
    }
}

@Composable
private fun HardwareDisplay(value: String, color: Color, modifier: Modifier, large: Boolean, compact: Boolean) {
    Box(modifier, contentAlignment = Alignment.Center) {
        Text(
            text = value,
            color = color,
            fontSize = if (large) { if (compact) 34.sp else 64.sp } else { if (compact) 12.sp else 20.sp },
            fontFamily = FontFamily.Monospace,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            maxLines = 1
        )
    }
}

@Composable
private fun MilitaryQr(enabled: Boolean, modifier: Modifier = Modifier) {
    val pattern = listOf(
        "111010111", "101101101", "111011111", "000110000", "101011101",
        "011101010", "111010111", "101111101", "111001111"
    )
    Column(modifier.background(if (enabled) Color(0xFFE5D3A5) else Color(0xFF8A8068)).padding(8.dp)) {
        pattern.forEach { row ->
            Row(Modifier.weight(1f)) {
                row.forEach { cell ->
                    Box(Modifier.weight(1f).fillMaxHeight().background(if (enabled && cell == '1') Color.Black else Color.Transparent))
                }
            }
        }
    }
}

@Composable
private fun TransparentKeypad(enabled: Boolean, modifier: Modifier, onKey: (String) -> Unit) {
    val rows = listOf(listOf("1", "2", "3"), listOf("4", "5", "6"), listOf("7", "8", "9"), listOf("C", "0", "OK"))
    Column(modifier, verticalArrangement = Arrangement.spacedBy(4.dp)) {
        rows.forEach { row ->
            Row(Modifier.weight(1f), horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                row.forEach { key ->
                    Box(
                        Modifier.weight(1f).fillMaxHeight()
                            .clickable(enabled = enabled) { onKey(key) },
                        contentAlignment = Alignment.Center
                    ) {
                        if (!enabled) Box(Modifier.fillMaxSize().background(Color.Black.copy(alpha = .18f)))
                    }
                }
            }
        }
    }
}

@Composable
private fun PlayerScreen(state: GameState, viewModel: GameViewModel) {
    Column(Modifier.fillMaxSize().padding(18.dp).verticalScroll(rememberScrollState())) {
        ScreenHeader("Terminal do jogador", viewModel::leaveRole)
        Spacer(Modifier.height(16.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Team.entries.forEach { team ->
                OutlinedButton(onClick = { viewModel.selectTeam(team) }, colors = ButtonDefaults.outlinedButtonColors(containerColor = if (state.selectedTeam == team) MaterialTheme.colorScheme.surfaceVariant else Color.Transparent)) {
                    Text(team.title)
                }
            }
        }
        Spacer(Modifier.height(14.dp))
        Section("OBJETIVO") {
            Text(if (state.selectedTeam == Team.CT) "Localize e neutralize o artefato." else "Localize, arme e proteja o artefato.")
        }
        Section("TERMINAL") {
            Text(state.message, color = OpsPaper)
            Text("Artefato: ${state.config.name}", color = MaterialTheme.colorScheme.onSurfaceVariant)
            Spacer(Modifier.height(8.dp))
            Button(
                onClick = { viewModel.requestAction(if (state.selectedTeam == Team.CT) ActionType.DEFUSE else ActionType.ARM) },
                enabled = state.running
            ) { Text(if (state.selectedTeam == Team.CT) "Solicitar desarme" else "Solicitar arme") }
            if (state.pendingAction?.team == state.selectedTeam && state.config.qrRequired && !state.pendingAction.qrValidated) {
                Button(onClick = viewModel::validateQr, colors = ButtonDefaults.buttonColors(containerColor = OpsAmber)) { Text("Simular leitura do QR") }
            }
        }
        MessagePanel(state)
    }
}

@Composable
private fun StatusStrip(state: GameState) {
    Row(Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surface).border(1.dp, MaterialTheme.colorScheme.outline).padding(12.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        Column { Label("ESTADO"); Text(state.status.label) }
        Column(horizontalAlignment = Alignment.End) { Label("JOGO"); Text(formatTime(state.gameSeconds), fontFamily = FontFamily.Monospace) }
    }
}

@Composable
private fun TimerPanel(label: String, seconds: Int?, color: Color, modifier: Modifier = Modifier) {
    Column(modifier.background(Color(0xFF050604)).border(2.dp, MaterialTheme.colorScheme.outline).padding(12.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        Text(label, color = OpsPaper, fontSize = 12.sp)
        Text(formatTime(seconds), color = color, fontSize = 42.sp, fontFamily = FontFamily.Monospace, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun FakeQr(enabled: Boolean) {
    Box(Modifier.size(150.dp).background(if (enabled) Color.White else Color.DarkGray).padding(10.dp), contentAlignment = Alignment.Center) {
        Text(if (enabled) "QR\nETAPA" else "INATIVO", color = Color.Black, fontSize = 24.sp, textAlign = TextAlign.Center, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun Section(title: String, content: @Composable ColumnScope.() -> Unit) {
    Column(Modifier.fillMaxWidth().padding(bottom = 12.dp).background(MaterialTheme.colorScheme.surface).border(1.dp, MaterialTheme.colorScheme.outline).padding(14.dp)) {
        Label(title)
        Spacer(Modifier.height(8.dp))
        content()
    }
}

@Composable
private fun NumberField(label: String, value: String, onChange: (String) -> Unit) {
    OutlinedTextField(value, { onChange(it.filter(Char::isDigit).take(4)) }, label = { Text(label) }, modifier = Modifier.width(150.dp))
}

@Composable
private fun MessagePanel(state: GameState) {
    HorizontalDivider(Modifier.padding(vertical = 14.dp))
    Text(state.winner ?: state.message, color = if (state.winner != null) OpsGreen else MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun Label(text: String) {
    Text(text, color = OpsPaper, fontSize = 12.sp, fontWeight = FontWeight.Bold)
}

private fun formatTime(seconds: Int?): String {
    if (seconds == null) return "--:--"
    return "%02d:%02d".format(seconds / 60, seconds % 60)
}
