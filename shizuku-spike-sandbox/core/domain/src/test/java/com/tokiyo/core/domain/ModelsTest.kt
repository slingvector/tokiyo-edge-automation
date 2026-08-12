package com.tokiyo.core.domain

import com.tokiyo.core.domain.models.UiNode
import com.tokiyo.core.domain.models.UiSelector
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ModelsTest {
    @Test
    fun testUiNode() {
        val node = UiNode(
            index = 1,
            text = "Test",
            resourceId = "id",
            className = "class",
            packageName = "pkg",
            contentDesc = "desc",
            checkable = false,
            checked = false,
            clickable = true,
            enabled = true,
            focusable = true,
            focused = false,
            scrollable = false,
            longClickable = false,
            password = false,
            selected = false,
            boundsString = "[0,0][100,100]",
            children = emptyList()
        )
        assertEquals(1, node.index)
        assertEquals("Test", node.text)
        assertEquals("id", node.resourceId)
        assertEquals("class", node.className)
        assertEquals("[0,0][100,100]", node.boundsString)
        assertTrue(node.children.isEmpty())
        
        val center = node.getCenterCoordinates()
        assertEquals(50, center?.first)
        assertEquals(50, center?.second)
    }

    @Test
    fun testUiSelector() {
        val selector = UiSelector(text = "Test", resourceId = "id")
        assertEquals("Test", selector.text)
        assertEquals("id", selector.resourceId)
    }
}
