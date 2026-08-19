Here is the exact blueprint to bootstrap your Kotlin Edge Agent. Since this is the foundational worker node for a distributed system, we will structure it like a clean-architecture microservice rather than a traditional UI-heavy Android app.
You can initialize this project in your standard local workspace (e.g., /Users/manthan/Documents/EdgeAgent) using Android Studio. Choose the "No Activity" template, as this agent will run as a headless background service.
1. Project Level build.gradle.kts
Ensure your project is using a modern Kotlin version (1.9.0+) and includes the serialization plugin.
plugins {
    id("com.android.application") version "8.2.0" apply false
    id("org.jetbrains.kotlin.android") version "1.9.10" apply false
    id("org.jetbrains.kotlin.plugin.serialization") version "1.9.10" apply false
}

2. App Level app/build.gradle.kts
This is where the magic happens. We need Shizuku for system-level Binder IPC, Ktor Client (to dial out to your Python server), and Coroutines for concurrency.
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

android {
    namespace = "com.modernos.edgeagent"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.modernos.edgeagent"
        minSdk = 28 // Android 9 (Minimum for modern UiAutomation & Shizuku)
        targetSdk = 34
        versionCode = 1
        versionName = "1.0"
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    // 1. Shizuku API (For Binder IPC and UserService)
    val shizukuVersion = "13.1.5"
    implementation("dev.rikka.shizuku:api:$shizukuVersion")
    implementation("dev.rikka.shizuku:provider:$shizukuVersion")

    // 2. Ktor WebSocket Client (To dial out to the Python Control Plane)
    val ktorVersion = "2.3.6"
    implementation("io.ktor:ktor-client-core:$ktorVersion")
    implementation("io.ktor:ktor-client-cio:$ktorVersion") // Asynchronous I/O engine
    implementation("io.ktor:ktor-client-websockets:$ktorVersion")
    
    // 3. Kotlinx Serialization (For JSON parsing)
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.0")

    // 4. Coroutines (For concurrent WebSocket streams and background tasks)
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.7.3")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.7.3")
}

3. The AndroidManifest.xml
Because this is a headless agent, we need to declare permissions for the internet and specifically request Shizuku's permission.
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">

    <!-- Network permissions to talk to the Control Plane -->
    <uses-permission android:name="android.permission.INTERNET" />
    
    <!-- Shizuku Permission -->
    <uses-permission android:name="moe.shizuku.manager.permission.API_V23" />

    <application
        android:allowBackup="false"
        android:icon="@mipmap/ic_launcher"
        android:label="Edge Agent"
        android:roundIcon="@mipmap/ic_launcher_round"
        android:supportsRtl="true"
        android:theme="@style/Theme.AppCompat.NoActionBar">

        <!-- A lightweight foreground service to keep the WebSocket alive -->
        <service
            android:name=".network.AgentConnectionService"
            android:exported="false"
            android:foregroundServiceType="dataSync" />

        <!-- Optional: A dummy activity just to trigger the Shizuku permission prompt manually -->
        <activity
            android:name=".MainActivity"
            android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.MAIN" />
                <category android:name="android.intent.category.LAUNCHER" />
            </intent-filter>
        </activity>

    </application>
</manifest>

4. The Architectural Package Structure
To enforce separation of concerns, create the following package structure inside app/src/main/java/com/modernos/edgeagent/:
 * 📁 network/ (Handles Earth-to-Rover communication)
   * ControlPlaneClient.kt: The Ktor WebSocket client. Manages the persistent connection, exponential backoff reconnects, and routes incoming JSON strings to the execution engine.
   * ProtocolModels.kt: Kotlin @Serializable data classes representing your command and response JSON schemas.
 * 📁 shizuku/ (Handles privilege escalation)
   * ShizukuInitializer.kt: Checks if the Shizuku daemon is pingable and handles permission requests.
   * AgentUserService.kt: The AIDL implementation for Shizuku's UserService. This is where the elevated process actually lives.
 * 📁 automation/ (The Semantic Brain)
   * SemanticNode.kt: The lightweight data class representing a flattened UI element.
   * UiTreeParser.kt: The recursive engine that grabs UiAutomation.rootInActiveWindow and flattens it.
   * TouchInjector.kt: The engine that generates organic MotionEvent coordinates and injects them via UiAutomation.
 * 📁 execution/ (The Workflow Manager)
   * CommandHandler.kt: The switchboard. When a UI_TAP command arrives from the network, this class orchestrates UiTreeParser -> TouchInjector and sends the success/fail result back to the network client.
5. Your First Development Task
Before writing the complex Ktor client or the UI parser, start with MainActivity.kt. Use it purely as a temporary debug dashboard to bind to Shizuku and request permission.
Once you click "Allow" on the Shizuku permission prompt, you can delete the UI and move everything into AgentConnectionService.kt to run invisibly in the background.