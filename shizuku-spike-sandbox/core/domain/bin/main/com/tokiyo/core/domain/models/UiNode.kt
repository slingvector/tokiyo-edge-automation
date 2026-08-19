package com.tokiyo.core.domain.models

/**
 * Represents a node in the Android UiAutomator XML dump.
 */
data class UiNode(
    val index: Int,
    val text: String,
    val resourceId: String,
    val className: String,
    val packageName: String,
    val contentDesc: String,
    val checkable: Boolean,
    val checked: Boolean,
    val clickable: Boolean,
    val enabled: Boolean,
    val focusable: Boolean,
    val focused: Boolean,
    val scrollable: Boolean,
    val longClickable: Boolean,
    val password: Boolean,
    val selected: Boolean,
    val boundsString: String,
    val children: List<UiNode> = emptyList()
) {
    /**
     * Parses a bounds string like "[189,501][247,616]" and returns the center coordinates.
     */
    fun getCenterCoordinates(): Pair<Int, Int>? {
        val regex = """\[(\d+),(\d+)\]\[(\d+),(\d+)\]""".toRegex()
        val matchResult = regex.find(boundsString)
        if (matchResult != null) {
            val (x1, y1, x2, y2) = matchResult.destructured
            val centerX = (x1.toInt() + x2.toInt()) / 2
            val centerY = (y1.toInt() + y2.toInt()) / 2
            return Pair(centerX, centerY)
        }
        return null
    }
}
