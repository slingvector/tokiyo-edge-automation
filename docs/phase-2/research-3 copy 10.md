You are at the final mile. This is where the digital intent turns into physical action.
While you could execute adb shell input tap X Y via Shizuku, spinning up a shell process for every tap takes ~50–150ms. If you are executing a fast scroll or a multi-touch sequence, that latency will cause your automation to stutter and fail.
Instead, we will inject MotionEvents directly into the system.
You mentioned InputManager. While InputManager.injectInputEvent() is the underlying OS method, it is a hidden/restricted Android API (@UnsupportedAppUsage). Calling it directly requires brittle reflection that breaks across Android versions.
Because your Agent already initialized UiAutomation in the previous step to dump the XML tree, you have access to UiAutomation.injectInputEvent(). This is a stable, public API that wraps InputManager perfectly. Since Shizuku granted your UiAutomation instance adb privileges, Android will accept these injected events natively.
Here is the production-ready Kotlin code to inject the tap, complete with humanization to avoid bot detection.
1. The Injection Engine
This object constructs the physical MotionEvent (the exact same object Android creates when a real human finger touches the glass) and dispatches it.
import android.app.UiAutomation
import android.os.SystemClock
import android.view.InputDevice
import android.view.MotionEvent
import kotlinx.coroutines.delay

object TouchInjector {

    /**
     * Injects a human-like tap at the specified coordinates.
     * 
     * @param uiAutomation The instance obtained from Shizuku
     * @param x The X coordinate on the screen
     * @param y The Y coordinate on the screen
     */
    suspend fun injectTap(uiAutomation: UiAutomation, x: Int, y: Int) {
        // 1. Calculate a slightly randomized press duration (human taps aren't instant)
        val pressDuration = (40..90).random().toLong() 
        
        val downTime = SystemClock.uptimeMillis()
        val eventTime = downTime + pressDuration

        // 2. Construct the ACTION_DOWN event (Finger touches the screen)
        val downEvent = MotionEvent.obtain(
            downTime, 
            downTime, 
            MotionEvent.ACTION_DOWN, 
            x.toFloat(), 
            y.toFloat(), 
            0 // Meta state
        ).apply {
            source = InputDevice.SOURCE_TOUCHSCREEN
        }

        // 3. Construct the ACTION_UP event (Finger lifts off the screen)
        val upEvent = MotionEvent.obtain(
            downTime, 
            eventTime, 
            MotionEvent.ACTION_UP, 
            x.toFloat(), 
            y.toFloat(), 
            0
        ).apply {
            source = InputDevice.SOURCE_TOUCHSCREEN
        }

        // 4. Dispatch the events directly to the OS
        // The 'true' flag means we wait for the injection to complete synchronously
        uiAutomation.injectInputEvent(downEvent, true)
        
        // Wait for the simulated duration of the physical press
        delay(pressDuration)
        
        uiAutomation.injectInputEvent(upEvent, true)

        // 5. Clean up memory to prevent Binder leaks
        downEvent.recycle()
        upEvent.recycle()
    }
}

2. The Anti-Bot Offset (Humanization)
If your Control Plane calculates the exact center of the "Follow" button to be (500, 1000) and you tap that exact pixel 1,000 times a day, advanced apps (like Instagram or banking apps) will flag the account. Humans never tap the dead center of a button.
We solve this by taking the Rect bounds we found in the Semantic Parser and applying a Gaussian blur (normal distribution) to the coordinates so the tap lands organically within the button.
import android.graphics.Rect
import java.util.Random

object Humanizer {
    private val random = Random()

    /**
     * Generates a coordinate organically clustered around the center of the bounds,
     * ensuring the tap never falls outside the button.
     */
    fun getOrganicTapCoordinate(bounds: Rect): Pair<Int, Int> {
        val width = bounds.width()
        val height = bounds.height()

        // Standard deviation is 1/6th of the button size.
        // This ensures 99.7% of taps fall within the button naturally.
        val stdDevX = width / 6.0
        val stdDevY = height / 6.0

        // Generate Gaussian distributed coordinates
        var offsetX = (random.nextGaussian() * stdDevX).toInt()
        var offsetY = (random.nextGaussian() * stdDevY).toInt()

        // Clamp the offsets just in case the math pushes it outside the physical button
        val maxOffsetX = (width / 2) - 1
        val maxOffsetY = (height / 2) - 1
        
        offsetX = offsetX.coerceIn(-maxOffsetX, maxOffsetX)
        offsetY = offsetY.coerceIn(-maxOffsetY, maxOffsetY)

        val targetX = bounds.centerX() + offsetX
        val targetY = bounds.centerY() + offsetY

        return Pair(targetX, targetY)
    }
}

3. The Final Execution Flow
Now, integrate this back into your Edge Agent's WebSocket command handler. When the command {"action": "tap", "target": "Follow"} comes in:
// 1. Flatten the UI tree
val uiState = UiTreeParser.flattenTree(uiAutomation.rootInActiveWindow)

// 2. Find the bounding box of the semantic target
val targetNode = SemanticResolver.findBestNode(uiState, "Follow")

if (targetNode != null) {
    // 3. Generate a human-like coordinate within that bounding box
    val (tapX, tapY) = Humanizer.getOrganicTapCoordinate(targetNode.bounds)
    
    // 4. Inject the physical touch event
    TouchInjector.injectTap(uiAutomation, tapX, tapY)
    
    println("Successfully tapped 'Follow' organically at X:$tapX, Y:$tapY")
} else {
    println("Target not found.")
}

Because UiAutomation.injectInputEvent() operates at the framework level, this bypasses the Android Window boundaries. It will successfully click on standard App UIs, system permission dialogs, out-of-app overlays, and SDUI components alike.