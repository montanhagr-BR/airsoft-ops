package br.com.airsoftops

import java.net.URI
import java.net.HttpURLConnection
import org.json.JSONObject

data class AppUpdate(val versionCode: Int, val versionName: String, val apkUrl: String) {
    fun isAvailable(installedCode: Int): Boolean {
        val uri = runCatching { URI(apkUrl) }.getOrNull() ?: return false
        return versionCode > installedCode && versionName.length in 1..60 &&
            uri.scheme == "https" && uri.host == "github.com" && uri.port == -1 &&
            uri.userInfo == null && uri.query == null && uri.fragment == null &&
            uri.path.startsWith("/montanhagr-BR/airsoft-ops/releases/download/") &&
            uri.path.endsWith(".apk") && !uri.path.contains("..")
    }
}

object AppUpdateService {
    const val MANIFEST_URL = "https://warm-hummingbird-8988f6.netlify.app/app-update.json"

    fun fetch(installedCode: Int): AppUpdate? = runCatching {
        val connection = URI(MANIFEST_URL).toURL().openConnection() as HttpURLConnection
        try {
            connection.connectTimeout = 8000
            connection.readTimeout = 8000
            connection.useCaches = false
            connection.setRequestProperty("Cache-Control", "no-cache")
            if (connection.responseCode != 200) return@runCatching null
            val bytes = connection.inputStream.use { input ->
                val output = java.io.ByteArrayOutputStream()
                val buffer = ByteArray(4096)
                while (output.size() <= 65536) {
                    val count = input.read(buffer)
                    if (count < 0) break
                    output.write(buffer, 0, count)
                }
                output.toByteArray()
            }
            if (bytes.size > 65536) return@runCatching null
            val json = JSONObject(String(bytes, Charsets.UTF_8))
            if (json.getString("applicationId") != "br.com.airsoftops") return@runCatching null
            AppUpdate(json.getInt("versionCode"), json.getString("versionName"),
                json.getString("apkUrl")).takeIf { it.isAvailable(installedCode) }
        } finally {
            connection.disconnect()
        }
    }.getOrNull()
}
