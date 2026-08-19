package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.ITouchDispatcher
import java.util.Random

class TouchDispatcherImpl(
    private val executor: ActionExecutor
) : ITouchDispatcher {
    
    private val random = Random()

    override suspend fun tap(boundsString: String): Boolean {
        val regex = """\[(\d+),(\d+)\]\[(\d+),(\d+)\]""".toRegex()
        val matchResult = regex.find(boundsString) ?: return false

        val (x1Str, y1Str, x2Str, y2Str) = matchResult.destructured
        val x1 = x1Str.toInt()
        val y1 = y1Str.toInt()
        val x2 = x2Str.toInt()
        val y2 = y2Str.toInt()

        val centerX = (x1 + x2) / 2
        val centerY = (y1 + y2) / 2

        // 3-Sigma rule: 99.7% of values lie within 3 standard deviations
        // We want the random clicks to stay within the bounding box
        val sigmaX = (x2 - x1) / 6.0
        val sigmaY = (y2 - y1) / 6.0

        var tapX = (centerX + random.nextGaussian() * sigmaX).toInt()
        var tapY = (centerY + random.nextGaussian() * sigmaY).toInt()

        // Clamp to bounds just in case of the 0.3% outlier
        tapX = tapX.coerceIn(x1, x2)
        tapY = tapY.coerceIn(y1, y2)

        val result = executor.executeCommand("input tap $tapX $tapY")
        return result.exitCode == 0
    }

    override suspend fun swipe(startX: Int, startY: Int, endX: Int, endY: Int): Boolean {
        // Add random jitter to swipe coordinates (e.g., +/- 20 pixels)
        val jitterStart = 20
        val sx = startX + (random.nextGaussian() * jitterStart).toInt()
        val sy = startY + (random.nextGaussian() * jitterStart).toInt()
        
        val ex = endX + (random.nextGaussian() * jitterStart).toInt()
        val ey = endY + (random.nextGaussian() * jitterStart).toInt()

        // Randomize swipe duration between 200ms and 600ms to simulate human speed variations
        val duration = 200 + random.nextInt(400)

        val result = executor.executeCommand("input touchscreen swipe $sx $sy $ex $ey $duration")
        return result.exitCode == 0
    }
}
