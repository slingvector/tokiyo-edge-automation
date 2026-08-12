package com.tokiyo.core.domain.interfaces

import com.tokiyo.core.domain.models.UiNode
import com.tokiyo.core.domain.models.UiSelector

interface UiAutomatorClient {
    suspend fun dumpHierarchy(): List<UiNode>
    suspend fun findNode(selector: UiSelector): UiNode?
    suspend fun clickElement(selector: UiSelector): Boolean
}
