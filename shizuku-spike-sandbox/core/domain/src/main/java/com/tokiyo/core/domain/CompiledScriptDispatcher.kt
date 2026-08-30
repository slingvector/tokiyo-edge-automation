package com.tokiyo.core.domain

import com.tokiyo.core.domain.interfaces.SignatureVerifier
import com.tokiyo.core.domain.interfaces.TelemetryClient
import com.tokiyo.core.domain.models.JobPayload
import com.tokiyo.core.domain.interfaces.ICompiledScriptExecutor
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.launch
import kotlinx.serialization.json.jsonPrimitive

class CompiledScriptDispatcher(
    private val scope: CoroutineScope,
    private val nodeId: String,
    private val verifier: SignatureVerifier,
    private val telemetry: TelemetryClient,
    private val executor: ICompiledScriptExecutor
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
                    stderr = "Invalid Cryptographic Signature for Compiled Script"
                )
            }
            return
        }

        scope.launch {
            try {
                val script = payload.params["script"]?.jsonPrimitive?.content ?: ""
                if (script.isEmpty()) {
                    telemetry.sendTelemetry(
                        jobId = payload.job_id,
                        nodeId = nodeId,
                        status = "FAILED",
                        exitCode = -1,
                        stdout = "",
                        stderr = "Compiled script payload was empty."
                    )
                    return@launch
                }

                // Telemetry: Script started
                telemetry.sendTelemetry(
                    jobId = payload.job_id,
                    nodeId = nodeId,
                    status = "IN_PROGRESS",
                    exitCode = 0,
                    stdout = "Compiled script execution started on device.",
                    stderr = ""
                )

                val result = executor.executeScript(script)
                val success = result.exitCode == 0

                // Telemetry: Script finished (includes duration in stdout)
                telemetry.sendTelemetry(
                    jobId = payload.job_id,
                    nodeId = nodeId,
                    status = if (success) "SUCCESS" else "FAILED",
                    exitCode = result.exitCode,
                    stdout = result.stdout,
                    stderr = result.stderr
                )

            } catch (e: Exception) {
                telemetry.sendTelemetry(
                    jobId = payload.job_id,
                    nodeId = nodeId,
                    status = "FAILED",
                    exitCode = -2,
                    stdout = "",
                    stderr = "Internal Execution Error during script run: ${e.message}"
                )
            }
        }
    }
}
