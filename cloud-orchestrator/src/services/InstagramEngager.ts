import { IDeviceController } from '../utils/IDeviceController';
import { LocalAdbController } from '../utils/LocalAdbController';
import * as fs from 'fs';

const IG_PACKAGE = 'com.instagram.android';

// ─── Stealth Config ────────────────────────────────────────────────────────────
// Random delay range between major actions (ms). Mimics human reading/thinking.
const STEALTH_DELAY_MIN_MS = 30_000; // 30 seconds
const STEALTH_DELAY_MAX_MS = 90_000; // 90 seconds

// Render wait after deep-link navigation (ms)
const RENDER_WAIT_MS = 8_000;

// Post-action micro-pause (ms) — short breathing room between taps
const MICRO_PAUSE_MIN_MS = 1_200;
const MICRO_PAUSE_MAX_MS = 3_500;

/**
 * Instagram Engagement FSM — v2.0
 *
 * MVP scope: Like + Comment on Posts.
 *
 * Stealth features:
 *  - Random 30-90s delays between actions (mimics human reading pace)
 *  - Dual comment input: tries `input text` first, falls back to clipboard paste
 *  - Device fingerprint variation: slight randomisation of tap coordinates
 *  - Resource-id + content-desc based element discovery (not fixed coords)
 *  - Scroll-to-find logic for scroll-dependent Instagram feed layout
 *
 * Why fingerprint rotation matters:
 *  Instagram's anti-automation stack (BAAS) analyses: tap cadence, scroll velocity,
 *  inter-action timing, and touch coordinate patterns across sessions. Devices that
 *  always tap the exact center of a button at the exact same interval get flagged.
 *  Random delay jitter + coordinate micro-variation breaks this fingerprint.
 */
export class InstagramEngager {
    private device: IDeviceController;
    private deviceId: string;

    constructor(deviceId: string, controller?: IDeviceController) {
        this.deviceId = deviceId;
        this.device = controller || new LocalAdbController(deviceId);
    }

    // ─── Utilities ─────────────────────────────────────────────────────────────

    private parseBounds(boundsString: string): { x: number, y: number, width: number, height: number } | null {
        const match = boundsString.match(/\[(\d+),(\d+)\]\[(\d+),(\d+)\]/);
        if (match) {
            const x1 = parseInt(match[1]!);
            const y1 = parseInt(match[2]!);
            const x2 = parseInt(match[3]!);
            const y2 = parseInt(match[4]!);
            return {
                x: Math.floor((x1 + x2) / 2),
                y: Math.floor((y1 + y2) / 2),
                width: x2 - x1,
                height: y2 - y1
            };
        }
        return null;
    }

    /**
     * Returns a random integer between min and max (inclusive).
     */
    private randInt(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    /**
     * Human-like random delay between major actions (30-90s).
     * This is the core stealth mechanism — breaks fixed-interval fingerprinting.
     */
    private async stealthDelay(label: string): Promise<void> {
        const ms = this.randInt(STEALTH_DELAY_MIN_MS, STEALTH_DELAY_MAX_MS);
        console.log(`[${this.deviceId}] [STEALTH] Waiting ${Math.round(ms / 1000)}s before ${label}...`);
        await this.device.sleep(ms);
    }

    /**
     * Short micro-pause between UI interactions (1.2-3.5s).
     * Mimics the human pause between tapping different elements.
     */
    private async microPause(): Promise<void> {
        await this.device.sleep(this.randInt(MICRO_PAUSE_MIN_MS, MICRO_PAUSE_MAX_MS));
    }

    /**
     * Tap with micro-jitter: adds ±4px random offset to the tap coordinate.
     * Humans never tap the exact pixel center — this variation breaks tap-pattern fingerprinting.
     */
    private async tapWithJitter(x: number, y: number): Promise<void> {
        const jitterX = x + this.randInt(-4, 4);
        const jitterY = y + this.randInt(-4, 4);
        await this.device.tapCoordinate(jitterX, jitterY);
    }

    private ensureLogsDir(): void {
        if (!fs.existsSync('./logs')) fs.mkdirSync('./logs', { recursive: true });
    }

    // ─── Element Discovery ──────────────────────────────────────────────────────

    private findByResourceId(xmlData: string, resourceId: string): { x: number, y: number } | null {
        const escapedId = resourceId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`resource-id="${escapedId}"[^>]*bounds="(\\[\\d+,\\d+\\]\\[\\d+,\\d+\\])"`, 'i');
        const match = xmlData.match(regex);
        if (match) {
            const bounds = this.parseBounds(match[1]!);
            return bounds ? { x: bounds.x, y: bounds.y } : null;
        }
        return null;
    }

    private findByContentDesc(xmlData: string, descPattern: string): { x: number, y: number } | null {
        const escaped = descPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`content-desc="${escaped}"[^>]*bounds="(\\[\\d+,\\d+\\]\\[\\d+,\\d+\\])"`, 'i');
        const match = xmlData.match(regex);
        if (match) {
            const bounds = this.parseBounds(match[1]!);
            return bounds ? { x: bounds.x, y: bounds.y } : null;
        }
        return null;
    }

    private async getSafeUiDumpXml(): Promise<string> {
        let xmlData = await this.device.getUiDumpXml();
        if (!xmlData || xmlData.trim() === '') {
            console.log(`[${this.deviceId}] [IG-FSM] UI dump failed (video playing?). Toggling app state...`);
            
            // Go to home screen to force the video player to pause/release
            await this.device.sleep(500);
            await this.executeAdb(`shell input keyevent 3`); // HOME
            await this.device.sleep(1500);
            
            // Resume Instagram
            await this.executeAdb(`shell am start -n com.instagram.android/com.instagram.mainactivity.InstagramMainActivity`);
            await this.device.sleep(2000);
            
            xmlData = await this.device.getUiDumpXml();
        }
        return xmlData;
    }

    private async executeAdb(command: string): Promise<string> {
        return await (this.device as any).executeAdb(command); // Access underlying adb for hacks
    }

    /**
     * Find the Like button, scrolling if necessary.
     * Returns whether the post is already liked.
     */
    private async findLikeButton(maxScrolls = 4, isReel = false): Promise<{ x: number, y: number, alreadyLiked: boolean } | null> {
        for (let i = 0; i <= maxScrolls; i++) {
            let xmlData = await this.getSafeUiDumpXml();

            // Already liked: content-desc will say "Unlike"
            const unlike = this.findByContentDesc(xmlData, 'Unlike');
            if (unlike) return { ...unlike, alreadyLiked: true };

            // Primary: resource-id (feed post or reel)
            const byIdFeed = this.findByResourceId(xmlData, 'com.instagram.android:id/row_feed_button_like');
            if (byIdFeed) return { ...byIdFeed, alreadyLiked: false };

            const byIdReel = this.findByResourceId(xmlData, 'com.instagram.android:id/like_button');
            const byDesc = this.findByContentDesc(xmlData, 'Like');
            
            const likeBtn = byIdFeed || byIdReel || byDesc;
            if (likeBtn) return { ...likeBtn, alreadyLiked: false };

            if (!isReel && i < maxScrolls) {
                console.log(`[${this.deviceId}] [IG-FSM] Scrolling to find Like button (attempt ${i + 1})...`);
                await this.device.swipe(160, 400, 160, 200, this.randInt(400, 700));
                await this.device.sleep(this.randInt(1500, 2500));
            } else if (isReel && i === 0) {
                // If it's a reel, do not swipe. The button is usually there, maybe dump was partial. We can try 1 more dump.
                await this.device.sleep(2000);
            } else if (isReel) {
                break; // Give up, no swipe on reels
            }
        }
        return null;
    }

    /**
     * Find the Comment button.
     */
    private findCommentButton(xmlData: string): { x: number, y: number } | null {
        let byId = this.findByResourceId(xmlData, 'com.instagram.android:id/row_feed_button_comment');
        if (byId) return byId;
        
        byId = this.findByResourceId(xmlData, 'com.instagram.android:id/comment_button');
        if (byId) return byId;

        return this.findByContentDesc(xmlData, 'Comment');
    }

    // ─── Comment Input — Dual Method ───────────────────────────────────────────

    /**
     * Method A: `input text` via shell.
     * Fast, works well for ASCII. Can drop special chars/emojis on some devices.
     */
    private async typeViaInputText(text: string): Promise<void> {
        const encoded = text.replace(/"/g, '\\"').replace(/ /g, '%s');
        await this.device.executeCommand(`input text "${encoded}"`);
    }

    /**
     * Method B: Clipboard paste via `am broadcast`.
     * More reliable for unicode/emojis. Slower due to clipboard round-trip.
     * Uses the CLIPPER broadcast which sets clipboard content from shell.
     */
    private async typeViaClipboard(text: string): Promise<void> {
        // Encode text for shell
        const escaped = text.replace(/'/g, "'\\''");
        // Set clipboard using content provider (works on API 28+)
        await this.device.executeCommand(
            `am broadcast -a clipper.set -e text '${escaped}'`
        );
        await this.device.sleep(500);
        // Select all + paste
        await this.device.executeCommand('input keyevent KEYCODE_CTRL_A');
        await this.device.sleep(300);
        await this.device.executeCommand('input keyevent KEYCODE_PASTE');
    }

    /**
     * Smart text input: tries Method A first, verifies text appeared in UI,
     * falls back to Method B (clipboard) if the field is still empty.
     */
    private async smartInputText(text: string, inputX: number, inputY: number): Promise<boolean> {
        // Ensure field is focused
        await this.tapWithJitter(inputX, inputY);
        await this.device.sleep(1000);

        console.log(`[${this.deviceId}] [INPUT] Trying Method A (input text)...`);
        await this.typeViaInputText(text);
        await this.device.sleep(1500);

        // Verify: check if EditText has non-empty text
        const xmlAfterA = await this.getSafeUiDumpXml();
        const snippet = text.substring(0, Math.min(10, text.length));
        if (xmlAfterA.includes(snippet)) {
            console.log(`[${this.deviceId}] [INPUT] Method A succeeded.`);
            return true;
        }

        // Fallback: Method B (clipboard)
        console.log(`[${this.deviceId}] [INPUT] Method A failed, falling back to clipboard paste...`);
        // Clear field first
        await this.device.executeCommand('input keyevent KEYCODE_CTRL_A');
        await this.device.sleep(300);
        await this.device.executeCommand('input keyevent KEYCODE_DEL');
        await this.device.sleep(300);

        await this.tapWithJitter(inputX, inputY);
        await this.device.sleep(800);
        await this.typeViaClipboard(text);
        await this.device.sleep(1500);

        const xmlAfterB = await this.getSafeUiDumpXml();
        if (xmlAfterB.includes(snippet)) {
            console.log(`[${this.deviceId}] [INPUT] Method B (clipboard) succeeded.`);
            return true;
        }

        console.error(`[${this.deviceId}] [INPUT] Both input methods failed!`);
        return false;
    }

    // ─── FSM: Clean State ───────────────────────────────────────────────────────

    private async establishCleanState(postUrl: string): Promise<void> {
        console.log(`[${this.deviceId}] [IG-FSM] Verifying device state...`);
        await this.device.verifyDeviceState();

        console.log(`[${this.deviceId}] [IG-FSM] Force stopping Instagram...`);
        await this.device.forceStopApp(IG_PACKAGE);
        await this.device.sleep(this.randInt(1500, 3000));

        console.log(`[${this.deviceId}] [IG-FSM] Navigating: ${postUrl}`);
        await this.device.openDeepLink(postUrl, IG_PACKAGE);

        console.log(`[${this.deviceId}] [IG-FSM] Waiting ${RENDER_WAIT_MS / 1000}s for render...`);
        await this.device.sleep(RENDER_WAIT_MS);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FSM: LIKE A POST
    // ═══════════════════════════════════════════════════════════════════════════

    public async likePost(postUrl: string): Promise<boolean> {
        console.log(`\n=== [IG-FSM: LIKE] Starting on ${this.deviceId} ===`);

        await this.establishCleanState(postUrl);

        const likeResult = await this.findLikeButton();
        if (!likeResult) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_like_fail.xml`, await this.getSafeUiDumpXml());
            throw new Error(`[${this.deviceId}] [IG-FSM: LIKE] Like button not found. UI dump saved.`);
        }

        if (likeResult.alreadyLiked) {
            console.log(`[${this.deviceId}] [IG-FSM: LIKE] Already liked. Skipping.`);
            return true;
        }

        console.log(`[${this.deviceId}] [IG-FSM: LIKE] Tapping Like at ${likeResult.x}, ${likeResult.y}`);
        await this.tapWithJitter(likeResult.x, likeResult.y);
        await this.microPause();

        // Verify: content-desc should flip to "Unlike"
        const verifyXml = await this.getSafeUiDumpXml();
        const confirmed = !!this.findByContentDesc(verifyXml, 'Unlike');
        if (confirmed) {
            console.log(`✅ [${this.deviceId}] [IG-FSM: LIKE] Verified — post is now liked!`);
        } else {
            console.warn(`⚠️ [${this.deviceId}] [IG-FSM: LIKE] Like tap sent but Unlike not confirmed yet.`);
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FSM: COMMENT ON A POST
    // ═══════════════════════════════════════════════════════════════════════════

    public async commentOnPost(postUrl: string, commentText: string): Promise<boolean> {
        console.log(`\n=== [IG-FSM: COMMENT] Starting on ${this.deviceId} ===`);

        await this.establishCleanState(postUrl);

        // Find & tap Comment button (scroll if needed)
        let xmlData = await this.getSafeUiDumpXml();
        let commentBtn = this.findCommentButton(xmlData);

        if (!commentBtn && !isReel) {
            console.log(`[${this.deviceId}] [IG-FSM: COMMENT] Scrolling to find Comment button...`);
            await this.device.swipe(160, 400, 160, 200, this.randInt(400, 700));
            await this.device.sleep(this.randInt(1500, 2500));
            xmlData = await this.getSafeUiDumpXml();
            commentBtn = this.findCommentButton(xmlData);
        }

        if (!commentBtn) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_comment_btn_fail.xml`, xmlData);
            throw new Error(`[${this.deviceId}] [IG-FSM: COMMENT] Comment button not found.`);
        }

        console.log(`[${this.deviceId}] [IG-FSM: COMMENT] Tapping Comment button at ${commentBtn.x}, ${commentBtn.y}`);
        await this.tapWithJitter(commentBtn.x, commentBtn.y);
        await this.device.sleep(this.randInt(3500, 5000)); // wait for comment sheet

        // Find comment input
        const sheetXml = await this.getSafeUiDumpXml();
        const inputCoords = this.findCommentInput(sheetXml);

        if (!inputCoords) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_comment_input_fail.xml`, sheetXml);
            throw new Error(`[${this.deviceId}] [IG-FSM: COMMENT] Comment input field not found.`);
        }

        // Smart dual-method text input
        const typed = await this.smartInputText(commentText, inputCoords.x, inputCoords.y);
        if (!typed) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_comment_type_fail.xml`, await this.getSafeUiDumpXml());
            throw new Error(`[${this.deviceId}] [IG-FSM: COMMENT] Failed to type comment via both methods.`);
        }

        await this.microPause();

        // Submit
        await this.submitComment();

        // Verify
        await this.device.sleep(this.randInt(2500, 4000));
        const verifyXml = await this.getSafeUiDumpXml();
        const snippet = commentText.substring(0, Math.min(20, commentText.length));

        if (verifyXml.includes(snippet)) {
            console.log(`✅ [${this.deviceId}] [IG-FSM: COMMENT] Comment text found in UI — verified!`);
        } else {
            // Check if input was cleared (comment submitted and cleared)
            const emptyInput = /class="android\.widget\.EditText"[^>]*text=""/.test(verifyXml);
            if (emptyInput) {
                console.log(`✅ [${this.deviceId}] [IG-FSM: COMMENT] Input cleared — comment likely posted.`);
            } else {
                console.warn(`⚠️ [${this.deviceId}] [IG-FSM: COMMENT] Verification inconclusive.`);
            }
        }

        return true;
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FSM: ENGAGE POST (LIKE + COMMENT) — MVP primary action
    // ═══════════════════════════════════════════════════════════════════════════

    public async engagePost(postUrl: string, commentText: string): Promise<boolean> {
        console.log(`\n=== [IG-FSM: ENGAGE POST] Starting on ${this.deviceId} ===`);

        await this.establishCleanState(postUrl);

        // ── LIKE PHASE ──────────────────────────────────────────────────────
        const likeResult = await this.findLikeButton();
        if (likeResult && !likeResult.alreadyLiked) {
            console.log(`[${this.deviceId}] [IG-FSM: ENGAGE] Tapping Like at ${likeResult.x}, ${likeResult.y}`);
            await this.tapWithJitter(likeResult.x, likeResult.y);
            console.log(`✅ [${this.deviceId}] [IG-FSM: ENGAGE] Post Liked!`);
            await this.microPause();
        } else if (likeResult?.alreadyLiked) {
            console.log(`[${this.deviceId}] [IG-FSM: ENGAGE] Already liked, skipping.`);
        } else {
            console.warn(`[${this.deviceId}] [IG-FSM: ENGAGE] Like button not found, continuing to comment.`);
        }

        // ── STEALTH DELAY between Like and Comment ───────────────────────────
        await this.stealthDelay('comment action');

        // ── COMMENT PHASE ────────────────────────────────────────────────────
        // Get fresh UI dump after like + delay
        let xmlData = await this.getSafeUiDumpXml();
        let commentBtn = this.findCommentButton(xmlData);

        if (!commentBtn && !isReel) {
            console.log(`[${this.deviceId}] [IG-FSM: ENGAGE] Scrolling to find Comment button...`);
            await this.device.swipe(160, 400, 160, 200, this.randInt(400, 700));
            await this.device.sleep(this.randInt(1500, 2500));
            xmlData = await this.getSafeUiDumpXml();
            commentBtn = this.findCommentButton(xmlData);
        }

        if (!commentBtn) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_engage_comment_fail.xml`, xmlData);
            throw new Error(`[${this.deviceId}] [IG-FSM: ENGAGE] Comment button not found.`);
        }

        console.log(`[${this.deviceId}] [IG-FSM: ENGAGE] Tapping Comment at ${commentBtn.x}, ${commentBtn.y}`);
        await this.tapWithJitter(commentBtn.x, commentBtn.y);
        await this.device.sleep(this.randInt(3500, 5500));

        // Find comment input
        const sheetXml = await this.getSafeUiDumpXml();
        const inputCoords = this.findCommentInput(sheetXml);

        if (!inputCoords) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_engage_input_fail.xml`, sheetXml);
            throw new Error(`[${this.deviceId}] [IG-FSM: ENGAGE] Comment input field not found.`);
        }

        // Smart dual-method typing
        const typed = await this.smartInputText(commentText, inputCoords.x, inputCoords.y);
        if (!typed) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_engage_type_fail.xml`, await this.getSafeUiDumpXml());
            throw new Error(`[${this.deviceId}] [IG-FSM: ENGAGE] Failed to type comment via both methods.`);
        }

        await this.microPause();

        // Submit
        await this.submitComment();

        // Verify
        await this.device.sleep(this.randInt(2500, 4000));
        const verifyXml = await this.getSafeUiDumpXml();
        const snippet = commentText.substring(0, Math.min(20, commentText.length));

        if (verifyXml.includes(snippet)) {
            console.log(`✅ [${this.deviceId}] [IG-FSM: ENGAGE] Comment text verified in UI!`);
        } else {
            const emptyInput = /class="android\.widget\.EditText"[^>]*text=""/.test(verifyXml);
            if (emptyInput) {
                console.log(`✅ [${this.deviceId}] [IG-FSM: ENGAGE] Input cleared — comment posted.`);
            } else {
                console.warn(`⚠️ [${this.deviceId}] [IG-FSM: ENGAGE] Verification inconclusive.`);
            }
        }

        await this.device.sleep(2000);
        return true;
    }

    // ─── Private Helpers ────────────────────────────────────────────────────────

    private findCommentInput(xmlData: string): { x: number, y: number } | null {
        // Primary: EditText or AutoCompleteTextView element
        const editTextRegex = /class="android\.widget\.(EditText|AutoCompleteTextView)"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/;
        let match = xmlData.match(editTextRegex);
        if (match) {
            const bounds = this.parseBounds(match[2]!); // group 2 is the bounds now
            return bounds ? { x: bounds.x, y: bounds.y } : null;
        }

        // Fallback A: "Add a comment…", "Add comment…", or "Join the conversation…" placeholder text
        const placeholderRegex = /text="(Add a comment|Add comment|Join the conversation)[^"]*"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
        match = xmlData.match(placeholderRegex);
        if (match) {
            const bounds = this.parseBounds(match[2]!);
            return bounds ? { x: bounds.x, y: bounds.y } : null;
        }

        // Fallback B: any comment hint
        const hintRegex = /(?:hint|text)="(?:Add a comment|Add comment|Write a comment|Comment|Join the conversation)[^"]*"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
        match = xmlData.match(hintRegex);
        if (match) {
            const bounds = this.parseBounds(match[1]!);
            return bounds ? { x: bounds.x, y: bounds.y } : null;
        }

        return null;
    }

    private async submitComment(): Promise<void> {
        const submitXml = await this.getSafeUiDumpXml();

        // Find "Post" button (Instagram's submit label)
        const postBtnRegex = /(?:text|content-desc)="Post"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/ig;
        const allMatches = [...submitXml.matchAll(postBtnRegex)];

        let postBounds = null;
        for (const m of allMatches) {
            const bounds = this.parseBounds(m[1]!);
            // The submit Post button lives in the lower portion of screen, above nav bar
            if (bounds && bounds.y > 300) {
                postBounds = bounds;
            }
        }

        if (postBounds) {
            console.log(`[${this.deviceId}] [IG-FSM] Tapping Post button at ${postBounds.x}, ${postBounds.y}`);
            await this.tapWithJitter(postBounds.x, postBounds.y);
        } else {
            // Fallback: Enter key
            console.warn(`[${this.deviceId}] [IG-FSM] Post button not found, using Enter key fallback.`);
            await this.device.pressEnter();
        }
    }
}
