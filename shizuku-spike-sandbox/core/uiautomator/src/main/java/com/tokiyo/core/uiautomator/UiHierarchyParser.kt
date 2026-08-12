package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.models.UiNode
import org.xmlpull.v1.XmlPullParser
import org.xmlpull.v1.XmlPullParserFactory
import java.io.StringReader

class UiHierarchyParser {

    /**
     * Parses a raw UiAutomator XML string and returns a flat list of all nodes.
     * Uses XmlPullParser for faster, lower-memory execution on-device.
     */
    fun parseFlatList(xmlString: String): List<UiNode> {
        if (xmlString.isBlank()) return emptyList()
        val nodes = mutableListOf<UiNode>()
        try {
            val factory = XmlPullParserFactory.newInstance()
            factory.isNamespaceAware = true
            val xpp = factory.newPullParser()
            xpp.setInput(StringReader(xmlString))

            var eventType = xpp.eventType
            while (eventType != XmlPullParser.END_DOCUMENT) {
                if (eventType == XmlPullParser.START_TAG && xpp.name == "node") {
                    val text = xpp.getAttributeValue(null, "text") ?: ""
                    val resourceId = xpp.getAttributeValue(null, "resource-id") ?: ""
                    val className = xpp.getAttributeValue(null, "class") ?: ""
                    val contentDesc = xpp.getAttributeValue(null, "content-desc") ?: ""
                    val bounds = xpp.getAttributeValue(null, "bounds") ?: ""
                    val checkable = xpp.getAttributeValue(null, "checkable")?.toBoolean() ?: false
                    val checked = xpp.getAttributeValue(null, "checked")?.toBoolean() ?: false
                    val clickable = xpp.getAttributeValue(null, "clickable")?.toBoolean() ?: false
                    val enabled = xpp.getAttributeValue(null, "enabled")?.toBoolean() ?: false
                    val focusable = xpp.getAttributeValue(null, "focusable")?.toBoolean() ?: false
                    val focused = xpp.getAttributeValue(null, "focused")?.toBoolean() ?: false
                    val scrollable = xpp.getAttributeValue(null, "scrollable")?.toBoolean() ?: false
                    val longClickable = xpp.getAttributeValue(null, "long-clickable")?.toBoolean() ?: false
                    val password = xpp.getAttributeValue(null, "password")?.toBoolean() ?: false
                    val selected = xpp.getAttributeValue(null, "selected")?.toBoolean() ?: false
                    val index = xpp.getAttributeValue(null, "index")?.toIntOrNull() ?: 0
                    val packageName = xpp.getAttributeValue(null, "package") ?: ""

                    nodes.add(
                        UiNode(
                            index = index,
                            text = text,
                            resourceId = resourceId,
                            className = className,
                            packageName = packageName,
                            contentDesc = contentDesc,
                            checkable = checkable,
                            checked = checked,
                            clickable = clickable,
                            enabled = enabled,
                            focusable = focusable,
                            focused = focused,
                            scrollable = scrollable,
                            longClickable = longClickable,
                            password = password,
                            selected = selected,
                            boundsString = bounds,
                            children = emptyList() // We skip building a full tree for speed
                        )
                    )
                }
                eventType = xpp.next()
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
        return nodes
    }

    /**
     * Stub for parseTree since we prefer flat list parsing on-device.
     */
    fun parseTree(xml: String): UiNode? {
        val flatList = parseFlatList(xml)
        return flatList.firstOrNull()
    }
}
