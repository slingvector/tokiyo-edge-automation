package com.tokiyo.core.shizuku

import android.os.Process
import java.io.BufferedReader
import java.io.InputStreamReader
import kotlin.system.exitProcess
import org.json.JSONObject

class AgentUserService : IAgentUserService.Stub() {
    override fun getUid(): Int {
        return Process.myUid()
    }
    
    override fun executeShellCommand(command: String): String {
        return try {
            val process = Runtime.getRuntime().exec(arrayOf("sh", "-c", command))
            
            val stdoutBuilder = java.lang.StringBuilder()
            val stderrBuilder = java.lang.StringBuilder()
            
            val outThread = Thread {
                process.inputStream.bufferedReader().use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        stdoutBuilder.append(line).append("\n")
                    }
                }
            }
            
            val errThread = Thread {
                process.errorStream.bufferedReader().use { reader ->
                    var line: String?
                    while (reader.readLine().also { line = it } != null) {
                        stderrBuilder.append(line).append("\n")
                    }
                }
            }
            
            outThread.start()
            errThread.start()
            
            var exitCode = -1
            var finished = false
            for (i in 0..600) {
                try {
                    exitCode = process.exitValue()
                    finished = true
                    break
                } catch (e: Exception) {
                    Thread.sleep(100)
                }
            }
            
            if (!finished) {
                process.destroy()
                outThread.interrupt()
                errThread.interrupt()
                return JSONObject().apply {
                    put("exitCode", -1)
                    put("stdout", stdoutBuilder.toString())
                    put("stderr", "Execution timed out\n$stderrBuilder")
                }.toString()
            }
            
            outThread.join(1000)
            errThread.join(1000)
            
            JSONObject().apply {
                put("exitCode", exitCode)
                put("stdout", stdoutBuilder.toString().trim())
                put("stderr", stderrBuilder.toString().trim())
            }.toString()
            
        } catch (e: Exception) {
            JSONObject().apply {
                put("exitCode", -1)
                put("stdout", "")
                put("stderr", "Exception executing command: ${e.message}")
            }.toString()
        }
    }

    private var uiAutomation: Any? = null

    @Volatile
    private var lastScrollEventTime: Long = 0L

    private fun getUiAutomation(): Any? {
        if (uiAutomation != null) return uiAutomation
        try {
            val handlerThread = android.os.HandlerThread("UiAutomatorThread")
            handlerThread.start()
            val connection = Class.forName("android.app.UiAutomationConnection").newInstance()
            val uiAutomationClass = Class.forName("android.app.UiAutomation")
            uiAutomation = uiAutomationClass.getConstructor(android.os.Looper::class.java, Class.forName("android.app.IUiAutomationConnection"))
                .newInstance(handlerThread.looper, connection)
            
            try {
                val connectMethod = uiAutomationClass.getMethod("connect", Int::class.javaPrimitiveType)
                connectMethod.invoke(uiAutomation, 1)
            } catch (e: NoSuchMethodException) {
                val connectMethod = uiAutomationClass.getMethod("connect")
                connectMethod.invoke(uiAutomation)
            }

            try {
                val setListenerMethod = uiAutomationClass.getMethod("setOnAccessibilityEventListener", android.app.UiAutomation.OnAccessibilityEventListener::class.java)
                setListenerMethod.invoke(uiAutomation, android.app.UiAutomation.OnAccessibilityEventListener { event ->
                    if (event.eventType == android.view.accessibility.AccessibilityEvent.TYPE_VIEW_SCROLLED) {
                        lastScrollEventTime = System.currentTimeMillis()
                    }
                })
            } catch (e: Exception) {
                e.printStackTrace()
            }

            return uiAutomation
        } catch (e: Exception) {
            e.printStackTrace()
            return null
        }
    }

    private fun xmlEscape(str: CharSequence?): String {
        if (str == null) return ""
        val sb = java.lang.StringBuilder()
        for (i in 0 until str.length) {
            when (val c = str[i]) {
                '<' -> sb.append("&lt;")
                '>' -> sb.append("&gt;")
                '&' -> sb.append("&amp;")
                '\'' -> sb.append("&apos;")
                '"' -> sb.append("&quot;")
                else -> {
                    if (c.code in 0x20..0xD7FF || c.code in 0xE000..0xFFFD) {
                        sb.append(c)
                    } else {
                        sb.append("&#x").append(Integer.toHexString(c.code)).append(";")
                    }
                }
            }
        }
        return sb.toString()
    }

    private fun dumpNodeRec(node: android.view.accessibility.AccessibilityNodeInfo?, sb: java.lang.StringBuilder) {
        if (node == null) return
        
        val hasText = !node.text.isNullOrEmpty()
        val hasContentDesc = !node.contentDescription.isNullOrEmpty()
        
        // Aggressively prune invisible/non-actionable layout nodes to save tokens
        val isUseless = !hasText && 
                        !hasContentDesc && 
                        !node.isClickable && 
                        !node.isScrollable && 
                        !node.isCheckable &&
                        !node.isLongClickable &&
                        (node.className?.contains("Layout") == true || node.className?.toString() == "android.view.View" || node.className?.toString() == "android.view.ViewGroup")
                        
        if (isUseless) {
            for (i in 0 until node.childCount) {
                dumpNodeRec(node.getChild(i), sb)
            }
            return
        }

        val bounds = android.graphics.Rect()
        node.getBoundsInScreen(bounds)
        val boundsStr = "[${bounds.left},${bounds.top}][${bounds.right},${bounds.bottom}]"

        sb.append("<node index=\"0\" ")
        sb.append("text=\"").append(xmlEscape(node.text)).append("\" ")
        sb.append("resource-id=\"").append(xmlEscape(node.viewIdResourceName)).append("\" ")
        sb.append("class=\"").append(xmlEscape(node.className)).append("\" ")
        sb.append("package=\"").append(xmlEscape(node.packageName)).append("\" ")
        sb.append("content-desc=\"").append(xmlEscape(node.contentDescription)).append("\" ")
        sb.append("checkable=\"").append(node.isCheckable).append("\" ")
        sb.append("checked=\"").append(node.isChecked).append("\" ")
        sb.append("clickable=\"").append(node.isClickable).append("\" ")
        sb.append("enabled=\"").append(node.isEnabled).append("\" ")
        sb.append("focusable=\"").append(node.isFocusable).append("\" ")
        sb.append("focused=\"").append(node.isFocused).append("\" ")
        sb.append("scrollable=\"").append(node.isScrollable).append("\" ")
        sb.append("long-clickable=\"").append(node.isLongClickable).append("\" ")
        sb.append("password=\"").append(node.isPassword).append("\" ")
        sb.append("selected=\"").append(node.isSelected).append("\" ")
        sb.append("bounds=\"").append(boundsStr).append("\"")

        if (node.childCount == 0) {
            sb.append(" />\n")
        } else {
            sb.append(">\n")
            for (i in 0 until node.childCount) {
                dumpNodeRec(node.getChild(i), sb)
            }
            sb.append("</node>\n")
        }
    }

    override fun dumpWindowHierarchy(): String {
        try {
            val automation = getUiAutomation() ?: return "Error: Failed to init UiAutomation"
            
            val getRootMethod = automation.javaClass.getMethod("getRootInActiveWindow")
            var rootNode: android.view.accessibility.AccessibilityNodeInfo? = null
            for (i in 1..20) {
                val result = getRootMethod.invoke(automation)
                if (result != null) {
                    rootNode = result as android.view.accessibility.AccessibilityNodeInfo
                    break
                }
                Thread.sleep(100)
            }
            if (rootNode == null) {
                return "Error: getRootInActiveWindow returned null after 2s"
            }
            
            val sb = java.lang.StringBuilder()
            sb.append("<?xml version='1.0' encoding='UTF-8' standalone='yes' ?>\n")
            sb.append("<hierarchy rotation=\"0\">\n")
            dumpNodeRec(rootNode, sb)
            sb.append("</hierarchy>")
            
            val xml = sb.toString()
            val outputStream = java.io.ByteArrayOutputStream()
            val gzipStream = java.util.zip.GZIPOutputStream(outputStream)
            gzipStream.write(xml.toByteArray(Charsets.UTF_8))
            gzipStream.close()
            return java.util.Base64.getEncoder().encodeToString(outputStream.toByteArray())
        } catch (e: Exception) {
            return "Error: ${e.message}"
        }
    }

    override fun injectTouch(x: Int, y: Int): Boolean {
        try {
            val automation = getUiAutomation() ?: return false
            val injectMethod = automation.javaClass.getMethod("injectInputEvent", android.view.InputEvent::class.java, Boolean::class.javaPrimitiveType)
            
            val downTime = android.os.SystemClock.uptimeMillis()
            var eventTime = android.os.SystemClock.uptimeMillis()
            
            val downEvent = android.view.MotionEvent.obtain(downTime, eventTime, android.view.MotionEvent.ACTION_DOWN, x.toFloat(), y.toFloat(), 0)
            downEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            injectMethod.invoke(automation, downEvent, true)
            downEvent.recycle()
            
            eventTime = android.os.SystemClock.uptimeMillis()
            val upEvent = android.view.MotionEvent.obtain(downTime, eventTime, android.view.MotionEvent.ACTION_UP, x.toFloat(), y.toFloat(), 0)
            upEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            injectMethod.invoke(automation, upEvent, true)
            upEvent.recycle()
            
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    override fun injectOrganicTap(x: Int, y: Int): Boolean {
        try {
            val automation = getUiAutomation() ?: return false
            val injectMethod = automation.javaClass.getMethod("injectInputEvent", android.view.InputEvent::class.java, Boolean::class.javaPrimitiveType)
            
            val random = java.util.Random()
            val offsetX = (random.nextGaussian() * 5).toInt()
            val offsetY = (random.nextGaussian() * 5).toInt()
            val finalX = (x + offsetX).toFloat()
            val finalY = (y + offsetY).toFloat()

            val downTime = android.os.SystemClock.uptimeMillis()
            var eventTime = android.os.SystemClock.uptimeMillis()
            
            val downEvent = android.view.MotionEvent.obtain(downTime, eventTime, android.view.MotionEvent.ACTION_DOWN, finalX, finalY, 0)
            downEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            injectMethod.invoke(automation, downEvent, true)
            downEvent.recycle()
            
            Thread.sleep(40L + random.nextInt(50))
            
            eventTime = android.os.SystemClock.uptimeMillis()
            val upEvent = android.view.MotionEvent.obtain(downTime, eventTime, android.view.MotionEvent.ACTION_UP, finalX, finalY, 0)
            upEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            injectMethod.invoke(automation, upEvent, true)
            upEvent.recycle()
            
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    override fun injectOrganicSwipe(startX: Int, startY: Int, endX: Int, endY: Int, durationMs: Int): Boolean {
        try {
            val automation = getUiAutomation() ?: return false
            val injectMethod = automation.javaClass.getMethod("injectInputEvent", android.view.InputEvent::class.java, Boolean::class.javaPrimitiveType)
            
            val downTime = android.os.SystemClock.uptimeMillis()
            
            val downEvent = android.view.MotionEvent.obtain(downTime, downTime, android.view.MotionEvent.ACTION_DOWN, startX.toFloat(), startY.toFloat(), 0)
            downEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            injectMethod.invoke(automation, downEvent, true)
            downEvent.recycle()
            
            val steps = Math.max(10, durationMs / 15)
            val sleepTime = (durationMs / steps).toLong()
            
            val ctrlX = (startX + endX) / 2 + 50
            val ctrlY = (startY + endY) / 2
            
            for (i in 1..steps) {
                val t = i.toFloat() / steps
                val u = 1f - t
                val currX = u * u * startX + 2 * u * t * ctrlX + t * t * endX
                val currY = u * u * startY + 2 * u * t * ctrlY + t * t * endY
                
                Thread.sleep(sleepTime)
                val eventTime = android.os.SystemClock.uptimeMillis()
                val moveEvent = android.view.MotionEvent.obtain(downTime, eventTime, android.view.MotionEvent.ACTION_MOVE, currX, currY, 0)
                moveEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
                injectMethod.invoke(automation, moveEvent, true)
                moveEvent.recycle()
            }
            
            val eventTime = android.os.SystemClock.uptimeMillis()
            val upEvent = android.view.MotionEvent.obtain(downTime, eventTime, android.view.MotionEvent.ACTION_UP, endX.toFloat(), endY.toFloat(), 0)
            upEvent.source = android.view.InputDevice.SOURCE_TOUCHSCREEN
            injectMethod.invoke(automation, upEvent, true)
            upEvent.recycle()
            
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    override fun injectOrganicText(text: String): Boolean {
        try {
            val automation = getUiAutomation() ?: return false
            val injectMethod = automation.javaClass.getMethod("injectInputEvent", android.view.InputEvent::class.java, Boolean::class.javaPrimitiveType)
            
            val keyMap = android.view.KeyCharacterMap.load(android.view.KeyCharacterMap.VIRTUAL_KEYBOARD)
            val events = keyMap.getEvents(text.toCharArray())
            
            val random = java.util.Random()
            
            if (events != null) {
                for (event in events) {
                    injectMethod.invoke(automation, event, true)
                    if (event.action == android.view.KeyEvent.ACTION_UP) {
                        Thread.sleep(40L + random.nextInt(80))
                    }
                }
            }
            return true
        } catch (e: Exception) {
            e.printStackTrace()
            return false
        }
    }

    override fun waitForScrollIdle(timeoutMs: Long): Boolean {
        // We wait up to timeoutMs to see if scrolling stops.
        // If it stops (lastScrollEventTime was > 500ms ago), we return true.
        val startTime = System.currentTimeMillis()
        while (System.currentTimeMillis() - startTime < timeoutMs) {
            if (System.currentTimeMillis() - lastScrollEventTime > 500) {
                return true
            }
            Thread.sleep(50)
        }
        // If we timeout and it's still scrolling, return false
        return System.currentTimeMillis() - lastScrollEventTime > 500
    }

    override fun destroy() {
        exitProcess(0)
    }
}
