package com.tokiyo.core.domain.interfaces

import com.tokiyo.core.domain.models.ShellResult

interface ActionExecutor {
    suspend fun executeCommand(command: String): ShellResult
}
