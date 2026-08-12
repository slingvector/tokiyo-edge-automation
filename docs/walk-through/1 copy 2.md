# Ticket 1.2: Headless HTTP Listener & Ed25519 Cryptography

## Mission Accomplished
We have successfully built a fully functioning Zero-Trust headless HTTP server embedded directly into the Android `shizuku-spike-sandbox` app. This achieves our goal of bypassing Firebase Cloud Messaging (FCM) during the fail-fast development phase. 

### What was implemented:
1. **Google Tink Integration:** We added the industry-standard Tink Cryptography library to handle Ed25519 public key verification to support older devices (down to Android 9/API 28).
2. **Security Engine:** We built the `SecurityEngine` class that canonicalizes inbound JSON payloads, verifies the cryptographic signature against a known public key, and enforces a Time-Drift Anti-Replay check using a Time-To-Live (TTL) integer.
3. **Ktor Background Server:** We added a headless `AgentHttpService` Android foreground service. It runs a Ktor server on port 8080 completely hidden in the background without needing a user interface. 
4. **Automated Testing:** We wrote `SecurityEngineTest.kt` with a 100% pass rate. It successfully asserts that valid signatures are approved, tampered data is rejected, and replay-attacks with an expired TTL timestamp are dropped!

### Validation Results
To simulate a real execution, we generated an Ed25519 key pair, signed a payload, port-forwarded `adb`, and fired a local `curl` request directly into the emulator. 

The Android listener processed the JSON, validated the Ed25519 signature, checked the timestamp TTL, and returned a successful 200 OK:
```json
{
    "status": "SUCCESS",
    "job_id": "test-job-1786457867"
}
```

The foundations are now complete. The Edge node has Root privileges (via Shizuku) and is actively listening for verified payloads!
