package br.com.airsoftops.ui

import android.Manifest
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.content.pm.PackageManager
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
    val webView = remember {
        WebView(context).apply {
            WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
            isFocusable = true
            isFocusableInTouchMode = true
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.databaseEnabled = true
            settings.cacheMode = WebSettings.LOAD_DEFAULT
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.mediaPlaybackRequiresUserGesture = false
            val cookieManager = CookieManager.getInstance()
            cookieManager.setAcceptCookie(true)
            cookieManager.setAcceptThirdPartyCookies(this, true)
            addJavascriptInterface(AppSoundBridge(context), "AirsoftSound")
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
            val suffix = "?android=1"
            val onlineUrl = "https://warm-hummingbird-8988f6.netlify.app/$page$suffix"
            loadUrl(onlineUrl)
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
            val stream = if (kind == "button") AudioManager.STREAM_MUSIC else AudioManager.STREAM_ALARM
            val previousVolume = audioManager.getStreamVolume(stream)
            val maxVolume = audioManager.getStreamMaxVolume(stream)
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
            if (kind != "button") audioManager.setStreamVolume(stream, maxVolume, 0)
            val generator = ToneGenerator(stream, if (kind == "button") 55 else 100)
            generator.startTone(tone, duration)
            handler.postDelayed({
                generator.release()
                if (kind != "button") audioManager.setStreamVolume(stream, previousVolume, 0)
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
