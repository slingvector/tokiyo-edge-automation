Moving from a theoretical framework to actual app-level automation means conquering the wildly different ways companies build user interfaces.
A shopping app uses deeply nested RecyclerView lists, dating apps rely on custom OnTouchListener gesture cards, and social media apps use bottom-sheet fragments for comments. You cannot use a "one size fits all" script.
Based on how modern Android UI architectures (like Jetpack Compose and custom ViewGroups) handle accessibility and touch dispatch, here are 15 specialized App-Level Prototypes you must build to orchestrate a human-like digital workforce.
Group 1: Dating Apps (The Gesture Economy)
Dating apps (Tinder, Bumble, Hinge) rarely use standard Android buttons for core interactions. They use custom 2D canvas cards that listen for physical drag physics.
1. The Bezier-Curve Swipe Injector
 * The Action: Swiping right on a profile.
 * The UI Hurdle: If you inject a straight-line MotionEvent from the center of the screen to the right edge in exactly 10ms, the app’s physics engine will flag it as a bot.
 * The Solution: The Control Plane calculates a curved Bezier path. The Edge Agent injects a series of 20 MotionEvent.ACTION_MOVE events over 300ms, mimicking the natural arc and acceleration/deceleration of a human thumb.
2. The Nested-Bio Extractor
 * The Action: Reading a long profile bio.
 * The UI Hurdle: The text is cut off inside a ScrollView.
 * The Solution: Instead of simulating a physical swipe, the Agent finds the bio's AccessibilityNodeInfo and triggers ACTION_SCROLL_FORWARD. This forces the OS to natively scroll the view down so the parser can read the hidden text.
3. The Match Intercept & Icebreaker
 * The Action: Detecting a match and sending the first message.
 * The UI Hurdle: Match screens are sudden overlays that interrupt the swipe workflow.
 * The Solution: The State Machine in the Control Plane looks for a specific semantic trigger (e.g., a node with text "You matched!"). It halts the swipe queue, taps the text input node, uses ACTION_SET_TEXT to inject the icebreaker, and taps "Send."
Group 2: Social Media (The Infinite Scroll)
Apps like LinkedIn, Instagram, and X are built on RecyclerView architectures. Content is dynamically loaded and destroyed from RAM as it moves on and off the screen.
4. The Pagination Driver
 * The Action: Scrolling a social feed.
 * The UI Hurdle: Content only exists in the UI tree if it is physically visible on the glass.
 * The Solution: The Agent performs a short vertical swipe, waits 500ms for network images to load and the UI tree to settle, and then dumps the tree. The Control Plane stitches these sequential snapshots together to build a continuous understanding of the feed.
5. The Dynamic "Like" Engine
 * The Action: Liking a post on LinkedIn/Instagram.
 * The UI Hurdle: The screen might contain three different posts at once, meaning there are three "Like" buttons.
 * The Solution: Structural Semantic Parsing. The Agent finds the target post text, then searches for the nearest sibling node with content-desc="Like" that falls below the text's bounding box, ensuring it likes the correct post.
6. The Keyboard-Bypass Commenter
 * The Action: Leaving a comment on a Reel or Post.
 * The UI Hurdle: Tapping a comment box brings up the Android virtual keyboard (IME), which covers 50% of the screen and ruins UI coordinate math.
 * The Solution: The Agent bypasses physical typing entirely. It finds the EditText node and uses Android's native AccessibilityNodeInfo.ACTION_SET_TEXT to instantly inject the string without triggering the virtual keyboard.
7. The "Story" Progress Tracker
 * The Action: Watching an Instagram Story.
 * The UI Hurdle: Stories auto-advance.
 * The Solution: The parser looks for the horizontal progress bar bounds at the top of the screen. If the Control Plane wants to skip, the Agent injects a tap on the right 20% of the screen bounds.
8. The Media Gallery Navigator
 * The Action: Selecting an injected photo for a new post.
 * The UI Hurdle: The custom in-app gallery grids are incredibly dense.
 * The Solution: The Agent taps the "Dropdown" to switch the album from "Recents" to your isolated "MCR_Relay" folder, and taps the top-left coordinate of the grid (index 0).
Group 3: Shopping & Commerce (The Extraction Game)
Amazon, Flipkart, and Zepto are essentially massive, nested data tables optimized for mobile.
9. The Search Bar Orchestrator
 * The Action: Searching for a specific product.
 * The UI Hurdle: The "Search" action is often tied to the "Enter" key on the virtual keyboard, not an on-screen button.
 * The Solution: After injecting the text, the Agent uses InputManager to inject KEYCODE_ENTER or KEYCODE_SEARCH to trigger the app's internal search listener.
10. The Price Threshold Extractor
 * The Action: Finding the best deal.
 * The UI Hurdle: Prices are often split across multiple TextView nodes (e.g., one node for "$", one for "19", one for "99").
 * The Solution: The Agent groups adjacent text nodes on the same Y-axis plane, concatenates them into a single string ($19.99), parses it into a float, and reports it back to the Control Plane for logic evaluation.
11. The Filter Sheet Manipulator
 * The Action: Applying "Prime" or "Next Day Delivery" filters.
 * The UI Hurdle: Filters are usually inside BottomSheet dialogs that slide over the main UI.
 * The Solution: The parser recognizes the Z-index (depth) of the nodes. It ignores the grayed-out background nodes and searches exclusively within the active BottomSheet container to toggle checkboxes.
12. The "Add to Cart" Verifier
 * The Action: Buying the item.
 * The UI Hurdle: How do you know the item actually went into the cart?
 * The Solution: A strict State Machine loop. Tap "Add to Cart" -> Wait -> Parse the top-right cart icon node -> Verify the text badge changed from 0 to 1.
Group 4: System Overlays (The Cross-App Environment)
No app exists in a vacuum. The operating system will frequently interrupt your automation.
13. The Permission Auto-Granter
 * The Action: Accepting Android's "Allow Camera" or "Allow Location" prompts.
 * The UI Hurdle: These are system dialogs owned by com.android.packageinstaller, not the target app.
 * The Solution: Because Shizuku operates at the system level, the Agent's UI parser can read System UI dialogs just as easily as App UI. It detects the android:id/button1 resource and taps "While using the app."
14. The Interstitial Ad Assassin
 * The Action: Closing random popups (e.g., "Rate this app!").
 * The UI Hurdle: They appear randomly and block the execution queue.
 * The Solution: Every time a semantic search fails (e.g., "Cannot find 'Follow'"), the Edge Agent triggers a "Popup Rescue" heuristic. It searches the screen for standard dismiss anchors: content-desc="Close", an X icon, or text="Not Now". If found, it kills the popup and retries the original action.
15. The SSO (Single Sign-On) Driver
 * The Action: Logging into an app via "Continue with Google."
 * The UI Hurdle: This invokes Google Play Services, launching a bottom sheet outside the app's domain.
 * The Solution: The Control Plane commands the Agent to tap the SSO button. The Agent then parses the com.google.android.gms UI tree, finds the node matching your assigned burner email address, and taps it to seamlessly authenticate.