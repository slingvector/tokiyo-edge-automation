package com.tokiyo.core.security

import com.google.crypto.tink.subtle.Ed25519Sign
import com.tokiyo.core.domain.models.JobPayload
import kotlinx.serialization.json.JsonObject
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test
import java.security.SecureRandom

class SecurityEngineTest {

    private lateinit var securityEngine: SecurityEngine
    private lateinit var privateKey: ByteArray
    private lateinit var publicKeyHex: String
    private lateinit var signer: Ed25519Sign

    @Before
    fun setUp() {
        // Generate a random Ed25519 key pair using Tink
        val keyPair = Ed25519Sign.KeyPair.newKeyPair()
        privateKey = keyPair.privateKey
        val publicKey = keyPair.publicKey
        
        publicKeyHex = byteArrayToHex(publicKey)
        securityEngine = SecurityEngine(publicKeyHex)
        signer = Ed25519Sign(privateKey)
    }

    private fun byteArrayToHex(bytes: ByteArray): String {
        return bytes.joinToString("") { "%02x".format(it) }
    }

    private fun createValidPayload(): JobPayload {
        val timestamp = System.currentTimeMillis() / 1000
        val payloadWithoutSig = JobPayload(
            job_id = "test-job-123",
            node_id = "node-1",
            timestamp = timestamp,
            ttl_seconds = 60,
            action = "TEST_ACTION",
            params = JsonObject(emptyMap()),
            signature = ""
        )
        
        val canonicalPayload = "${payloadWithoutSig.job_id}|${payloadWithoutSig.node_id}|${payloadWithoutSig.timestamp}|${payloadWithoutSig.action}"
        val signatureBytes = signer.sign(canonicalPayload.toByteArray(Charsets.UTF_8))
        
        return payloadWithoutSig.copy(signature = byteArrayToHex(signatureBytes))
    }

    @Test
    fun testValidSignature() {
        val payload = createValidPayload()
        assertTrue(securityEngine.verifyPayload(payload, ""))
    }

    @Test
    fun testTamperedActionFails() {
        val payload = createValidPayload().copy(action = "MALICIOUS_ACTION")
        assertFalse(securityEngine.verifyPayload(payload, ""))
    }

    @Test
    fun testReplayAttackExpiredTTLFails() {
        val expiredTimestamp = (System.currentTimeMillis() / 1000) - 120 // 2 minutes ago
        
        val payloadWithoutSig = JobPayload(
            job_id = "test-job-123",
            node_id = "node-1",
            timestamp = expiredTimestamp,
            ttl_seconds = 60,
            action = "TEST_ACTION",
            params = JsonObject(emptyMap()),
            signature = ""
        )
        
        val canonicalPayload = "${payloadWithoutSig.job_id}|${payloadWithoutSig.node_id}|${payloadWithoutSig.timestamp}|${payloadWithoutSig.action}"
        val signatureBytes = signer.sign(canonicalPayload.toByteArray(Charsets.UTF_8))
        
        val payload = payloadWithoutSig.copy(signature = byteArrayToHex(signatureBytes))
        
        assertFalse(securityEngine.verifyPayload(payload, ""))
    }
}
