package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.models.ShellResult
import io.mockk.coEvery
import io.mockk.mockk
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

class FlightRecorderImplTest {

    private lateinit var executor: ActionExecutor
    private lateinit var flightRecorder: FlightRecorderImpl

    @Before
    fun setup() {
        executor = mockk()
        flightRecorder = FlightRecorderImpl(executor)
    }

    @Test
    fun `captureSnapshot returns base64 strings on success`() = runTest {
        // Mock XML compression
        coEvery { 
            executor.executeCommand("uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml | gzip > /data/local/tmp/dump.xml.gz && base64 /data/local/tmp/dump.xml.gz") 
        } returns ShellResult(0, "mocked_xml_base64\n", "")

        // Mock PNG compression
        coEvery { 
            executor.executeCommand("screencap -p /data/local/tmp/screen.png && cat /data/local/tmp/screen.png | gzip > /data/local/tmp/screen.png.gz && base64 /data/local/tmp/screen.png.gz") 
        } returns ShellResult(0, "mocked_png_base64\n", "")

        val result = flightRecorder.captureSnapshot()
        
        assertEquals("mocked_xml_base64", result.uiDumpBase64)
        assertEquals("mocked_png_base64", result.screenshotBase64)
    }

    @Test
    fun `captureSnapshot returns nulls on failure`() = runTest {
        // Mock XML failure
        coEvery { 
            executor.executeCommand("uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml | gzip > /data/local/tmp/dump.xml.gz && base64 /data/local/tmp/dump.xml.gz") 
        } returns ShellResult(1, "", "Error")

        // Mock PNG failure
        coEvery { 
            executor.executeCommand("screencap -p /data/local/tmp/screen.png && cat /data/local/tmp/screen.png | gzip > /data/local/tmp/screen.png.gz && base64 /data/local/tmp/screen.png.gz") 
        } returns ShellResult(1, "", "Error")

        val result = flightRecorder.captureSnapshot()
        
        assertEquals(null, result.uiDumpBase64)
        assertEquals(null, result.screenshotBase64)
    }
}
