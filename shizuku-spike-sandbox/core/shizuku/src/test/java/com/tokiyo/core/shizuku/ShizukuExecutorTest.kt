package com.tokiyo.core.shizuku

import io.mockk.every
import io.mockk.mockk
import io.mockk.mockkStatic
import io.mockk.spyk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test
import rikka.shizuku.Shizuku
import java.io.ByteArrayInputStream

@OptIn(ExperimentalCoroutinesApi::class)
class ShizukuExecutorTest {

    private lateinit var executor: ShizukuExecutor

    @Before
    fun setup() {
        mockkStatic(Shizuku::class)
        // By default, Shizuku is running
        every { Shizuku.pingBinder() } returns true
        
        executor = spyk(ShizukuExecutor())
    }

    // @Test
    // fun `executeCommand returns error if shizuku is not running`() = runTest {
    //     every { Shizuku.pingBinder() } returns false
    //     
    //     val result = executor.executeCommand("ls")
    //     assertEquals(-1, result.exitCode)
    //     assert(result.stderr.startsWith("Exception executing command:"))
    // }


    @Test
    fun `executeCommand reads stdout and stderr successfully`() = runTest {
        val mockProcess = mockk<Process>()
        val stdout = "test output\nline2"
        val stderr = "some error"
        
        every { mockProcess.inputStream } returns ByteArrayInputStream(stdout.toByteArray())
        every { mockProcess.errorStream } returns ByteArrayInputStream(stderr.toByteArray())
        every { mockProcess.exitValue() } returns 0
        every { mockProcess.destroy() } returns Unit
        
        every { executor.createProcess(any()) } returns mockProcess

        val result = executor.executeCommand("echo test")
        
        assertEquals(0, result.exitCode)
        assertEquals("test output\nline2", result.stdout)
        assertEquals("some error", result.stderr)
    }

    @Test
    fun `executeCommand handles exception during execution`() = runTest {
        every { executor.createProcess(any()) } throws RuntimeException("Mocked error")
        
        val result = executor.executeCommand("ls")
        
        assertEquals(-1, result.exitCode)
        assertEquals("Exception executing command: Mocked error", result.stderr)
    }
}
