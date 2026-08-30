package com.tokiyo.core.domain.interfaces

import com.tokiyo.core.domain.models.ShellResult

/**
 * Interface for executing compiled bash scripts.
 * Implemented by ShizukuExecutor/CompiledScriptExecutor in the infrastructure layer.
 */
interface ICompiledScriptExecutor {
    suspend fun executeScript(scriptContent: String): ShellResult
}
