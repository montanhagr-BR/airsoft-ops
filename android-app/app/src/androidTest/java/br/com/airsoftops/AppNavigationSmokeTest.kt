package br.com.airsoftops

import androidx.activity.compose.setContent
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.ext.junit.runners.AndroidJUnit4
import br.com.airsoftops.model.AppRole
import br.com.airsoftops.ui.PrototypeWebScreen
import br.com.airsoftops.ui.theme.AirsoftOpsTheme
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class AppNavigationSmokeTest {
    @Test
    fun homeOpensWithoutCrash() {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            Thread.sleep(2_000)
            assertEquals(Lifecycle.State.RESUMED, scenario.state)
            scenario.onActivity { activity ->
                assertFalse(activity.isFinishing)
                assertFalse(activity.isDestroyed)
            }
            scenario.onActivity { activity ->
                val view = activity.window.decorView
                val screenshot = android.graphics.Bitmap.createBitmap(
                    view.width,
                    view.height,
                    android.graphics.Bitmap.Config.ARGB_8888
                )
                view.draw(android.graphics.Canvas(screenshot))
                var visiblePixels = 0
                val step = 12
                for (y in 0 until screenshot.height step step) {
                    for (x in 0 until screenshot.width step step) {
                        val pixel = screenshot.getPixel(x, y)
                        val brightness = android.graphics.Color.red(pixel) +
                            android.graphics.Color.green(pixel) + android.graphics.Color.blue(pixel)
                        if (brightness > 45) visiblePixels++
                    }
                }
                val samples = ((screenshot.width + step - 1) / step) *
                    ((screenshot.height + step - 1) / step)
                assertTrue("Janela do app preta: $visiblePixels de $samples amostras visíveis", visiblePixels > samples / 10)
                screenshot.recycle()
            }
        }
    }

    @Test
    fun controllerOpensWithoutCrash() = assertRoleStaysAlive(AppRole.CONTROLLER)

    @Test
    fun artifactOpensWithoutCrash() = assertRoleStaysAlive(AppRole.ARTIFACT)

    @Test
    fun playerOpensWithoutCrash() = assertRoleStaysAlive(AppRole.PLAYER)

    private fun assertRoleStaysAlive(role: AppRole) {
        ActivityScenario.launch(MainActivity::class.java).use { scenario ->
            scenario.onActivity { activity ->
                activity.setContent {
                    AirsoftOpsTheme {
                        PrototypeWebScreen(role = role, onBack = {})
                    }
                }
            }
            Thread.sleep(3_000)
            scenario.onActivity { activity ->
                assertFalse(activity.isFinishing)
                assertFalse(activity.isDestroyed)
            }
        }
    }
}
