package com.tokiyo.core.shizuku

import com.tokiyo.core.domain.models.ShellResult
import com.tokiyo.core.domain.interfaces.ICompiledScriptExecutor
import rikka.shizuku.Shizuku
import java.util.UUID

/**
 * Executes multi-line compiled bash scripts natively on the device via Shizuku.
 * Used for the 'Compile & Dispatch' zero-hop architecture.
 */
class CompiledScriptExecutor : ICompiledScriptExecutor {

    override suspend fun executeScript(scriptContent: String): ShellResult {
        // We write the script to /data/local/tmp/ because Shizuku (shell UID) has execute permissions there.
        val scriptName = "tokiyo_script_${UUID.randomUUID().toString().substring(0, 8)}.sh"
        val tempPath = "/data/local/tmp/$scriptName"

        return try {
            // 1. Write the script content to the temp path using a single sh -c command
            val escapedContent = scriptContent.replace("'", "'\\''") // Escape single quotes for bash
            val writeCommand = "echo '$escapedContent' > $tempPath && chmod +x $tempPath"
            
            val writeProcess = createProcess(writeCommand)
            writeProcess.waitFor()
            if (writeProcess.exitValue() != 0) {
                return ShellResult(-1, "", "Failed to write script to $tempPath")
            }

            // 2. Execute the script natively
            val startMs = System.currentTimeMillis()
            val execProcess = createProcess("sh $tempPath")
            
            val stdoutBuilder = StringBuilder()
            val stderrBuilder = StringBuilder()

            val outThread = Thread {
                execProcess.inputStream.bufferedReader().use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        stdoutBuilder.append(line).append("\n")
                    }
                }
            }

            val errThread = Thread {
                execProcess.errorStream.bufferedReader().use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        stderrBuilder.append(line).append("\n")
                    }
                }
            }

            outThread.start()
            errThread.start()

            // Timeout after 5 minutes (scripts can be long)
            var exitCode = -1
            var finished = false
            for (i in 0..3000) { // 3000 * 100ms = 300 seconds (5 min)
                try {
                    exitCode = execProcess.exitValue()
                    finished = true
                    break
                } catch (e: Exception) {
                    Thread.sleep(100)
                }
            }

            if (!finished) {
                execProcess.destroy()
                outThread.interrupt()
                errThread.interrupt()
                cleanup(tempPath)
                return ShellResult(-1, stdoutBuilder.toString(), "Execution timed out after 5 minutes.\n$stderrBuilder")
            }

            outThread.join(1000)
            errThread.join(1000)
            
            val durationMs = System.currentTimeMillis() - startMs

            // 3. Cleanup
            cleanup(tempPath)

            ShellResult(
                exitCode = exitCode,
                stdout = "Execution time: ${durationMs}ms\n" + stdoutBuilder.toString().trim(),
                stderr = stderrBuilder.toString().trim()
            )

        } catch (e: Exception) {
            cleanup(tempPath)
            ShellResult(-1, "", "Exception executing compiled script: ${e.message}")
        }
    }

    private fun cleanup(path: String) {
        try {
            val cleanupProcess = createProcess("rm -f $path")
            cleanupProcess.waitFor()
        } catch (e: Exception) {
            // Ignore cleanup failures
        }
    }

    private fun createProcess(command: String): Process {
        return if (Shizuku.pingBinder()) {
            val method = Shizuku::class.java.getDeclaredMethod("newProcess", Array<String>::class.java, Array<String>::class.java, String::class.java)
            method.isAccessible = true
            method.invoke(null, arrayOf("sh", "-c", command), null, null) as Process
        } else {
            val dir = java.io.File("/data/data/com.tokiyo.shizukuspike/files")
            dir.mkdirs()
            val cmdFile = java.io.File(dir, "command.txt")
            val doneFile = java.io.File(dir, "done.txt")
            val outFile = java.io.File(dir, "output.txt")
            
            doneFile.delete()
            cmdFile.writeText(command)
            
            var success = false
            for (i in 0..50) {
                if (doneFile.exists()) {
                    success = true
                    break
                }
                Thread.sleep(200)
            }
            
            if (!success) {
                throw IllegalStateException("Root daemon not responding! Run ./setup_emulators.sh on your host machine to enable Shizuku bypass for emulators.")
            }
            
            Runtime.getRuntime().exec(arrayOf("sh", "-c", "cat /data/data/com.tokiyo.shizukuspike/files/output.txt"))
        }
    }
}
