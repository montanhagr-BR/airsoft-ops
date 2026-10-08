package br.com.airsoftops

import android.Manifest
import android.app.AlertDialog
import android.content.Intent
import android.content.pm.PackageManager
import android.os.PowerManager
import android.provider.Settings
import android.view.WindowManager
import androidx.activity.result.contract.ActivityResultContracts
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import br.com.airsoftops.ui.AirsoftOpsApp
import br.com.airsoftops.ui.theme.AirsoftOpsTheme

class MainActivity : ComponentActivity() {
    private var updateCheckStarted = false
    private var pendingUpdate: AppUpdate? = null
    private var activityResumed = false
    private var updateDialog: AlertDialog? = null

    private fun checkUpdates() {
        if (updateCheckStarted || isFinishing || isDestroyed) return
        updateCheckStarted = true
        Thread({
            val update = AppUpdateService.fetch(BuildConfig.VERSION_CODE)
            runOnUiThread {
                if (!isFinishing && !isDestroyed) {
                    pendingUpdate = update
                    showUpdateIfReady()
                }
            }
        }, "app-update-check").start()
    }

    private fun showUpdateIfReady() {
        if (!activityResumed || isFinishing || isDestroyed) return
        val update = pendingUpdate ?: return
        pendingUpdate = null
        updateDialog = AlertDialog.Builder(this)
            .setTitle("Atualização disponível")
            .setMessage("A versão ${update.versionName} está disponível. Baixe o APK e confirme a atualização no Android para receber as melhorias.")
            .setPositiveButton("Baixar atualização") { _, _ ->
                runCatching { startActivity(Intent(Intent.ACTION_VIEW, android.net.Uri.parse(update.apkUrl))) }
                    .onFailure { android.widget.Toast.makeText(this, "Não foi possível abrir o download. Tente novamente ao abrir o app.", android.widget.Toast.LENGTH_LONG).show() }
            }
            .setNegativeButton("Agora não", null)
            .show()
    }

    override fun onResume() {
        super.onResume()
        activityResumed = true
        showUpdateIfReady()
    }

    override fun onPause() {
        activityResumed = false
        super.onPause()
    }

    override fun onDestroy() {
        updateDialog?.dismiss()
        super.onDestroy()
    }
    companion object {
        var pendingAuthUrl: String? = null
    }

    private val setupPermissions = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { showBatterySetup() }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
        setShowWhenLocked(true)
        setTurnScreenOn(true)
        enableEdgeToEdge()
        handleIntent(intent)
        prepareDeviceOnFirstOpen()
        setContent {
            AirsoftOpsTheme {
                AirsoftOpsApp()
            }
        }
    }

    private fun prepareDeviceOnFirstOpen() {
        val preferences = getSharedPreferences("device-preparation", MODE_PRIVATE)
        if (preferences.getBoolean("setup-v1", false)) {
            checkUpdates()
            return
        }
        AlertDialog.Builder(this)
            .setTitle("Preparar aparelho para a partida")
            .setMessage("A tela ficará ligada enquanto o Airsoft Ops estiver aberto. Localização permite o mapa e GPS; câmera permite ler QR codes. Depois você poderá revisar a economia de bateria para este app. O Android pede sua confirmação para essas autorizações.")
            .setPositiveButton("Configurar") { _, _ ->
                preferences.edit().putBoolean("setup-v1", true).apply()
                val permissions = arrayOf(Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION, Manifest.permission.CAMERA)
                    .filter { checkSelfPermission(it) != PackageManager.PERMISSION_GRANTED }
                if (permissions.isEmpty()) showBatterySetup()
                else setupPermissions.launch(permissions.toTypedArray())
            }
            .setNegativeButton("Agora não") { _, _ ->
                preferences.edit().putBoolean("setup-v1", true).apply()
                checkUpdates()
            }
            .setOnCancelListener { checkUpdates() }
            .show()
    }

    private fun showBatterySetup() {
        val power = getSystemService(POWER_SERVICE) as PowerManager
        if (power.isIgnoringBatteryOptimizations(packageName)) {
            checkUpdates()
            return
        }
        AlertDialog.Builder(this)
            .setTitle("Economia de bateria")
            .setMessage("Nas configurações do Android, procure Airsoft Ops e permita uso sem restrições de bateria, se essa opção estiver disponível. Durante o jogo, mantenha o app aberto. Esta configuração não garante funcionamento após fechar o app ou bloquear manualmente a tela.")
            .setPositiveButton("Abrir configurações") { _, _ ->
                try { startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)) }
                catch (_: Exception) {
                    startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                        android.net.Uri.parse("package:$packageName")))
                }
            }
            .setNegativeButton("Continuar", null)
            .setOnDismissListener { checkUpdates() }
            .show()
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
