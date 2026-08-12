package com.tokiyo.core.domain.interfaces

import com.tokiyo.core.domain.models.SnapshotData

interface IFlightRecorder {
    suspend fun captureSnapshot(): SnapshotData
}
