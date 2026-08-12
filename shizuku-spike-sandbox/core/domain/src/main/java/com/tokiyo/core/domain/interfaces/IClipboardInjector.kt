package com.tokiyo.core.domain.interfaces

interface IClipboardInjector {
    /**
     * Pastes the text safely into the currently focused input field.
     */
    suspend fun pasteText(text: String): Boolean
}
