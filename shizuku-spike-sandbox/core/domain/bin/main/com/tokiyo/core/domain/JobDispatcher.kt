package com.tokiyo.core.domain

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.IAppLifecycleController
import com.tokiyo.core.domain.interfaces.IClipboardInjector
import com.tokiyo.core.domain.interfaces.ITouchDispatcher
import com.tokiyo.core.domain.interfaces.SignatureVerifier
import com.tokiyo.core.domain.interfaces.TelemetryClient
import com.tokiyo.core.domain.interfaces.UiAutomatorClient
import com.tokiyo.core.domain.interfaces.IFlightRecorder
import com.tokiyo.core.domain.interfaces.IMediaRelay
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
    private val flightRecorder: IFlightRecorder,
    private val mediaRelay: IMediaRelay
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
                            val regex = """\[(\d+),(\d+)\]\[(\d+),(\d+)\]""".toRegex()
                            val matchResult = regex.find(node.boundsString)
                            if (matchResult != null) {
                                val (x1Str, y1Str, x2Str, y2Str) = matchResult.destructured
                                val centerX = (x1Str.toInt() + x2Str.toInt()) / 2
                                val centerY = (y1Str.toInt() + y2Str.toInt()) / 2
                                val result = executor.executeCommand("input tap $centerX $centerY")
                                result.exitCode == 0
                            } else {
                                false
                            }
                        } else {
                            false
                        }
                        
                        val stderr = if (success) "" else "Failed to click element: bounds regex may have failed or node not found."
                        sendTelemetryWithSnapshotOnFailure(
                            jobId = payload.job_id,
                            success = success,
                            stdout = if (success) "Clicked element successfully" else "Element not found or tap failed",
                            stderr = stderr
                        )
                    }
                    "organic_tap" -> {
                        val x = payload.params["x"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val y = payload.params["y"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        
                        // Jitter Engine: Randomized offset and delay
                        val jitterX = x + kotlin.random.Random.nextInt(-12, 13)
                        val jitterY = y + kotlin.random.Random.nextInt(-12, 13)
                        val delayMs = kotlin.random.Random.nextLong(50, 250)
                        kotlinx.coroutines.delay(delayMs)
                        
                        val result = executor.executeCommand("input tap $jitterX $jitterY")
                        val success = result.exitCode == 0
                        sendTelemetryWithSnapshotOnFailure(
                            jobId = payload.job_id,
                            success = success,
                            stdout = if (success) "Organic tap successfully at $jitterX, $jitterY" else "Organic tap failed",
                            stderr = result.stderr
                        )
                    }
                    "organic_swipe" -> {
                        val startX = payload.params["start_x"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val startY = payload.params["start_y"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val endX = payload.params["end_x"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val endY = payload.params["end_y"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val duration = payload.params["duration_ms"]?.jsonPrimitive?.content?.toIntOrNull() ?: 400
                        val success = touchDispatcher.swipe(startX, startY, endX, endY)
                        sendTelemetryWithSnapshotOnFailure(
                            jobId = payload.job_id,
                            success = success,
                            stdout = if (success) "Organic swiped successfully" else "Organic swipe failed",
                            stderr = if (success) "" else "TouchDispatcher failed to swipe"
                        )
                    }
                    "organic_type" -> {
                        val text = payload.params["text"]?.jsonPrimitive?.content ?: ""
                        
                        // Jitter Engine: Chunked typing with random delays
                        var currentIndex = 0
                        var finalSuccess = true
                        var finalStderr = ""
                        
                        while (currentIndex < text.length) {
                            val chunkSize = kotlin.random.Random.nextInt(2, 5)
                            val end = (currentIndex + chunkSize).coerceAtMost(text.length)
                            val chunk = text.substring(currentIndex, end)
                            
                            val escapedChunk = chunk.replace("'", "\\'")
                            val result = executor.executeCommand("input text '$escapedChunk'")
                            if (result.exitCode != 0) {
                                finalSuccess = false
                                finalStderr = result.stderr
                                break
                            }
                            
                            currentIndex = end
                            if (currentIndex < text.length) {
                                kotlinx.coroutines.delay(kotlin.random.Random.nextLong(100, 300))
                            }
                        }
                        
                        sendTelemetryWithSnapshotOnFailure(
                            jobId = payload.job_id,
                            success = finalSuccess,
                            stdout = if (finalSuccess) "Organic typed successfully" else "Organic type failed",
                            stderr = finalStderr
                        )
                    }
                    "swipe" -> {
                        val startX = payload.params["start_x"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val startY = payload.params["start_y"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val endX = payload.params["end_x"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val endY = payload.params["end_y"]?.jsonPrimitive?.content?.toIntOrNull() ?: 0
                        val success = touchDispatcher.swipe(startX, startY, endX, endY)
                        sendTelemetryWithSnapshotOnFailure(
                            jobId = payload.job_id,
                            success = success,
                            stdout = if (success) "Swiped successfully" else "Swipe failed",
                            stderr = if (success) "" else "TouchDispatcher failed to swipe"
                        )
                    }
                    "paste_text" -> {
                        val text = payload.params["text"]?.jsonPrimitive?.content ?: ""
                        val success = clipboardInjector.pasteText(text)
                        sendTelemetryWithSnapshotOnFailure(
                            jobId = payload.job_id,
                            success = success,
                            stdout = if (success) "Pasted text successfully" else "Paste failed",
                            stderr = if (success) "" else "ClipboardInjector failed to paste"
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
                        val result = executor.executeCommand("am force-stop $packageName")
                        val success = result.exitCode == 0
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = if (success) "SUCCESS" else "FAILED",
                            exitCode = if (success) 0 else 1,
                            stdout = if (success) "Force stopped $packageName" else "Failed to force stop $packageName",
                            stderr = result.stderr
                        )
                    }
                    "clear_cache" -> {
                        val packageName = payload.params["package"]?.jsonPrimitive?.content ?: ""
                        val result = executor.executeCommand("pm clear $packageName")
                        val success = result.exitCode == 0
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = if (success) "SUCCESS" else "FAILED",
                            exitCode = if (success) 0 else 1,
                            stdout = if (success) "Cleared cache for $packageName" else "Failed to clear cache for $packageName",
                            stderr = result.stderr
                        )
                    }
                    "download_media" -> {
                        val url = payload.params["url"]?.jsonPrimitive?.content ?: ""
                        val fileName = payload.params["file_name"]?.jsonPrimitive?.content ?: "downloaded_media.jpg"
                        val success = mediaRelay.downloadAndIndexMedia(url, fileName)
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = if (success) "SUCCESS" else "FAILED",
                            exitCode = if (success) 0 else 1,
                            stdout = if (success) "Downloaded and indexed media" else "Media download failed",
                            stderr = ""
                        )
                    }
                    "wait_for_idle" -> {
                        val timeout = payload.params["timeout_ms"]?.jsonPrimitive?.content?.toLongOrNull() ?: 2000L
                        kotlinx.coroutines.delay(timeout)
                        telemetry.sendTelemetry(
                            jobId = payload.job_id,
                            nodeId = nodeId,
                            status = "SUCCESS",
                            exitCode = 0,
                            stdout = "Scroll is idle",
                            stderr = ""
                        )
                    }
                    "dump_ui" -> {
                        // Stabilize the viewport by ensuring inertia scrolling has stopped before dumping
                        kotlinx.coroutines.delay(2000L)
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
