package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.IFlightRecorder
import com.tokiyo.core.domain.models.SnapshotData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class FlightRecorderImpl(
    private val executor: ActionExecutor
) : IFlightRecorder {

    override suspend fun captureSnapshot(): SnapshotData = withContext(Dispatchers.IO) {
        val uiDumpBase64 = try {
            val cmd = "uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml | gzip > /data/local/tmp/dump.xml.gz && base64 /data/local/tmp/dump.xml.gz"
            val result = executor.executeCommand(cmd)
            if (result.exitCode == 0) {
                // The base64 output contains newlines; we can keep them or remove them.
                result.stdout.replace("\n", "")
            } else {
                null
            }
        } catch (e: Exception) {
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
