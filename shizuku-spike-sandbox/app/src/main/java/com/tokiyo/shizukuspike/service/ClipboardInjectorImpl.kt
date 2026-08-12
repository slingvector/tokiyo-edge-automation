package com.tokiyo.shizukuspike.service

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import com.tokiyo.core.domain.interfaces.ActionExecutor
import com.tokiyo.core.domain.interfaces.IClipboardInjector
import kotlinx.coroutines.delay

class ClipboardInjectorImpl(
    private val context: Context,
    private val executor: ActionExecutor
) : IClipboardInjector {

    override suspend fun pasteText(text: String): Boolean {
        return try {
            val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
            val clip = ClipData.newPlainText("tokiyo_payload", text)
            
            // Set clipboard on the main thread or whichever thread this runs on, 
            // but we must ensure it's available for the OS.
            clipboard.setPrimaryClip(clip)

            // Wait briefly for the clipboard to propagate
            delay(50)

            // Inject KEYCODE_PASTE (279)
            val result = executor.executeCommand("input keyevent 279")

            // Aggressive Cleanup: Wipe clipboard to avoid data leakage
            delay(100)
            clipboard.setPrimaryClip(ClipData.newPlainText("", ""))

            result.exitCode == 0
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }
}
