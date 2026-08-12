package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.models.ShellResult
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import io.mockk.slot
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class TouchDispatcherImplTest {

    private lateinit var executor: ActionExecutor
    private lateinit var dispatcher: TouchDispatcherImpl

    @Before
    fun setup() {
        executor = mockk()
        dispatcher = TouchDispatcherImpl(executor)
    }

    @Test
    fun `tap with Gaussian jitter generates coordinates inside bounds`() = runTest {
        val boundsString = "[100,200][300,600]" // Center: 200, 400. Width: 200, Height: 400.

        val cmdSlot = slot<String>()
        coEvery { executor.executeCommand(capture(cmdSlot)) } returns ShellResult(0, "", "")

        // Run multiple times to verify bounds clamping and distribution
        for (i in 1..100) {
            dispatcher.tap(boundsString)
            
            val cmd = cmdSlot.captured
            assertTrue(cmd.startsWith("input tap "))
            
            val parts = cmd.split(" ")
            val x = parts[2].toInt()
            val y = parts[3].toInt()
            
            assertTrue("X coordinate $x out of bounds", x in 100..300)
            assertTrue("Y coordinate $y out of bounds", y in 200..600)
        }
        
        coVerify(exactly = 100) { executor.executeCommand(any()) }
    }
    @Test
    fun `swipe adds random jitter and duration`() = runTest {
        val cmdSlot = slot<String>()
        coEvery { executor.executeCommand(capture(cmdSlot)) } returns ShellResult(0, "", "")

        val result = dispatcher.swipe(100, 200, 100, 800)
        assertTrue(result)
        
        val cmd = cmdSlot.captured
        assertTrue(cmd.startsWith("input touchscreen swipe "))
        
        val parts = cmd.split(" ")
        val sx = parts[3].toInt()
        val sy = parts[4].toInt()
        val ex = parts[5].toInt()
        val ey = parts[6].toInt()
        val duration = parts[7].toInt()
        
        // Jitter is random.nextGaussian() * 20.
        assertTrue(sx in 20..180)
        assertTrue(sy in 120..280)
        assertTrue(ex in 20..180)
        assertTrue(ey in 720..880)
        assertTrue(duration in 200..600)
    }
}
