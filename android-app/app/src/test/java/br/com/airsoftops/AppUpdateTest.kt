package br.com.airsoftops

import org.junit.Assert.*
import org.junit.Test

class AppUpdateTest {
    private val url = "https://github.com/montanhagr-BR/airsoft-ops/releases/download/v1.0.0-beta.2/app.apk"

    @Test fun onlyNewerVersionsPrompt() {
        val update = AppUpdate(39, "1.0.0-beta.2", url)
        assertTrue(update.isAvailable(38))
        assertFalse(update.isAvailable(39))
        assertFalse(update.isAvailable(40))
    }

    @Test fun rejectsUnexpectedDownloads() {
        listOf(url.replace("https:", "http:"), url.replace("github.com", "evil.example"),
            url.replace("airsoft-ops", "other-repo"), "$url?redirect=evil", "broken", 
            url.replace("app.apk", "../app.apk"), url.replace("app.apk", "app.exe"))
            .forEach { assertFalse(it, AppUpdate(39, "beta", it).isAvailable(38)) }
    }
}
