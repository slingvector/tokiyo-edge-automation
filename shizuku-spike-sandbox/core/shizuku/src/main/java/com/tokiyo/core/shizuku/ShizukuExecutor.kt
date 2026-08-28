package com.tokiyo.core.shizuku

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.models.ShellResult
import rikka.shizuku.Shizuku

class ShizukuExecutor : ActionExecutor {
    override suspend fun executeCommand(command: String): ShellResult {
        return try {
            val process = if (Shizuku.pingBinder()) {
                createProcess(command)
            } else {
                val dir = java.io.File("/data/data/com.tokiyo.shizukuspike/files")
                dir.mkdirs()
                val cmdFile = java.io.File(dir, "command.txt")
                val doneFile = java.io.File(dir, "done.txt")
                
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

            
            val stdoutBuilder = java.lang.StringBuilder()
            val stderrBuilder = java.lang.StringBuilder()

            // Read streams concurrently to prevent pipe buffer deadlock
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

            // Wait for process to finish with a timeout of 60 seconds
            var exitCode = -1
            var finished = false
            for (i in 0..600) { // 600 * 100ms = 60 seconds
                try {
                    exitCode = process.exitValue()
                    finished = true
                    break
                } catch (e: Exception) {
                    Thread.sleep(100)
                }
            }

            if (!finished) {
                process.destroy()
                outThread.interrupt()
                errThread.interrupt()
                return ShellResult(-1, stdoutBuilder.toString(), "Execution timed out after 60 seconds.\n${stderrBuilder.toString()}")
            }

            // Wait for stream threads to finish
            outThread.join(1000)
            errThread.join(1000)

            ShellResult(
                exitCode = exitCode,
                stdout = stdoutBuilder.toString().trim(),
                stderr = stderrBuilder.toString().trim()
            )
        } catch (e: Exception) {
            ShellResult(-1, "", "Exception executing command: ${e.message}")
        }
    }

    internal open fun createProcess(command: String): Process {
        val method = Shizuku::class.java.getDeclaredMethod("newProcess", Array<String>::class.java, Array<String>::class.java, String::class.java)
        method.isAccessible = true
        return method.invoke(null, arrayOf("sh", "-c", command), null, null) as Process
    }
}
