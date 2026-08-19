WhatsApp is a prime candidate for this architecture because it relies heavily on both standard Android components and explicit intent routing, making it highly predictable compared to SDUI apps like Instagram.
If you want to automate WhatsApp to perform specific actions—like sending messages to unsaved contacts, orchestrating bulk outreach, or parsing group chats—you must understand how WhatsApp handles deep linking and UI dispatch.
Here are the critical execution prototypes required for WhatsApp automation.
Domain 1: Intent Routing (The API Bypass)
The most efficient way to automate WhatsApp is to avoid the UI entirely for navigation. You use the Edge Agent to trigger Android Intents, which forces WhatsApp to open directly to the target conversation.
1. The Unsaved Contact Messenger (WA-01)
 * The Action: Opening a chat and sending a message to a phone number that is not saved in the device's contacts.
 * The UI Hurdle: Standard WhatsApp UI forces you to save a contact before messaging them.
 * The Solution: The Agent uses Shizuku to execute an ACTION_VIEW intent with WhatsApp's official deep link schema ([https://wa.me/](https://wa.me/) or whatsapp://send).
   # Executed via Shizuku on the Edge Agent
am start -W -a android.intent.action.VIEW -d "whatsapp://send?phone=919876543210&text=Hello+from+the+Edge" com.whatsapp

   This instantly opens the chat with the pre-filled text. The Agent then parses the UI and taps the "Send" button.
2. The Direct Media Injector (WA-02)
 * The Action: Sharing a specific photo or video directly to a contact or group.
 * The UI Hurdle: Navigating through WhatsApp's custom gallery picker is slow and error-prone.
 * The Solution: The Control Plane pushes the media file to the Agent's storage. The Agent constructs an ACTION_SEND intent with the EXTRA_STREAM pointing to the file's URI and sets the package explicitly to com.whatsapp. This launches WhatsApp's contact picker overlay, skipping the gallery completely.
Domain 2: UI Automation (The Semantic Execution)
Once you are inside the WhatsApp application, you rely on the Semantic UI Parser to execute tasks.
3. The Group Message Scraper (WA-03)
 * The Action: Reading the last 50 messages in a busy WhatsApp group.
 * The UI Hurdle: Chat bubbles are dynamically sized, and sender names are only attached to the first message in a block.
 * The Solution: The Agent parses the RecyclerView containing the chat. It uses sibling bounding math: it finds a text node, then looks for a sibling node containing the timestamp (e.g., 10:45 AM), and maps them to a single JSON object. It scrolls up, captures the new nodes, and de-duplicates them based on text+timestamp hashes.
4. The Voice Note Automator (WA-04)
 * The Action: Recording and sending a voice note.
 * The UI Hurdle: Voice notes require a sustained MotionEvent (press and hold).
 * The Solution: The Agent locates the microphone button icon. It injects a MotionEvent.ACTION_DOWN, pauses for the required duration of the audio clip (e.g., 5000ms), and then injects a MotionEvent.ACTION_UP to release and send. Alternatively, it can inject a swipe-up gesture to lock the recording, followed by a tap on the send button.
5. The Status (Story) Viewer & Extractor (WA-05)
 * The Action: Automatically viewing a contact's WhatsApp Status updates.
 * The UI Hurdle: Statuses are temporary, full-screen overlays that auto-advance.
 * The Solution: The Agent navigates to the "Updates" tab and taps the target contact's ring. To prevent the status from auto-advancing before the UI is parsed or the screen is captured, the Agent injects a long-press MotionEvent in the center of the screen to pause the timer, extracts the necessary data, and releases the touch.
Domain 3: Bulk Execution & Fleet Management
When orchestrating bulk messaging (e.g., B2B outreach or customer support routing), you must manage the state of the app to avoid triggering WhatsApp's aggressive spam detection.
6. The Contact Sync Forcer (WA-06)
 * The Action: Ensuring newly added contacts appear in WhatsApp immediately.
 * The UI Hurdle: Android's Contacts Provider syncs asynchronously; WhatsApp doesn't always see a new contact immediately.
 * The Solution: After the Agent uses the ContactsContract API to silently add a number to the phone book, it commands WhatsApp to refresh its internal database. It opens the "New Chat" screen, taps the three-dot menu, and clicks "Refresh." It waits until the progress spinner disappears before continuing the workflow.
7. The "Banned Number" Recovery Loop (WA-07)
 * The Action: Detecting when WhatsApp has banned the active phone number and notifying the Control Plane.
 * The UI Hurdle: A banned number disrupts the execution queue and leaves the app on a persistent error screen.
 * The Solution: The State Machine is designed to detect the specific "This account is not allowed to use WhatsApp" text node. If detected, the Agent aborts the current workflow, flags the pod_id (or device) as quarantined in the Control Plane, and executes a pm clear com.whatsapp command to prepare the environment for a new number registration.