package br.com.airsoftops.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
import android.speech.tts.TextToSpeech
import java.util.Locale
import android.media.AudioAttributes
import android.media.AudioManager
import android.media.ToneGenerator
import android.net.Uri
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.webkit.ConsoleMessage
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.GeolocationPermissions
import android.webkit.PermissionRequest
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebSettings
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.activity.compose.BackHandler
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.ui.Modifier
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import br.com.airsoftops.model.AppRole
import br.com.airsoftops.BuildConfig
import br.com.airsoftops.MainActivity
import java.io.ByteArrayInputStream

@Composable
fun PrototypeWebScreen(role: AppRole, onBack: () -> Unit) {
    val context = LocalContext.current
    val activity = context as? Activity
    val page = when (role) {
        AppRole.CONTROLLER -> "controle.html"
        AppRole.ARTIFACT -> "bomba.html"
        AppRole.PLAYER -> "jogador.html"
        AppRole.PORTAL -> "index.html"
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }
    var loadError by remember { mutableStateOf<String?>(null) }
    var pageLoaded by remember { mutableStateOf(false) }
    val voiceBridge = remember { AppVoiceBridge(context) }
    val webView = remember {
        WebView(context).apply {
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.cacheMode = WebSettings.LOAD_NO_CACHE
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mediaPlaybackRequiresUserGesture = false
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(AppSoundBridge(context), "AirsoftSound")
            addJavascriptInterface(voiceBridge, "AirsoftNativeVoice")
            webViewClient = object : WebViewClient() {
                override fun onPageStarted(view: WebView, url: String, favicon: android.graphics.Bitmap?) {
                    pageLoaded = false
                    loadError = null
                }
                override fun shouldOverrideUrlLoading(
                    view: WebView,
                    request: WebResourceRequest
                ): Boolean {
                    val url = request.url.toString()
                    if (url.contains("airsoft.local") || url.contains("netlify.app")) {
                        return false
                    }
                    if (url.contains("accounts.google.com") || url.contains("supabase.co/auth") || url.contains("provider=google")) {
                        try {
                            val intent = Intent(Intent.ACTION_VIEW, Uri.parse(url))
                            context.startActivity(intent)
                        } catch (_: Exception) {}
                        return true
                    }
                    return false
                }
                override fun shouldInterceptRequest(
                    view: WebView,
                    request: WebResourceRequest
                ): WebResourceResponse? {
                    if (request.url.host == "airsoft.local") {
                        return bundledAssetResponse(context.assets, request.url)
                    }
                    // Keep the production origin for saved sessions and OAuth,
                    // while loading the tested UI shipped with this APK.
                    if (request.url.scheme == "https" && request.url.host == "warm-hummingbird-8988f6.netlify.app") {
                        val assetUri = request.url.buildUpon().authority("airsoft.local").build()
                        val bundled = bundledAssetResponse(context.assets, assetUri)
                        if (bundled?.statusCode == 200) return bundled
                    }
                    return super.shouldInterceptRequest(view, request)
                }

                override fun onPageFinished(view: WebView, url: String) {
                    pageLoaded = true
                    loadError = null
                    val currentPage = Uri.parse(url).lastPathSegment
                    activity?.requestedOrientation = if (currentPage == "bomba.html") {
                        ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
                    } else ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
                    if (currentPage in listOf("controle.html", "bomba.html", "jogador.html")) {
                        val missing = buildList {
                            if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                                add(Manifest.permission.ACCESS_FINE_LOCATION)
                                add(Manifest.permission.ACCESS_COARSE_LOCATION)
                            }
                            if (currentPage != "controle.html" && context.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                                add(Manifest.permission.CAMERA)
                            }
                        }
                        if (missing.isNotEmpty()) permissionLauncher.launch(missing.toTypedArray())
                    }
                    view.evaluateJavascript(
                        """
                        (() => {
                          if (window.__airsoftButtonSound) return;
                          window.__airsoftButtonSound = true;
                          document.addEventListener('click', event => {
                            const button = event.target.closest('button, [role="button"], a.action');
                            if (button && !button.disabled && window.AirsoftSound) AirsoftSound.play('button');
                          }, true);
                        })();
                        """.trimIndent(),
                        null
                    )
                    if (role == AppRole.ARTIFACT) {
                        view.evaluateJavascript(
                            """
                            (() => {
                              const measure = selector => {
                                const element = document.querySelector(selector);
                                if (!element) return null;
                                const rect = element.getBoundingClientRect();
                                const style = getComputedStyle(element);
                                return { x:rect.x, y:rect.y, width:rect.width, height:rect.height,
                                  display:style.display, overflow:style.overflow, transform:style.transform };
                              };
                              return JSON.stringify({ width:innerWidth, height:innerHeight,
                                scale:getComputedStyle(document.documentElement).getPropertyValue('--bomb-scale'),
                                device:measure('.device'), setupLayer:measure('.deviceSetupLayer'),
                                setup:measure('.deviceSetup'), popup:measure('.popup') });
                            })()
                            """.trimIndent()
                        ) { result -> Log.d("AirsoftWebLayout", result) }
                    }
                }

                override fun onReceivedError(
                    view: WebView,
                    request: WebResourceRequest,
                    error: WebResourceError
                ) {
                    if (request.isForMainFrame) {
                        val failedUrl = request.url.toString()
                        if (failedUrl.contains("netlify.app")) {
                            val path = request.url.path.orEmpty().ifEmpty { "/index.html" }
                            val query = request.url.encodedQuery?.let { "?$it" } ?: "?android=1"
                            val fallback = "https://airsoft.local$path$query"
                            view.loadUrl(fallback)
                        } else {
                            loadError = "Falha ao abrir ${role.title}: ${error.description}"
                        }
                    }
                }
            }
            webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                    Log.d("AirsoftWebView", "${consoleMessage.message()} -- Line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}")
                    return true
                }

                override fun onPermissionRequest(request: PermissionRequest) {
                    activity?.runOnUiThread {
                        val requestsCamera = request.resources.contains(
                            PermissionRequest.RESOURCE_VIDEO_CAPTURE
                        )
                        val cameraGranted = context.checkSelfPermission(
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                        if (!requestsCamera || cameraGranted) {
                            request.grant(request.resources)
                        } else {
                            request.deny()
                        }
                    }
                }

                override fun onGeolocationPermissionsShowPrompt(
                    origin: String,
                    callback: GeolocationPermissions.Callback
                ) {
                    val granted = context.checkSelfPermission(
                        Manifest.permission.ACCESS_FINE_LOCATION
                    ) == PackageManager.PERMISSION_GRANTED
                    callback.invoke(origin, granted, false)
                }
            }
            requestFocus()
            val initialUrl = MainActivity.pendingAuthUrl?.let {
                MainActivity.pendingAuthUrl = null
                it
            } ?: run {
                val suffix = if (role == AppRole.CONTROLLER) "?appVersion=${BuildConfig.VERSION_CODE}" else "?android=1&appVersion=${BuildConfig.VERSION_CODE}"
                "https://warm-hummingbird-8988f6.netlify.app/$page$suffix"
            }
            loadUrl(initialUrl)
        }
    }

    LaunchedEffect(Unit) {
        if (role == AppRole.PORTAL) return@LaunchedEffect
        val requiredPermissions = buildList {
            if (context.checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) != PackageManager.PERMISSION_GRANTED) {
                add(Manifest.permission.ACCESS_FINE_LOCATION)
                add(Manifest.permission.ACCESS_COARSE_LOCATION)
            }
            if (role != AppRole.CONTROLLER && context.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
                add(Manifest.permission.CAMERA)
            }
        }
        if (requiredPermissions.isNotEmpty()) {
            permissionLauncher.launch(requiredPermissions.toTypedArray())
        }
    }

    DisposableEffect(role) {
        if (role == AppRole.ARTIFACT) {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        }
        onDispose {
            activity?.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
            webView.stopLoading()
            webView.destroy()
            voiceBridge.close()
        }
    }

    BackHandler {
        webView.evaluateJavascript(
            "(() => { if (typeof AirsoftPortal !== 'undefined') return AirsoftPortal.back(); if (typeof AirsoftCloud !== 'undefined') return AirsoftCloud.back(); return false; })()"
        ) { handled ->
            if (handled != "true") {
                if (webView.canGoBack()) webView.goBack()
                else if (role == AppRole.PORTAL) activity?.finish()
                else onBack()
            }
        }
    }

    Box(Modifier.fillMaxSize()) {
        AndroidView(
            factory = { webView },
            modifier = Modifier.fillMaxSize()
        )
        if (!pageLoaded || loadError != null) {
            Text(
                text = loadError ?: "CARREGANDO ${role.title.uppercase()}...",
                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                color = if (loadError == null) Color(0xFFF0D486) else Color(0xFFFF6B5F)
            )
        }
    }
}

private class AppSoundBridge(context: Context) {
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val handler = Handler(Looper.getMainLooper())

    @JavascriptInterface
    fun play(kind: String) {
        if (audioManager.ringerMode != AudioManager.RINGER_MODE_NORMAL) return
        handler.post {
            val stream = AudioManager.STREAM_MUSIC
            val tone = when (kind) {
                "armed" -> ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD
                "locator" -> ToneGenerator.TONE_PROP_BEEP2
                else -> ToneGenerator.TONE_PROP_BEEP
            }
            val duration = when (kind) {
                "armed" -> 280
                "locator" -> 160
                else -> 45
            }
            val generator = ToneGenerator(stream, if (kind == "button") 55 else 100)
            generator.startTone(tone, duration)
            handler.postDelayed({
                generator.release()
            }, duration.toLong() + 80L)
        }
    }
}

private fun bundledAssetResponse(
    assets: android.content.res.AssetManager,
    uri: Uri
): WebResourceResponse? {
    if (uri.scheme != "https" || uri.host != "airsoft.local") return null
    val path = uri.path.orEmpty().trimStart('/').ifEmpty { "index.html" }
    if (path.split('/').any { it == ".." }) return errorResponse(403, "Acesso negado")

    val mimeType = when (path.substringAfterLast('.', "").lowercase()) {
        "html" -> "text/html"
        "css" -> "text/css"
        "js" -> "application/javascript"
        "json" -> "application/json"
        "wav" -> "audio/wav"
        "mp3" -> "audio/mpeg"
        "png" -> "image/png"
        "jpg", "jpeg" -> "image/jpeg"
        "svg" -> "image/svg+xml"
        else -> "application/octet-stream"
    }
    val encoding = if (
        mimeType.startsWith("text/") ||
        mimeType == "application/javascript" ||
        mimeType == "application/json" ||
        mimeType == "image/svg+xml"
    ) "UTF-8" else null

    return try {
        WebResourceResponse(
            mimeType,
            encoding,
            200,
            "OK",
            mapOf(
                "Cache-Control" to "no-store",
                "Access-Control-Allow-Origin" to "https://airsoft.local"
            ),
            assets.open("www/$path")
        )
    } catch (_: Exception) {
        errorResponse(404, "Recurso não encontrado: $path")
    }
}

private fun errorResponse(status: Int, message: String): WebResourceResponse {
    val reasonPhrase = when (status) {
        403 -> "Forbidden"
        404 -> "Not Found"
        else -> "Error"
    }
    return WebResourceResponse(
        "text/plain",
        "UTF-8",
        status,
        reasonPhrase,
        mapOf("Cache-Control" to "no-store"),
        ByteArrayInputStream(message.toByteArray(Charsets.UTF_8))
    )
}

private class AppVoiceBridge(private val context: Context) {
    private val handler = Handler(Looper.getMainLooper())
    private var engine: TextToSpeech? = null
    private var pending: String? = null
    private var closed = false
    @Volatile private var state = "initializing"

    init {
        engine = TextToSpeech(context.applicationContext) { result ->
            handler.post {
                if (!closed) {
                    val tts = engine
                    if (result != TextToSpeech.SUCCESS || tts == null) state = "unavailable"
                    else {
                        val language = tts.setLanguage(Locale("pt", "BR"))
                        state = if (language == TextToSpeech.LANG_MISSING_DATA) "missing-data"
                            else if (language == TextToSpeech.LANG_NOT_SUPPORTED) "unsupported"
                            else "ready"
                        tts.setAudioAttributes(AudioAttributes.Builder()
                            .setUsage(AudioAttributes.USAGE_MEDIA)
                            .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH).build())
                        pending?.let { text -> if (state == "ready") say(text) }
                        pending = null
                    }
                }
            }
        }
    }
    @JavascriptInterface fun status(): String = state
    @JavascriptInterface fun speak(text: String) {
        handler.post {
            if (!closed) {
                if (state == "initializing") pending = text.take(500)
                else if (state == "ready") say(text.take(500))
            }
        }
    }
    private fun say(text: String) {
        if (engine?.speak(text, TextToSpeech.QUEUE_FLUSH, null, "airsoft-voice") == TextToSpeech.ERROR)
            state = "unavailable"
    }
    @JavascriptInterface fun stop() { handler.post { pending = null; engine?.stop() } }
    @JavascriptInterface fun openSettings() {
        handler.post {
            try { context.startActivity(Intent("com.android.settings.TTS_SETTINGS").addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
            catch (_: Exception) { }
        }
    }
    fun close() { closed = true; pending = null; engine?.stop(); engine?.shutdown(); engine = null }
}
