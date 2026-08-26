package com.tokiyo.core.shizuku

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.models.ShellResult
import java.io.BufferedReader
import java.io.InputStreamReader

class LocalRootExecutor : ActionExecutor {
    override suspend fun executeCommand(command: String): ShellResult {
        return try {
            val process = Runtime.getRuntime().exec(arrayOf("su", "0", "sh", "-c", command))
            
            val stdoutBuilder = java.lang.StringBuilder()
            val stderrBuilder = java.lang.StringBuilder()

            val outThread = Thread {
                process.inputStream.bufferedReader().use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        stdoutBuilder.append(line).append("\n")
                    }
                }
            }

            val errThread = Thread {
                process.errorStream.bufferedReader().use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        stderrBuilder.append(line).append("\n")
                    }
                }
            }

            outThread.start()
            errThread.start()

            val exitCode = process.waitFor()
            outThread.join()
            errThread.join()

            ShellResult(exitCode, stdoutBuilder.toString().trim(), stderrBuilder.toString().trim())
        } catch (e: Exception) {
            ShellResult(-1, "", e.message ?: "Unknown error executing command via su")
        }
    }
}
