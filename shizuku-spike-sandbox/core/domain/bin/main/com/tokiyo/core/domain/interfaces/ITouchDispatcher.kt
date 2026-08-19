package com.tokiyo.core.domain.interfaces

interface ITouchDispatcher {
    /**
     * Dispatch a tap with Gaussian jitter, bounded by [x1, y1] to [x2, y2].
     */
    suspend fun tap(boundsString: String): Boolean
    
    /**
     * Dispatch a swipe with random entropy added to duration and coordinates.
     */
    suspend fun swipe(startX: Int, startY: Int, endX: Int, endY: Int): Boolean
}
