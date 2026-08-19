package com.tokiyo.core.domain.interfaces

interface IAppLifecycleController {
    suspend fun launchDeepLink(url: String, packageName: String): Boolean
    suspend fun forceStop(packageName: String): Boolean
    suspend fun clearCache(packageName: String): Boolean
}
