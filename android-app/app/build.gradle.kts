plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.plugin.compose")
}

android {
    namespace = "br.com.airsoftops"
    compileSdk = 37

    defaultConfig {
        applicationId = "br.com.airsoftops"
        minSdk = 26
        targetSdk = 37
        versionCode = 41
        versionName = "1.0.0-beta.4"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables.useSupportLibrary = true
    }

    buildTypes {
        getByName("debug") {
            signingConfig = signingConfigs.getByName("debug").apply {
                storeFile = rootProject.file(".debug/debug.keystore")
                storePassword = "android"
                keyAlias = "androiddebugkey"
                keyPassword = "android"
            }
        }
        release {
            isMinifyEnabled = false
            // Play uploads must use a private upload key, never the debug key.
            val uploadStore = providers.environmentVariable("ANDROID_UPLOAD_KEYSTORE").orNull
            if (uploadStore != null) {
                signingConfig = signingConfigs.create("playUpload") {
                    storeFile = file(uploadStore)
                    storePassword = providers.environmentVariable("ANDROID_UPLOAD_STORE_PASSWORD").get()
                    keyAlias = providers.environmentVariable("ANDROID_UPLOAD_KEY_ALIAS").get()
                    keyPassword = providers.environmentVariable("ANDROID_UPLOAD_KEY_PASSWORD").get()
                }
            }
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    buildFeatures {
        buildConfig = true
        compose = true
    }
}

dependencies {
    val composeBom = platform("androidx.compose:compose-bom:2026.09.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.activity:activity-compose:1.13.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.10.0")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.10.0")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.foundation:foundation")
    implementation("androidx.compose.material3:material3")

    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")

    testImplementation("junit:junit:4.13.2")
    androidTestImplementation("androidx.test.ext:junit:1.3.0")
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
}
