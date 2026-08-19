package com.tokiyo.core.domain.interfaces

import com.tokiyo.core.domain.models.JobPayload

interface SignatureVerifier {
    fun verifyPayload(payload: JobPayload, rawJsonString: String): Boolean
}
