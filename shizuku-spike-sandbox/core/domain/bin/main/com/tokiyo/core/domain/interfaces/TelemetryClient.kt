package com.tokiyo.core.domain.interfaces

interface TelemetryClient {
    suspend fun sendTelemetry(
        jobId: String,
        nodeId: String,
        status: String,
        exitCode: Int,
        stdout: String,
        stderr: String,
        uiDump: String? = null,
        screenshot: String? = null
    )
}
