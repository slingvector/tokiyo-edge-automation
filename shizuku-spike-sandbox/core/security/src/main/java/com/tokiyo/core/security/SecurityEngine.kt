package com.tokiyo.core.security

import com.google.crypto.tink.subtle.Ed25519Verify
import com.tokiyo.core.domain.interfaces.SignatureVerifier
import com.tokiyo.core.domain.models.JobPayload
import java.util.logging.Logger

class SecurityEngine(
    private val publicKeyHex: String
) : SignatureVerifier {
    private val verifier = Ed25519Verify(hexStringToByteArray(publicKeyHex))
    private val logger = Logger.getLogger("SecurityEngine")
    
    override fun verifyPayload(payload: JobPayload, rawJsonString: String): Boolean {
        // Anti-Replay TTL Check
        val currentTime = System.currentTimeMillis() / 1000
        val age = currentTime - payload.timestamp
        if (age < -60 || age > payload.ttl_seconds) {
            logger.severe("TTL check failed! Age: $age, TTL: ${payload.ttl_seconds}, Current: $currentTime, Payload: ${payload.timestamp}")
            return false
        }
        
        // Verifying Ed25519 signature
        return try {
            val signatureBytes = hexStringToByteArray(payload.signature)
            // For this spike, we'll verify against a deterministic pipe-separated string
            val canonicalPayload = "${payload.job_id}|${payload.node_id}|${payload.timestamp}|${payload.action}"
            
            verifier.verify(signatureBytes, canonicalPayload.toByteArray(Charsets.UTF_8))
            true
        } catch (e: Exception) {
            logger.severe("Signature verification failed! Error: ${e.message}")
            false
        }
    }
    
    private fun hexStringToByteArray(s: String): ByteArray {
        val len = s.length
        require(len % 2 == 0) { "Hex string must have an even length" }
        val data = ByteArray(len / 2)
        var i = 0
        while (i < len) {
            data[i / 2] = ((Character.digit(s[i], 16) shl 4) + Character.digit(s[i + 1], 16)).toByte()
            i += 2
        }
        return data
    }
}
