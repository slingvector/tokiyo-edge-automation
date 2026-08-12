package com.tokiyo.core.domain.models

/**
 * Represents a semantic query to find a UiNode.
 */
data class UiSelector(
    val text: String? = null,
    val textContains: String? = null,
    val resourceId: String? = null,
    val contentDesc: String? = null,
    val className: String? = null,
    val clickable: Boolean? = null
) {
    /**
     * Checks if a given node matches this selector.
     */
    fun matches(node: UiNode): Boolean {
        if (text != null && node.text != text && node.contentDesc != text) return false
        if (textContains != null && !node.text.contains(textContains, ignoreCase = true) && !node.contentDesc.contains(textContains, ignoreCase = true)) return false
        if (resourceId != null && node.resourceId != resourceId) return false
        if (contentDesc != null && node.contentDesc != contentDesc) return false
        if (className != null && node.className != className) return false
        if (clickable != null && node.clickable != clickable) return false
        return true
    }
}
