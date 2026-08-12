package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.models.ShellResult
import com.tokiyo.core.domain.models.UiSelector
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class UiAutomatorServiceTest {

    private lateinit var actionExecutor: ActionExecutor
    private lateinit var service: UiAutomatorService

    private val mockXml = """
        <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
        <hierarchy rotation="0">
            <node index="0" text="" resource-id="" class="android.widget.FrameLayout" bounds="[0,0][1080,2400]">
                <node index="0" text="Settings" resource-id="com.android.launcher:id/settings_icon" bounds="[100,200][300,400]" />
                <node index="1" text="Camera" resource-id="com.android.launcher:id/camera_icon" bounds="[400,200][600,400]" />
            </node>
        </hierarchy>
    """.trimIndent()

    @Before
    fun setup() {
        actionExecutor = mockk()
        service = UiAutomatorService(actionExecutor)
    }

    @Test
    fun `dumpHierarchy returns parsed nodes on success`() = runTest {
        val cmd = "uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml"
        coEvery { actionExecutor.executeCommand(cmd) } returns ShellResult(0, mockXml, "")

        val nodes = service.dumpHierarchy()
        assertEquals(3, nodes.size) // frameLayout + 2 children (hierarchy tag is ignored by flat list)
    }

    @Test
    fun `dumpHierarchy returns empty list on dump failure`() = runTest {
        val cmd = "uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml"
        coEvery { actionExecutor.executeCommand(cmd) } returns ShellResult(1, "", "Error dumping")

        val nodes = service.dumpHierarchy()
        assertTrue(nodes.isEmpty())
    }



    @Test
    fun `findNode returns correct node`() = runTest {
        val cmd = "uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml"
        coEvery { actionExecutor.executeCommand(cmd) } returns ShellResult(0, mockXml, "")
        
        val selector = UiSelector(text = "Settings")
        val node = service.findNode(selector)
        
        assertNotNull(node)
        assertEquals("Settings", node?.text)
    }

    @Test
    fun `findNode returns null if not found`() = runTest {
        val cmd = "uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml"
        coEvery { actionExecutor.executeCommand(cmd) } returns ShellResult(0, mockXml, "")
        
        val selector = UiSelector(text = "NonExistent")
        val node = service.findNode(selector)
        
        assertNull(node)
    }

    @Test
    fun `clickElement returns true on success`() = runTest {
        val cmd = "uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml"
        coEvery { actionExecutor.executeCommand(cmd) } returns ShellResult(0, mockXml, "")
        coEvery { actionExecutor.executeCommand("input tap 200 300") } returns ShellResult(0, "", "")
        
        val selector = UiSelector(text = "Settings")
        val result = service.clickElement(selector)
        
        assertTrue(result)
        coVerify { actionExecutor.executeCommand("input tap 200 300") }
    }

    @Test
    fun `clickElement returns false if element not found`() = runTest {
        val cmd = "uiautomator dump /data/local/tmp/dump.xml > /dev/null 2>&1 && cat /data/local/tmp/dump.xml"
        coEvery { actionExecutor.executeCommand(cmd) } returns ShellResult(0, mockXml, "")
        
        val selector = UiSelector(text = "NonExistent")
        val result = service.clickElement(selector)
        
        assertFalse(result)
        coVerify(exactly = 0) { actionExecutor.executeCommand(match { it.startsWith("input tap") }) }
    }
}
