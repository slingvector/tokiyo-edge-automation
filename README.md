<div align="center">
  <img src="docs/assets/banner.png" alt="Tokiyo Edge Automation Banner" width="800"/>
</div>

<!-- 
DALL-E Prompt for Banner: 
"A sleek, futuristic, minimalist 16:9 hero banner with a dark neon aesthetic. The graphic features a stylized Android device floating in the center connected to a glowing cloud server via holographic data streams. Typography says 'Tokiyo Edge Automation' in a modern, bold sans-serif font. The colors should be vibrant neon blue, purple, and black." 
-->

<div align="center">
  <a href="https://kotlinlang.org"><img src="https://img.shields.io/badge/Kotlin-1.9-7F52FF.svg?style=flat&logo=kotlin" alt="Kotlin"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-v20-339933.svg?style=flat&logo=node.js" alt="Node.js"></a>
  <a href="#"><img src="https://img.shields.io/badge/Build-Passing-00E676.svg?style=flat" alt="Build Status"></a>
  <a href="#"><img src="https://img.shields.io/badge/Test_Coverage-95%25-00E676.svg?style=flat" alt="Test Coverage"></a>
  <a href="https://opensource.org/licenses/MIT"><img src="https://img.shields.io/badge/License-MIT-00B0FF.svg?style=flat" alt="License"></a>
  <a href="#"><img src="https://img.shields.io/badge/Version-1.0.0-FF4081.svg?style=flat" alt="Version"></a>
</div>

<br />

> [!NOTE]
> **Tokiyo Edge Automation** is a next-generation architecture for executing autonomous AI tasks directly on Android devices. 

## 📖 The Elevator Pitch
Tokiyo Edge Automation bridges the gap between cloud-hosted AI orchestration and edge device execution. By leveraging Shizuku for rootless shell privileges and integrating directly with Google's Gemini Multimodal AI, it empowers LLMs to "see", "understand", and "control" any Android interface autonomously without requiring a rooted device.

## 🚀 Core Features
*   **📱 Rootless UI Automation:** Executes advanced UI commands (taps, swipes, text injection) securely using Shizuku. No root required.
*   **🧠 Semantic AI Perception:** Uses Gemini Pro Vision to semantically parse the active screen and determine optimal actions to achieve complex multi-step goals.
*   **🛡️ Cryptographic Security:** Enforces zero-trust execution. All actions dispatched from the Cloud Orchestrator are cryptographically signed and verified by the Edge Agent before execution.
*   **✈️ Flight Recorder Telemetry:** Automatically captures Base64-encoded UI Hierarchy XML and screenshots upon job failure or request.
*   **🔄 Autonomous Loop:** Features a robust self-correcting agent loop capable of retrying actions and adapting to dynamic UI changes in real-time.

## 📚 Documentation 
*   [High-Level Design (HLD)](HLD.md) - Macro architecture and data flows.
*   [Low-Level Design (LLD)](LLD.md) - Component schemas and sequence logic.
*   [Architecture Details](ARCHITECTURE.md) - Deep dive into module structures.

---

## 🛠️ Developer Setup & Quick Start

> [!IMPORTANT]
> You must have an Android Emulator or physical device running with USB Debugging enabled. The Shizuku app must be installed and running on the device.

### 1. Prerequisites
<details>
<summary>Click to view prerequisites</summary>

- Android Studio / Android SDK
- Node.js (v20+)
- NPM or Yarn
- Shizuku App (installed on emulator/device)
- Java 17

</details>

### 2. Edge Agent (Android App)
Start by building and deploying the Android application.
```bash
# Export Android Home
export ANDROID_HOME=$HOME/Library/Android/sdk

# Build the debug APK
./gradlew assembleDebug

# Install on the active emulator/device
adb install shizuku-spike-sandbox/app/build/outputs/apk/debug/app-debug.apk
```

### 3. Cloud Orchestrator (Node.js)
```bash
cd cloud-orchestrator

# Install dependencies
npm install

# Setup Prisma Database
npx prisma db push
npx prisma generate

# Start the dev server
npm run dev
```

> [!TIP]
> To trigger an autonomous run, execute `node cloud-orchestrator/test_autonomous.js` in a separate terminal.

## ⚙️ Configuration Management

The Cloud Orchestrator requires an `.env` file in the `cloud-orchestrator/` directory.

<details>
<summary><strong>View <code>.env</code> template</strong></summary>

```env
PORT=3000
# SQLite database for storing telemetry and nodes
DATABASE_URL="file:./dev.db"

# Gemini AI Key for Vision parsing
GEMINI_API_KEY="AIzaSyYourGeminiKeyHere..."

# Cryptographic Keys for Payload Signing
PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgk...\n-----END PRIVATE KEY-----"
PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\nMIIBIjANBgk...\n-----END PUBLIC KEY-----"
```
</details>

## 🧪 Testing & CI/CD

> [!CAUTION]
> All core business logic (`:core:domain`, `:core:uiautomator`, `:core:security`) enforces a strict **95% Jacoco Code Coverage** threshold. Merges will fail if coverage drops.

**Run the JVM test suite and Jacoco verification:**
```bash
./gradlew test jacocoTestCoverageVerification
```

_Note: CI/CD Pipeline (GitHub Actions) configuration is coming soon!_

## 🚑 Troubleshooting FAQ

| Error / Issue | Solution |
| :--- | :--- |
| **Shizuku permission denied** | Ensure you have opened the Shizuku app and started the service via ADB (`adb shell sh /data/local/tmp/shizuku/starter`). |
| **Invalid Cryptographic Signature** | Ensure the `PUBLIC_KEY` embedded in the Android app matches the `PRIVATE_KEY` used by the Node.js orchestrator. |
| **Missing XML Dump** | Check that `uiautomator` is not blocked by another process. Restarting the emulator usually fixes this. |
