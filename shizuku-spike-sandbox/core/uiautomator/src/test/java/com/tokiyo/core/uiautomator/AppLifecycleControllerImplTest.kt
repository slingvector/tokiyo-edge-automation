package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.models.ShellResult
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.mockk
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

@OptIn(ExperimentalCoroutinesApi::class)
class AppLifecycleControllerImplTest {

    private lateinit var executor: ActionExecutor
    private lateinit var controller: AppLifecycleControllerImpl

    @Before
    fun setup() {
        executor = mockk()
        controller = AppLifecycleControllerImpl(executor)
    }

    @Test
    fun `launchDeepLink executes correct shell command`() = runTest {
        coEvery { executor.executeCommand(any()) } returns ShellResult(0, "", "")
        
        val result = controller.launchDeepLink("myapp://link", "com.example.app")
        
        assertTrue(result)
        coVerify { executor.executeCommand("am start -W -a android.intent.action.VIEW -d \"myapp://link\" com.example.app") }
    }

    @Test
    fun `forceStop executes correct shell command`() = runTest {
        coEvery { executor.executeCommand(any()) } returns ShellResult(0, "", "")
        
        val result = controller.forceStop("com.example.app")
        
        assertTrue(result)
        coVerify { executor.executeCommand("am force-stop com.example.app") }
    }

    @Test
    fun `clearCache executes correct shell command`() = runTest {
        coEvery { executor.executeCommand(any()) } returns ShellResult(0, "", "")
        
        val result = controller.clearCache("com.example.app")
        
        assertTrue(result)
        coVerify { executor.executeCommand("pm clear com.example.app") }
    }
}
