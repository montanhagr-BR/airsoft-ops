package br.com.airsoftops

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import br.com.airsoftops.ui.AirsoftOpsApp
import br.com.airsoftops.ui.theme.AirsoftOpsTheme

class MainActivity : ComponentActivity() {
    companion object {
        var pendingAuthUrl: String? = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        enableEdgeToEdge()
        handleIntent(intent)
        setContent {
            AirsoftOpsTheme {
                AirsoftOpsApp()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
    }

    private fun handleIntent(intent: Intent?) {
        val data = intent?.data
        if (data != null) {
            val urlStr = data.toString()
            pendingAuthUrl = if (urlStr.startsWith("airsoftops://auth-callback")) {
                urlStr.replace("airsoftops://auth-callback", "https://warm-hummingbird-8988f6.netlify.app/")
            } else {
                urlStr
            }
        }
    }
}
