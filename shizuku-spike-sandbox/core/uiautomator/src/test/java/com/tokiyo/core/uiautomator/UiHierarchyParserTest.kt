package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.models.UiSelector
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UiHierarchyParserTest {

    private val mockXml = """
        <?xml version='1.0' encoding='UTF-8' standalone='yes' ?>
        <hierarchy rotation="0">
            <node index="0" text="" resource-id="" class="android.widget.FrameLayout" package="com.android.launcher" content-desc="" checkable="false" checked="false" clickable="false" enabled="true" focusable="false" focused="false" scrollable="false" long-clickable="false" password="false" selected="false" bounds="[0,0][1080,2400]">
                <node index="0" text="Settings" resource-id="com.android.launcher:id/settings_icon" class="android.widget.TextView" package="com.android.launcher" content-desc="Settings App" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="true" password="false" selected="false" bounds="[100,200][300,400]" />
                <node index="1" text="Camera" resource-id="com.android.launcher:id/camera_icon" class="android.widget.TextView" package="com.android.launcher" content-desc="" checkable="false" checked="false" clickable="true" enabled="true" focusable="true" focused="false" scrollable="false" long-clickable="true" password="false" selected="false" bounds="[400,200][600,400]" />
            </node>
        </hierarchy>
    """.trimIndent()

    @Test
    fun testParseXmlExtractsNodes() {
        val parser = UiHierarchyParser()
        val flatList = parser.parseFlatList(mockXml)
        
        // 1 FrameLayout + 2 children = 3 nodes total (hierarchy is ignored)
        assertEquals(3, flatList.size)
        
        val settingsNode = flatList.find { it.text == "Settings" }
        assertNotNull(settingsNode)
        assertEquals("com.android.launcher:id/settings_icon", settingsNode?.resourceId)
        assertEquals("Settings App", settingsNode?.contentDesc)
        assertTrue(settingsNode?.clickable == true)
        
        // Test bounds parsing and center calculation
        assertEquals("[100,200][300,400]", settingsNode?.boundsString)
        val center = settingsNode?.getCenterCoordinates()
        assertNotNull(center)
        assertEquals(200, center?.first) // (100+300)/2
        assertEquals(300, center?.second) // (200+400)/2
    }

    @Test
    fun testUiSelectorMatching() {
        val parser = UiHierarchyParser()
        val flatList = parser.parseFlatList(mockXml)
        
        val selector = UiSelector(text = "Camera", clickable = true)
        val matches = flatList.filter { selector.matches(it) }
        
        assertEquals(1, matches.size)
        assertEquals("Camera", matches.first().text)
    }
}
