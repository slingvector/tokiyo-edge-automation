package com.tokiyo.core.domain.models

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

@Serializable
data class JobPayload(
    val job_id: String,
    val node_id: String,
    val action: String,
    val timestamp: Long,
    val ttl_seconds: Long,
    val signature: String,
    val params: Map<String, JsonElement>
)
