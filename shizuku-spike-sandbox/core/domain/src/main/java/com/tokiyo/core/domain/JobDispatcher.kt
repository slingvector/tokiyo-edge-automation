package com.tokiyo.core.domain

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.IAppLifecycleController
import com.tokiyo.core.domain.interfaces.IClipboardInjector
import com.tokiyo.core.domain.interfaces.ITouchDispatcher
import com.tokiyo.core.domain.interfaces.SignatureVerifier
import com.tokiyo.core.domain.interfaces.TelemetryClient
import com.tokiyo.core.domain.interfaces.UiAutomatorClient
import com.tokiyo.core.domain.interfaces.IFlightRecorder
import com.tokiyo.core.domain.models.JobPayload
import com.tokiyo.core.domain.models.UiSelector
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonPrimitive

class JobDispatcher(
    private val scope: CoroutineScope,
    private val nodeId: String,
    private val verifier: SignatureVerifier,
    private val executor: ActionExecutor,
    private val uiAutomator: UiAutomatorClient,
    private val telemetry: TelemetryClient,
    private val touchDispatcher: ITouchDispatcher,
    private val clipboardInjector: IClipboardInjector,
    private val appLifecycleController: IAppLifecycleController,
    private val flightRecorder: IFlightRecorder
) {
    fun dispatch(payload: JobPayload, rawJsonString: String) {
        if (!verifier.verifyPayload(payload, rawJsonString)) {
            scope.launch {
                telemetry.sendTelemetry(
                    jobId = payload.job_id,
                    nodeId = nodeId,
                    status = "FAILED",
                    exitCode = -1,
                    stdout = "",
                    stderr = "Invalid Cryptographic Signature"
                )
            }
            return
        }

        scope.launch {
            try {
                when (payload.action) {
                    "click_element" -> {
                        val text = payload.params["text"]?.jsonPrimitive?.content
                        val resourceId = payload.params["resource_id"]?.jsonPrimitive?.content
                        val selector = UiSelector(text = text, resourceId = resourceId)
                        
                        val node = uiAutomator.findNode(selector)
                        val success = if (node != null) {
                            touchDispatcher.tap(node.boundsString)
                        } else {
                            false
                        }
                        
                        sendTelemetryWithSnapshotOnFailure(
                            jobId = payload.job_id,
                            success = success,
                            stdout = if (success) "Clicked element successfully" else "Element not found or tap failed",
                            stderr = ""
                        )
                    }
                    "swipe" -> {
                        val startX = payload.params["start_x"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val startY = payload.params["start_y"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val endX = payload.params["end_x"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val endY = payload.params["end_y"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val success = touchDispatcher.swipe(startX, startY, endX, endY)
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = if (success) "SUCCESS" else "FAILED",
                            exitCode = if (success) 0 else 1,
                            stdout = if (success) "Swiped successfully" else "Swipe failed",
                            stderr = ""
                        )
                    }
                    "paste_text" -> {
                        val text = payload.params["text"]?.jsonPrimitive?.content ?: ""
                        val success = clipboardInjector.pasteText(text)
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = if (success) "SUCCESS" else "FAILED",
                            exitCode = if (success) 0 else 1,
                            stdout = if (success) "Pasted text successfully" else "Paste failed",
                            stderr = ""
                        )
                    }
                    "deep_link" -> {
                        val url = payload.params["url"]?.jsonPrimitive?.content ?: ""
                        val packageName = payload.params["package"]?.jsonPrimitive?.content ?: ""
                        val success = appLifecycleController.launchDeepLink(url, packageName)
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = if (success) "SUCCESS" else "FAILED",
                            exitCode = if (success) 0 else 1,
                            stdout = if (success) "Launched deep link" else "Deep link failed",
                            stderr = ""
                        )
                    }
                    "force_stop" -> {
                        val packageName = payload.params["package"]?.jsonPrimitive?.content ?: ""
                        val success = appLifecycleController.forceStop(packageName)
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = if (success) "SUCCESS" else "FAILED",
                            exitCode = if (success) 0 else 1,
                            stdout = if (success) "Force stopped app" else "Force stop failed",
                            stderr = ""
                        )
                    }
                    "dump_ui" -> {
                        val snapshot = flightRecorder.captureSnapshot()
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = "SUCCESS",
                            exitCode = 0,
                            stdout = "UI dumped successfully",
                            stderr = "",
                            uiDump = snapshot.uiDumpBase64,
                            screenshot = snapshot.screenshotBase64
                        )
                    }
                    else -> {
                        val command = payload.params["command"]?.jsonPrimitive?.content ?: "echo 'No command provided'"
                        val result = executor.executeCommand(command)
                        val status = if (result.exitCode == 0) "SUCCESS" else "FAILED"
                        
                        sendTelemetryWithSnapshotOnFailure(
                            jobId = payload.job_id,
                            success = result.exitCode == 0,
                            stdout = result.stdout,
                            stderr = result.stderr
                        )
                    }
                }
            } catch (e: Exception) {
                val snapshot = try { flightRecorder.captureSnapshot() } catch (ignored: Exception) { null }
                telemetry.sendTelemetry(
                    jobId = payload.job_id,
                    nodeId = nodeId,
                    status = "FAILED",
                    exitCode = -2,
                    stdout = "",
                    stderr = "Internal Execution Error: ${e.message}",
                    uiDump = snapshot?.uiDumpBase64,
                    screenshot = snapshot?.screenshotBase64
                )
            }
        }
    }

    private suspend fun sendTelemetryWithSnapshotOnFailure(jobId: String, success: Boolean, stdout: String, stderr: String) {
        val snapshot = if (!success) {
            flightRecorder.captureSnapshot()
        } else null
        
        telemetry.sendTelemetry(
            jobId = jobId,
            nodeId = nodeId,
            status = if (success) "SUCCESS" else "FAILED",
            exitCode = if (success) 0 else 1,
            stdout = stdout,
            stderr = stderr,
            uiDump = snapshot?.uiDumpBase64,
            screenshot = snapshot?.screenshotBase64
        )
    }
}
