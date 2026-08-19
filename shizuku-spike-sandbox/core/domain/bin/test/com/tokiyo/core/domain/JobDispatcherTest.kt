package com.tokiyo.core.domain

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.IAppLifecycleController
import com.tokiyo.core.domain.interfaces.IClipboardInjector
import com.tokiyo.core.domain.interfaces.ITouchDispatcher
import com.tokiyo.core.domain.interfaces.SignatureVerifier
import com.tokiyo.core.domain.interfaces.TelemetryClient
import com.tokiyo.core.domain.interfaces.UiAutomatorClient
import com.tokiyo.core.domain.models.JobPayload
import com.tokiyo.core.domain.models.ShellResult
import com.tokiyo.core.domain.models.UiNode
import com.tokiyo.core.domain.models.UiSelector
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.TestScope
import kotlinx.coroutines.test.UnconfinedTestDispatcher
import kotlinx.coroutines.test.runTest
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class JobDispatcherTest {

    private val testDispatcher = UnconfinedTestDispatcher()
    private val testScope = TestScope(testDispatcher)
    
    private lateinit var verifier: SignatureVerifier
    private lateinit var executor: ActionExecutor
    private lateinit var uiAutomator: UiAutomatorClient
    private lateinit var telemetry: TelemetryClient
    private lateinit var touchDispatcher: ITouchDispatcher
    private lateinit var clipboardInjector: IClipboardInjector
    private lateinit var appLifecycleController: IAppLifecycleController
    private lateinit var flightRecorder: com.tokiyo.core.domain.interfaces.IFlightRecorder
    
    private lateinit var dispatcher: JobDispatcher
    
    private val nodeId = "test_node_id"
    private val rawJson = "{}"
    
    @Before
    fun setup() {
        verifier = mockk()
        executor = mockk()
        uiAutomator = mockk()
        telemetry = mockk(relaxed = true)
        touchDispatcher = mockk()
        clipboardInjector = mockk()
        appLifecycleController = mockk()
        flightRecorder = mockk(relaxed = true)
        
        dispatcher = JobDispatcher(
            scope = testScope,
            nodeId = nodeId,
            verifier = verifier,
            executor = executor,
            uiAutomator = uiAutomator,
            telemetry = telemetry,
            touchDispatcher = touchDispatcher,
            clipboardInjector = clipboardInjector,
            appLifecycleController = appLifecycleController,
            flightRecorder = flightRecorder
        )
    }

    @Test
    fun `dispatch fails when signature is invalid`() = testScope.runTest {
        val payload = JobPayload(
            job_id = "job-1",
            node_id = "node-1",
            timestamp = 1000L,
            ttl_seconds = 60,
            action = "execute_shell",
            params = kotlinx.serialization.json.JsonObject(emptyMap()),
            signature = ""
        )
        
        every { verifier.verifyPayload(payload, rawJson) } returns false
        
        dispatcher.dispatch(payload, rawJson)
        
        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job-1",
                nodeId = nodeId,
                status = "FAILED",
                exitCode = -1,
                stdout = "",
                stderr = "Invalid Cryptographic Signature"
            ) 
        }
    }

    @Test
    fun `dispatch click_element successful`() = testScope.runTest {
        val params = mapOf("text" to kotlinx.serialization.json.JsonPrimitive("Settings"))
        val payload = JobPayload(
            job_id = "job-2",
            node_id = "node-1",
            timestamp = 1000L,
            ttl_seconds = 60,
            action = "click_element",
            params = kotlinx.serialization.json.JsonObject(params),
            signature = ""
        )
        
        val node = UiNode(1, "Settings", "id", "class", "pkg", "desc", false, false, true, true, true, false, false, false, false, false, "[0,0][100,100]")
        
        every { verifier.verifyPayload(payload, rawJson) } returns true
        coEvery { uiAutomator.findNode(any()) } returns node
        coEvery { touchDispatcher.tap("[0,0][100,100]") } returns true
        
        dispatcher.dispatch(payload, rawJson)
        
        coVerify { 
            uiAutomator.findNode(match { it.text == "Settings" }) 
            touchDispatcher.tap("[0,0][100,100]")
        }
        
        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job-2",
                nodeId = nodeId,
                status = "SUCCESS",
                exitCode = 0,
                stdout = "Clicked element successfully",
                stderr = ""
            ) 
        }
    }

    @Test
    fun `dispatch paste_text successful`() = testScope.runTest {
        val params = mapOf("text" to kotlinx.serialization.json.JsonPrimitive("Hello"))
        val payload = JobPayload(
            job_id = "job-paste",
            node_id = "node-1",
            timestamp = 1000L,
            ttl_seconds = 60,
            action = "paste_text",
            params = kotlinx.serialization.json.JsonObject(params),
            signature = ""
        )
        
        every { verifier.verifyPayload(payload, rawJson) } returns true
        coEvery { clipboardInjector.pasteText("Hello") } returns true
        
        dispatcher.dispatch(payload, rawJson)
        
        coVerify { clipboardInjector.pasteText("Hello") }
    }

    @Test
    fun `dispatch deep_link successful`() = testScope.runTest {
        val params = mapOf(
            "url" to kotlinx.serialization.json.JsonPrimitive("myapp://link"),
            "package" to kotlinx.serialization.json.JsonPrimitive("com.example.app")
        )
        val payload = JobPayload(
            job_id = "job-link",
            node_id = "node-1",
            timestamp = 1000L,
            ttl_seconds = 60,
            action = "deep_link",
            params = kotlinx.serialization.json.JsonObject(params),
            signature = ""
        )
        
        every { verifier.verifyPayload(payload, rawJson) } returns true
        coEvery { appLifecycleController.launchDeepLink("myapp://link", "com.example.app") } returns true
        
        dispatcher.dispatch(payload, rawJson)
        
        coVerify { appLifecycleController.launchDeepLink("myapp://link", "com.example.app") }
    }

    @Test
    fun `dispatch dump_ui successful`() = testScope.runTest {
        val payload = JobPayload(
            job_id = "job-dump",
            node_id = "node-1",
            timestamp = 1000L,
            ttl_seconds = 60,
            action = "dump_ui",
            params = kotlinx.serialization.json.JsonObject(emptyMap()),
            signature = ""
        )
        
        val snapshot = com.tokiyo.core.domain.models.SnapshotData("b64xml", "b64png")
        every { verifier.verifyPayload(payload, rawJson) } returns true
        coEvery { flightRecorder.captureSnapshot() } returns snapshot
        
        dispatcher.dispatch(payload, rawJson)
        
        coVerify { flightRecorder.captureSnapshot() }
        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job-dump",
                nodeId = nodeId,
                status = "SUCCESS",
                exitCode = 0,
                stdout = "UI dumped successfully",
                stderr = "",
                uiDump = "b64xml",
                screenshot = "b64png"
            ) 
        }
    }

    @Test
    fun `dispatch swipe successful`() = testScope.runTest {
        val params = mapOf(
            "start_x" to kotlinx.serialization.json.JsonPrimitive("100"),
            "start_y" to kotlinx.serialization.json.JsonPrimitive("200"),
            "end_x" to kotlinx.serialization.json.JsonPrimitive("300"),
            "end_y" to kotlinx.serialization.json.JsonPrimitive("400")
        )
        val payload = JobPayload(
            job_id = "job-swipe", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "swipe", params = kotlinx.serialization.json.JsonObject(params), signature = ""
        )
        
        every { verifier.verifyPayload(payload, rawJson) } returns true
        coEvery { touchDispatcher.swipe(100, 200, 300, 400) } returns true
        
        dispatcher.dispatch(payload, rawJson)
        coVerify { touchDispatcher.swipe(100, 200, 300, 400) }
    }

    @Test
    fun `dispatch force_stop successful`() = testScope.runTest {
        val params = mapOf("package" to kotlinx.serialization.json.JsonPrimitive("com.example.app"))
        val payload = JobPayload(
            job_id = "job-stop", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "force_stop", params = kotlinx.serialization.json.JsonObject(params), signature = ""
        )
        
        every { verifier.verifyPayload(payload, rawJson) } returns true
        coEvery { appLifecycleController.forceStop("com.example.app") } returns true
        
        dispatcher.dispatch(payload, rawJson)
        coVerify { appLifecycleController.forceStop("com.example.app") }
    }

    @Test
    fun `dispatch unknown action defaults to shell command`() = testScope.runTest {
        val params = mapOf("command" to kotlinx.serialization.json.JsonPrimitive("echo hello"))
        val payload = JobPayload(
            job_id = "job-shell", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "unknown_action", params = kotlinx.serialization.json.JsonObject(params), signature = ""
        )
        
        every { verifier.verifyPayload(payload, rawJson) } returns true
        coEvery { executor.executeCommand("echo hello") } returns ShellResult(0, "hello", "")
        
        dispatcher.dispatch(payload, rawJson)
        coVerify { executor.executeCommand("echo hello") }
    }

    @Test
    fun `dispatch handles unexpected exceptions gracefully`() = testScope.runTest {
        val payload = JobPayload(
            job_id = "job-err", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "deep_link", params = kotlinx.serialization.json.JsonObject(emptyMap()), signature = ""
        )
        
        every { verifier.verifyPayload(payload, rawJson) } returns true
        coEvery { appLifecycleController.launchDeepLink(any(), any()) } throws RuntimeException("Oops!")
        coEvery { flightRecorder.captureSnapshot() } returns com.tokiyo.core.domain.models.SnapshotData("xml", "png")
        
        dispatcher.dispatch(payload, rawJson)
        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job-err",
                nodeId = nodeId,
                status = "FAILED",
                exitCode = -2,
                stdout = "",
                stderr = "Internal Execution Error: Oops!",
                uiDump = "xml",
                screenshot = "png"
            ) 
        }
    }

    @Test
    fun `dispatch click_element fails when element not found`() = testScope.runTest {
        val payload = JobPayload(
            job_id = "job_4_fail", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "click_element", params = kotlinx.serialization.json.JsonObject(mapOf("text" to kotlinx.serialization.json.JsonPrimitive("Missing"))), signature = ""
        )
        every { verifier.verifyPayload(payload, "raw") } returns true
        coEvery { uiAutomator.findNode(UiSelector(text = "Missing")) } returns null
        coEvery { flightRecorder.captureSnapshot() } returns com.tokiyo.core.domain.models.SnapshotData("xml_missing", "png_missing")

        dispatcher.dispatch(payload, "raw")

        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job_4_fail",
                nodeId = nodeId,
                status = "FAILED",
                exitCode = 1,
                stdout = "Element not found or tap failed",
                stderr = "",
                uiDump = "xml_missing",
                screenshot = "png_missing"
            )
        }
    }

    @Test
    fun `dispatch swipe fails`() = testScope.runTest {
        val params = mapOf(
            "start_x" to kotlinx.serialization.json.JsonPrimitive("100"), "start_y" to kotlinx.serialization.json.JsonPrimitive("200"),
            "end_x" to kotlinx.serialization.json.JsonPrimitive("300"), "end_y" to kotlinx.serialization.json.JsonPrimitive("400")
        )
        val payload = JobPayload(
            job_id = "job-swipe-fail", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "swipe", params = kotlinx.serialization.json.JsonObject(params), signature = ""
        )
        every { verifier.verifyPayload(payload, "raw") } returns true
        coEvery { touchDispatcher.swipe(100, 200, 300, 400) } returns false
        coEvery { flightRecorder.captureSnapshot() } returns com.tokiyo.core.domain.models.SnapshotData("xml", "png")
        
        dispatcher.dispatch(payload, "raw")
        
        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job-swipe-fail", nodeId = nodeId, status = "FAILED", exitCode = 1,
                stdout = "Swipe failed", stderr = ""
            )
        }
    }

    @Test
    fun `dispatch paste_text fails`() = testScope.runTest {
        val params = mapOf("text" to kotlinx.serialization.json.JsonPrimitive("Hello"))
        val payload = JobPayload(
            job_id = "job-paste-fail", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "paste_text", params = kotlinx.serialization.json.JsonObject(params), signature = ""
        )
        every { verifier.verifyPayload(payload, "raw") } returns true
        coEvery { clipboardInjector.pasteText("Hello") } returns false
        coEvery { flightRecorder.captureSnapshot() } returns com.tokiyo.core.domain.models.SnapshotData("xml", "png")
        
        dispatcher.dispatch(payload, "raw")
        
        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job-paste-fail", nodeId = nodeId, status = "FAILED", exitCode = 1,
                stdout = "Paste failed", stderr = ""
            )
        }
    }

    @Test
    fun `dispatch deep_link fails`() = testScope.runTest {
        val params = mapOf("url" to kotlinx.serialization.json.JsonPrimitive("myapp://link"), "package" to kotlinx.serialization.json.JsonPrimitive("com.example.app"))
        val payload = JobPayload(
            job_id = "job-link-fail", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "deep_link", params = kotlinx.serialization.json.JsonObject(params), signature = ""
        )
        every { verifier.verifyPayload(payload, "raw") } returns true
        coEvery { appLifecycleController.launchDeepLink("myapp://link", "com.example.app") } returns false
        coEvery { flightRecorder.captureSnapshot() } returns com.tokiyo.core.domain.models.SnapshotData("xml", "png")
        
        dispatcher.dispatch(payload, "raw")
        
        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job-link-fail", nodeId = nodeId, status = "FAILED", exitCode = 1,
                stdout = "Deep link failed", stderr = ""
            )
        }
    }

    @Test
    fun `dispatch force_stop fails`() = testScope.runTest {
        val params = mapOf("package" to kotlinx.serialization.json.JsonPrimitive("com.example.app"))
        val payload = JobPayload(
            job_id = "job-stop-fail", node_id = "node-1", timestamp = 1000L, ttl_seconds = 60,
            action = "force_stop", params = kotlinx.serialization.json.JsonObject(params), signature = ""
        )
        every { verifier.verifyPayload(payload, "raw") } returns true
        coEvery { appLifecycleController.forceStop("com.example.app") } returns false
        coEvery { flightRecorder.captureSnapshot() } returns com.tokiyo.core.domain.models.SnapshotData("xml", "png")
        
        dispatcher.dispatch(payload, "raw")
        
        coVerify { 
            telemetry.sendTelemetry(
                jobId = "job-stop-fail", nodeId = nodeId, status = "FAILED", exitCode = 1,
                stdout = "Force stop failed", stderr = ""
            )
        }
    }
}
