package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.IAppLifecycleController

class AppLifecycleControllerImpl(
    private val executor: ActionExecutor
) : IAppLifecycleController {

    override suspend fun launchDeepLink(url: String, packageName: String): Boolean {
        // am start -W -a android.intent.action.VIEW -d "url" package
        val cmd = "am start -W -a android.intent.action.VIEW -d \"$url\" $packageName"
        val result = executor.executeCommand(cmd)
        return result.exitCode == 0
    }

    override suspend fun forceStop(packageName: String): Boolean {
        val result = executor.executeCommand("am force-stop $packageName")
        return result.exitCode == 0
    }

    override suspend fun clearCache(packageName: String): Boolean {
        val result = executor.executeCommand("pm clear $packageName")
        return result.exitCode == 0
    }
}
