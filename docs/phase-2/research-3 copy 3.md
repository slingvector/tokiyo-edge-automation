Social media applications (Instagram, LinkedIn, X, TikTok) are the most hostile environments for automation. They do not use standard Android XML views; they use Server-Driven UI (SDUI), Jetpack Compose, and Meta’s Litho framework.
In these frameworks, standard resource IDs (R.id.like_button) are completely stripped or randomized on every build. The UI hierarchy is dynamically reconstructed on the fly, and the app continuously streams touch telemetry, gesture velocities, and viewport dwell times back to anti-fraud backends.
To beat this, you must treat social media automation as a set of specialized tactical execution engines.
Part 1: Deep Dive into Social Media Prototypes
                     ┌────────────────────────────────────────┐
                     │         Control Plane (Intent)         │
                     └───────────────────┬────────────────────┘
                                         │ JSON Instruction
                                         ▼
                     ┌────────────────────────────────────────┐
                     │           Kotlin Edge Agent            │
                     │                                        │
 ┌───────────────────┼───────────────────┼────────────────────┼───────────────────┐
 │ Feed Ingestion    │ Engagement Engine │ Media Pipeline     │ Messaging/DM      │
 │ • Virtualization  │ • Relative Bounds │ • MediaStore Sync  │ • IME Simulation  │
 │ • Anchor Tracking │ • Bezier Gestures │ • Canvas Cropping  │ • Thread Scraper  │
 └───────────────────┴───────────────────┴────────────────────┴───────────────────┘

Domain 1: Feed Ingestion & Virtualization Mechanics
Social media feeds use virtualized recycling containers (RecyclerView in Android View, LazyColumn in Jetpack Compose). When an item scrolls 10 pixels off-screen, its memory is destroyed and recycled.
Prototype SM-01: The Viewport Dwell & Anchor-Lock Engine
 * The Problem: If you dump the UI tree while the feed is still inertia-scrolling, bounding boxes will be completely misaligned with the physical pixels, causing mis-clicks. Furthermore, scrolling without pausing triggers velocity-based bot detection.
 * Technical Implementation:
   * Physics-Aware Scroll: Dispatch a swipe gesture via MotionEvent where the velocity decay matches a quadratic easing curve (v(t) = v_0(1 - t/T)^2), simulating human friction.
   * Viewport Settling Detection: After scroll completion, poll UiAutomation.getRootInActiveWindow() every 100ms. Compare the root hash; when the node bounds remain static across two consecutive polls, the viewport is locked.
   * Dwell Injection: Force a randomized pause (1.8s – 4.2s) before performing any extraction, simulating a human reading the post content.
Prototype SM-02: Spatial De-Duplication & Continuous Feed Stitcher
 * The Problem: As you scroll down, the top post from the previous screen might still be 40% visible at the top of the new screen. If your scraper treats every dump as new data, you will double-process posts.
 * Technical Implementation:
   * Generate a Structural Hash for every post card: Hash(Author_Text + Timestamp_Text + First_100_Chars_Content).
   * Maintain an in-memory ring buffer (size: 50) of recent hashes on the Edge Agent.
   * Filter out any post whose structural hash is present in the ring buffer, parsing only newly surfaced cards below the spatial offset.
Domain 2: Engagement & Interaction (The Spatial Resolver)
Prototype SM-03: Relative Sibling Bounding Engine (Targeting Reactions)
 * The Problem: A LinkedIn or Instagram screen often displays 2 to 3 posts simultaneously. There are three "Like" buttons, three "Comment" buttons, and three "Share" buttons on screen with identical descriptions.
 * Technical Implementation:
   * First, locate the Anchor Node (the post containing the specific author or target keyword). Let its bounds be Rect(left, top, right, bottom).
   * Define a Bounding Search Cone: Find all nodes where node.bounds.top >= anchor.bounds.bottom and node.bounds.bottom <= anchor.bounds.bottom + 400px.
   * Within this cone, resolve the interactive element matching content-desc="Like" or text="React". This guarantees you never interact with the post above or below.
┌──────────────────────────────────────────────────────────┐
│ [Post Author: "Tech Lead"]                               │
│ [Post Body: "Announcing our new distributed runtime..."] │ ◄── ANCHOR NODE
└──────────────────────────────────────────────────────────┘
                              │
                    Bounding Search Cone (Y + 400px)
                              ▼
┌──────────────────────────────────────────────────────────┐
│  [Like (Thumb)]        [Comment]        [Repost]         │ ◄── TARGET NODE
└──────────────────────────────────────────────────────────┘

Prototype SM-04: Long-Press Reaction Drawer Orchestrator
 * The Problem: On LinkedIn and Facebook, liking is basic; reacting with "Celebrate," "Insightful," or "Love" requires a continuous touch-and-drag gesture to an unmounted popup overlay.
 * Technical Implementation:
   * Step 1: Dispatch ACTION_DOWN on the Like button coordinates.
   * Step 2: Hold state for 600ms (the OS threshold for View.onLongClickListener).
   * Step 3: Dump the newly surfaced AccessibilityWindowInfo representing the floating reaction bar.
   * Step 4: Dispatch a chain of ACTION_MOVE events sliding the cursor to the "Insightful" icon's centerX, followed by ACTION_UP.
Domain 3: Media Publishing Pipelines (Reels & Carousels)
Prototype SM-05: Storage Sandboxing & MediaStore Registration
 * The Problem: Pushing video files via the filesystem doesn't notify Android's SQLite MediaStore. Instagram will not display the video in its picker.
 * Technical Implementation:
   * Save files strictly to /sdcard/DCIM/Automation/.
   * Execute MediaScannerConnection.scanFile() with MIME types explicitly declared (video/mp4, image/jpeg).
   * Block workflow execution until the scanner callback returns a valid content://media/external/images/media/{id} URI.
Prototype SM-06: Aspect Ratio & Canvas Adjustment Driver
 * The Problem: Instagram stories/reels require 9:16 aspect ratios. If an uploaded image doesn't fit, Instagram presents a pinch-to-zoom / crop handle that blocks the "Next" button.
 * Technical Implementation:
   * The Agent inspects the screen for the "Expand / Fit to Screen" icon (usually in the bottom-left of the media preview container).
   * If detected, it dispatches an instant tap to enforce the raw aspect ratio, bypassing the manual two-finger pinch gesture requirement.
Domain 4: Messaging & Text Injection (The Anti-Bot Vector)
Prototype SM-07: Humanized IME Input Streamer
 * The Problem: Using AccessibilityNodeInfo.ACTION_SET_TEXT sets the text instantly (0ms). Platforms detect this because zero keystroke timing events are dispatched to the app's internal text watchers.
 * Technical Implementation:
   * Tap the input field to open the input connection.
   * Iterate through the string character by character.
   * Inject each character via UiAutomation.injectInputEvent(KeyEvent) with variable inter-key latencies:
     * Base latency: 50ms – 120ms (Gaussian distribution).
     * Punctuation penalty: Add 200ms after commas, 400ms after periods.
     * Occasional typo engine: 2% chance to inject an adjacent QWERTY key, wait 150ms, inject KEYCODE_DEL, and inject the correct character.
Part 2: Where These Prototypes Fit in the Master Architecture
These prototypes are not disposable testing scripts. They are the fundamental building blocks of your distributed platform.
                              CONTROL PLANE
                   ┌──────────────────────────────────┐
                   │    Workflow State Machine (FSM)  │
                   │  "Post Reel" -> "Engage Leads"   │
                   └─────────────────┬────────────────┘
                                     │ JSON Instruction:
                                     │ {"action": "ENGAGE_REACTION", "type": "INSIGHTFUL"}
                                     ▼
                               EDGE AGENT
                   ┌──────────────────────────────────┐
                   │        Strategy Switchboard      │
                   └─────────────────┬────────────────┘
                                     │
           ┌─────────────────────────┼─────────────────────────┐
           ▼                         ▼                         ▼
   ┌───────────────┐         ┌───────────────┐         ┌───────────────┐
   │ Strategy SM-01│         │ Strategy SM-03│         │ Strategy SM-07│
   │ (Dwell/Scroll)│         │ (Cone Matcher)│         │ (IME Streamer)│
   └───────────────┘         └───────────────┘         └───────────────┘

Here is their exact structural placement in the production architecture:
1. In the Edge Agent: The "Strategy Pattern" Plugin Library (DEV-200)
Every prototype becomes a compiled Kotlin class implementing a universal ExecutionStrategy interface:
interface ExecutionStrategy {
    val capabilityName: String
    suspend fun execute(context: ExecutionContext, payload: JsonObject): StrategyResult
}

class RelativeReactionStrategy(private val uiAutomation: UiAutomation) : ExecutionStrategy {
    override val capabilityName = "SOCIAL_ENGAGE_REACTION"
    override suspend fun execute(context: ExecutionContext, payload: JsonObject): StrategyResult {
        // Code from Prototype SM-03 & SM-04 runs here locally on the phone
    }
}

 * When a new app update changes how Instagram comments work, you only update the CommentInjectionStrategy class in the Edge Agent. The rest of the operating system remains untouched.
2. In the Control Plane: Declarative Workflow Graphs (DEV-300)
The Control Plane stops thinking about "clicks" and coordinates. It composes high-level workflows out of these proven atomic capabilities:
{
  "workflow_id": "linkedin_lead_outreach",
  "steps": [
    { "strategy": "NAVIGATE_DEEP_LINK", "params": { "uri": "linkedin://in/target-profile" } },
    { "strategy": "VIEWPORT_DWELL_LOCK", "params": { "min_dwell_ms": 3000 } },
    { "strategy": "SPATIAL_SIBLING_ACTION", "params": { "anchor": "Experience", "action": "SCROLL_INTO_VIEW" } },
    { "strategy": "HUMANIZED_IME_INPUT", "params": { "target": "Message", "text": "Hi John..." } }
  ]
}

3. In the Capability Registry: Dynamic App Version Profiling (DEV-800)
Your APK Analyzer and Capability Registry use these prototypes to map out compatibility matrices:
 * APK Version 10.4.1 \rightarrow Supports DEEP_LINK_DIRECT + RELATIVE_REACTION_V1.
 * APK Version 11.0.0 (Jetpack Compose update) \rightarrow Requires RELATIVE_REACTION_V2 (Compose Semantics).
When the Control Plane matches a task to an Edge Node, it queries the node's installed APK version and automatically selects the correct prototype strategy.
4. In the CI/CD Pipeline: Automated Regression Test Suite (DEV-400)
Every time you compile a new version of the Edge Agent, a headless ReDroid container spins up in GitHub Actions. It opens an archived Instagram APK and executes Prototypes SM-01 through SM-07 sequentially.
 * If all 7 pass, the build is marked stable and deployed to your physical device fleet.