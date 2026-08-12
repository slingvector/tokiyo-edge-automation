package com.tokiyo.shizukuspike.service

import android.content.Intent
import android.os.Build
import io.mockk.every
import io.mockk.mockkStatic
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.Robolectric
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import rikka.shizuku.Shizuku

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [28])
@OptIn(ExperimentalCoroutinesApi::class)
class AgentBridgeServiceTest {

    @Before
    fun setup() {
        mockkStatic(Shizuku::class)
        every { Shizuku.pingBinder() } returns true
    }

    @Test
    fun `service creates successfully and starts sticky`() = runTest {
        val controller = Robolectric.buildService(AgentBridgeService::class.java)
        
        val service = controller.create().get()
        assertNotNull(service)

        val intent = Intent()
        val startCommandResult = service.onStartCommand(intent, 0, 1)
        
        assertEquals(android.app.Service.START_STICKY, startCommandResult)
        
        controller.destroy()
    }
}
