package com.tokiyo.core.domain.models

data class ShellResult(
    val exitCode: Int,
    val stdout: String,
    val stderr: String
)
