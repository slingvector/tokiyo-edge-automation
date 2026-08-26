package com.tokiyo.core.uiautomator

import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.UiAutomatorClient
import com.tokiyo.core.domain.models.UiNode
import com.tokiyo.core.domain.models.UiSelector
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class UiAutomatorService(
    private val actionExecutor: ActionExecutor
) : UiAutomatorClient {
    private val parser = UiHierarchyParser()

    /**
     * Dumps the current UI hierarchy and returns the flat list of nodes.
     */
    override suspend fun dumpHierarchy(): List<UiNode> = withContext(Dispatchers.IO) {
        val result = actionExecutor.executeCommand("uiautomator dump /data/local/tmp/dump.xml && cat /data/local/tmp/dump.xml")
        if (result.exitCode != 0) {
            System.err.println("Failed to dump hierarchy: ${result.stderr}")
            return@withContext emptyList()
        }

        var output = result.stdout
        val xmlStart = output.indexOf("<?xml")
        if (xmlStart != -1) {
            output = output.substring(xmlStart)
        }

        parser.parseFlatList(output)
    }

    /**
     * Finds the first node that matches the selector.
     */
    override suspend fun findNode(selector: UiSelector): UiNode? {
        var nodes = dumpHierarchy()
        var match = nodes.find { selector.matches(it) }
        
        // Double-Pass Validation
        if (match == null) {
            kotlinx.coroutines.delay(500)
            nodes = dumpHierarchy()
            match = nodes.find { selector.matches(it) }
        }
        return match
    }

    /**
     * Finds the node, calculates its center, and issues a tap command via Shizuku.
     */
    override suspend fun clickElement(selector: UiSelector): Boolean {
        val node = findNode(selector)
        if (node != null) {
            val center = node.getCenterCoordinates()
            if (center != null) {
                val (x, y) = center
                val result = actionExecutor.executeCommand("input tap $x $y")
                return result.exitCode == 0
            }
        }
        return false
    }
}
