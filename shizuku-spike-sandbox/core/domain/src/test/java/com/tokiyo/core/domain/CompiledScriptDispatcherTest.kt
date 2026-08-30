package com.tokiyo.core.domain

import com.tokiyo.core.domain.interfaces.SignatureVerifier
import com.tokiyo.core.domain.interfaces.TelemetryClient
import com.tokiyo.core.domain.models.JobPayload
import com.tokiyo.core.domain.models.ShellResult
import com.tokiyo.core.domain.interfaces.ICompiledScriptExecutor
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class CompiledScriptDispatcherTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)

    private lateinit var verifier: SignatureVerifier
    private lateinit var telemetry: TelemetryClient
    private lateinit var executor: ICompiledScriptExecutor
    private lateinit var dispatcher: CompiledScriptDispatcher

    @Before
    fun setup() {
        verifier = mockk()
        telemetry = mockk(relaxed = true)
        executor = mockk()

        dispatcher = CompiledScriptDispatcher(
            scope = testScope,
            nodeId = "test-node",
            verifier = verifier,
            telemetry = telemetry,
            executor = executor
        )
    }

    @Test
    fun `dispatch fails on invalid signature`() = runTest {
        val payload = JobPayload(
            job_id = "job-1",
            node_id = "test-node",
            action = "execute_compiled_script",
            timestamp = 1000,
            ttl_seconds = 3600,
            signature = "invalid",
            params = emptyMap()
        )

        every { verifier.verifyPayload(any(), any()) } returns false

        dispatcher.dispatch(payload, "{}")

        coVerify {
            telemetry.sendTelemetry(
                jobId = "job-1",
                nodeId = "test-node",
                status = "FAILED",
                exitCode = -1,
                stdout = "",
                stderr = "Invalid Cryptographic Signature for Compiled Script",
                uiDump = null,
                screenshot = null
            )
        }
    }

    @Test
    fun `dispatch fails on empty script`() = runTest {
        val payload = JobPayload(
            job_id = "job-2",
            node_id = "test-node",
            action = "execute_compiled_script",
            timestamp = 1000,
            ttl_seconds = 3600,
            signature = "valid",
            params = mapOf("script" to JsonPrimitive(""))
        )

        every { verifier.verifyPayload(any(), any()) } returns true

        dispatcher.dispatch(payload, "{}")

        coVerify {
            telemetry.sendTelemetry(
                jobId = "job-2",
                nodeId = "test-node",
                status = "FAILED",
                exitCode = -1,
                stdout = "",
                stderr = "Compiled script payload was empty.",
                uiDump = null,
                screenshot = null
            )
        }
    }

    @Test
    fun `dispatch executes script and reports success`() = runTest {
        val payload = JobPayload(
            job_id = "job-3",
            node_id = "test-node",
            action = "execute_compiled_script",
            timestamp = 1000,
            ttl_seconds = 3600,
            signature = "valid",
            params = mapOf("script" to JsonPrimitive("echo test"))
        )

        every { verifier.verifyPayload(any(), any()) } returns true
        coEvery { executor.executeScript("echo test") } returns ShellResult(0, "test output", "")

        dispatcher.dispatch(payload, "{}")

        // Verify IN_PROGRESS telemetry
        coVerify {
            telemetry.sendTelemetry(
                jobId = "job-3",
                nodeId = "test-node",
                status = "IN_PROGRESS",
                exitCode = 0,
                stdout = "Compiled script execution started on device.",
                stderr = "",
                uiDump = null,
                screenshot = null
            )
        }

        // Verify SUCCESS telemetry
        coVerify {
            telemetry.sendTelemetry(
                jobId = "job-3",
                nodeId = "test-node",
                status = "SUCCESS",
                exitCode = 0,
                stdout = "test output",
                stderr = "",
                uiDump = null,
                screenshot = null
            )
        }
    }
}
