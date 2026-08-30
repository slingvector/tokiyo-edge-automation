package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.IFlightRecorder
import com.tokiyo.core.domain.models.SnapshotData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Base64

class FlightRecorderImpl(
    private val executor: ActionExecutor
) : IFlightRecorder {

    override suspend fun captureSnapshot(): SnapshotData = withContext(Dispatchers.IO) {
        val uiDumpBase64 = try {
            val uiDumpResult = executor.executeCommand("uiautomator dump /data/local/tmp/dump.xml; cat /data/local/tmp/dump.xml")
            val rawStdout = uiDumpResult.stdout
            
            val xmlStartIndex = rawStdout.indexOf("<?xml")
            val xmlContent = if (xmlStartIndex != -1) rawStdout.substring(xmlStartIndex) else ""
            
            if (xmlContent.isNotBlank()) {
                Base64.getEncoder().encodeToString(xmlContent.toByteArray())
            } else {
                println("FlightRecorder: rawXml is blank. Stdout was: $rawStdout")
                null
            }
        } catch (e: Exception) {
            println("FlightRecorder: Exception: ${e.message}")
            null
        }

        val screenshotBase64 = try {
            // Compress and base64 encode the screenshot on-device
            val cmd = "screencap -p /data/local/tmp/screen.png && cat /data/local/tmp/screen.png | gzip > /data/local/tmp/screen.png.gz && base64 /data/local/tmp/screen.png.gz"
            val result = executor.executeCommand(cmd)
            if (result.exitCode == 0) {
                result.stdout.replace("\n", "")
            } else {
                null
            }
        } catch (e: Exception) {
            null
        }

        SnapshotData(uiDumpBase64, screenshotBase64)
    }
}
