package br.com.airsoftops

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import br.com.airsoftops.ui.AirsoftOpsApp
import br.com.airsoftops.ui.theme.AirsoftOpsTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        enableEdgeToEdge()
        setContent {
            AirsoftOpsTheme {
                AirsoftOpsApp()
            }
        }
    }
}
