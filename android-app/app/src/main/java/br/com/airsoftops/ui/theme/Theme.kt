package br.com.airsoftops.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val OpsBlack = Color(0xFF080A07)
val OpsPanel = Color(0xFF151810)
val OpsOlive = Color(0xFF6E7443)
val OpsPaper = Color(0xFFE4D19D)
val OpsRed = Color(0xFFD84332)
val OpsGreen = Color(0xFF6E9B42)
val OpsAmber = Color(0xFFD6A33B)

private val AirsoftColorScheme = darkColorScheme(
    primary = OpsOlive,
    onPrimary = Color.White,
    secondary = OpsAmber,
    onSecondary = OpsBlack,
    error = OpsRed,
    background = OpsBlack,
    onBackground = Color(0xFFF2EBD8),
    surface = OpsPanel,
    onSurface = Color(0xFFF2EBD8),
    surfaceVariant = Color(0xFF24271D),
    onSurfaceVariant = Color(0xFFC8C6B7),
    outline = Color(0xFF595B47)
)

@Composable
fun AirsoftOpsTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = AirsoftColorScheme,
        content = content
    )
}
