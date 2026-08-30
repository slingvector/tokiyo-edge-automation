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
    private currentPostUrl: string | null = null;
    private screenSize: { width: number, height: number } | null = null;

    constructor(deviceId: string, controller?: IDeviceController) {
        this.deviceId = deviceId;
        this.device = controller || new LocalAdbController(deviceId);
    }

    private async getScreenSize() {
        if (!this.screenSize) {
            this.screenSize = await this.device.getScreenSize();
        }
        return this.screenSize;
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
        if (!xmlData || xmlData.trim() === '' || xmlData.includes('ERROR: could not get idle state') || xmlData.includes('Failed to pull dump') || xmlData.length < 500) {
            console.warn(`[${this.deviceId}] [IG-FSM] UI dump failed (video playing?). Toggling app state...`);
            
            await this.device.executeCommand(`input keyevent 3`); // HOME
            await this.device.sleep(1500);
            
            if (this.currentPostUrl) {
                await this.device.openDeepLink(this.currentPostUrl, IG_PACKAGE);
                if (this.currentPostUrl.includes('/reel/')) {
                    await this.device.sleep(2000); // Wait for render
                    console.log(`[${this.deviceId}] [IG-FSM] Tapping screen to pause resumed reel video...`);
                    const size = await this.getScreenSize();
                    await this.device.tapCoordinate(Math.floor(size.width / 2), Math.floor(size.height / 2));
                }
            } else {
                await this.device.executeCommand(`am start -n ${IG_PACKAGE}/com.instagram.mainactivity.InstagramMainActivity`);
            }
            await this.device.sleep(2000);
            
            xmlData = await this.device.getUiDumpXml();
        }
        return xmlData;
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
                const size = await this.getScreenSize();
                await this.device.swipe(Math.floor(size.width / 2), Math.floor(size.height * 0.6), Math.floor(size.width / 2), Math.floor(size.height * 0.3), this.randInt(400, 700));
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
     * Find the Save button.
     */
    private async findSaveButton(maxScrolls = 4, isReel = false): Promise<{ x: number, y: number, alreadySaved: boolean } | null> {
        for (let i = 0; i <= maxScrolls; i++) {
            let xmlData = await this.getSafeUiDumpXml();

            const removeSaved = this.findByContentDesc(xmlData, 'Remove from Saved') || this.findByContentDesc(xmlData, 'Saved');
            if (removeSaved) return { ...removeSaved, alreadySaved: true };

            const byIdFeed = this.findByResourceId(xmlData, 'com.instagram.android:id/row_feed_button_save');
            const byDesc = this.findByContentDesc(xmlData, 'Save');
            
            const saveBtn = byIdFeed || byDesc;
            if (saveBtn) return { ...saveBtn, alreadySaved: false };

            if (!isReel && i < maxScrolls) {
                console.log(`[${this.deviceId}] [IG-FSM] Scrolling to find Save button (attempt ${i + 1})...`);
                const size = await this.getScreenSize();
                await this.device.swipe(Math.floor(size.width / 2), Math.floor(size.height * 0.6), Math.floor(size.width / 2), Math.floor(size.height * 0.3), this.randInt(400, 700));
                await this.device.sleep(this.randInt(1500, 2500));
            } else if (isReel && i === 0) {
                await this.device.sleep(2000);
            } else if (isReel) {
                break;
            }
        }
        return null;
    }

    /**
     * Find the Follow button.
     */
    private async findFollowButton(maxScrolls = 4, isReel = false): Promise<{ x: number, y: number, alreadyFollowing: boolean } | null> {
        for (let i = 0; i <= maxScrolls; i++) {
            let xmlData = await this.getSafeUiDumpXml();

            const following = this.findByContentDesc(xmlData, 'Following');
            if (following) return { ...following, alreadyFollowing: true };

            const byIdFeed = this.findByResourceId(xmlData, 'com.instagram.android:id/inline_follow_button');
            
            let followBtn = byIdFeed;
            if (!followBtn) {
                const match = xmlData.match(/content-desc="([^"]*Follow[^"]*)"/i);
                if (match) {
                     followBtn = this.findByContentDesc(xmlData, match[1]);
                }
            }

            if (followBtn) return { ...followBtn, alreadyFollowing: false };

            if (!isReel && i < maxScrolls) {
                console.log(`[${this.deviceId}] [IG-FSM] Scrolling to find Follow button (attempt ${i + 1})...`);
                const size = await this.getScreenSize();
                await this.device.swipe(Math.floor(size.width / 2), Math.floor(size.height * 0.6), Math.floor(size.width / 2), Math.floor(size.height * 0.3), this.randInt(400, 700));
                await this.device.sleep(this.randInt(1500, 2500));
            } else if (isReel && i === 0) {
                await this.device.sleep(2000);
            } else if (isReel) {
                break;
            }
        }
        return null;
    }

    // ─── Comment Strategy Pattern ──────────────────────────────────────────────

    /**
     * Find the Comment Target using multiple strategies.
     * Strategy 1: Fast Scan
     * Strategy 2: Deep Scroll
     * Strategy 3: Zero-Hop Reset
     */
    private async findCommentTargetWithStrategies(postUrl: string, isReel: boolean): Promise<{ x: number, y: number, isDirectInput: boolean } | null> {
        let target = await this.strategy1FastScan();
        if (target) return target;

        if (!isReel) {
            target = await this.strategy2DeepScroll();
            if (target) return target;

            target = await this.strategy3ZeroHopReset(postUrl);
            if (target) return target;
        } else {
            console.log(`[${this.deviceId}] [IG-FSM] Reel detected, skipping scroll strategies.`);
        }

        return null;
    }

    private async strategy1FastScan(): Promise<{ x: number, y: number, isDirectInput: boolean } | null> {
        console.log(`[${this.deviceId}] [IG-FSM] Executing Strategy 1: Fast Scan...`);
        const xmlData = await this.getSafeUiDumpXml();
        return this.parseCommentTargetFromXml(xmlData);
    }

    private async strategy2DeepScroll(): Promise<{ x: number, y: number, isDirectInput: boolean } | null> {
        console.log(`[${this.deviceId}] [IG-FSM] Executing Strategy 2: Deep Scroll...`);
        const maxScrolls = 12; // Increased for long captions
        const size = await this.getScreenSize();
        
        for (let i = 0; i < maxScrolls; i++) {
            console.log(`[${this.deviceId}] [IG-FSM] Deep scroll attempt ${i + 1}/${maxScrolls}...`);
            await this.device.swipe(
                Math.floor(size.width / 2),
                Math.floor(size.height * 0.7),
                Math.floor(size.width / 2),
                Math.floor(size.height * 0.2),
                this.randInt(400, 700)
            );
            await this.device.sleep(this.randInt(1500, 2500));
            
            let xmlData = await this.getSafeUiDumpXml();
            const target = this.parseCommentTargetFromXml(xmlData);
            if (target) {
                console.log(`[${this.deviceId}] [IG-FSM] Strategy 2 Success after ${i+1} scrolls.`);
                return target;
            }
            
            // Break early if we hit the end of feed or suggested posts
            if (xmlData.includes('Suggested for you') || xmlData.includes('More posts')) {
                 console.log(`[${this.deviceId}] [IG-FSM] Reached end of post content.`);
                 break;
            }
        }
        return null;
    }

    private async strategy3ZeroHopReset(postUrl: string): Promise<{ x: number, y: number, isDirectInput: boolean } | null> {
        console.log(`[${this.deviceId}] [IG-FSM] Executing Strategy 3: Zero-Hop Reset Fallback...`);
        await this.device.executeCommand(`am start -a android.intent.action.VIEW -d "${postUrl}"`);
        await this.device.sleep(3500); // Wait for reset
        
        // Sometimes the comment button is immediately visible after reset
        let xmlData = await this.getSafeUiDumpXml();
        let target = this.parseCommentTargetFromXml(xmlData);
        if (target) return target;

        // Try one massive swipe
        const size = await this.getScreenSize();
        await this.device.swipe(
            Math.floor(size.width / 2),
            Math.floor(size.height * 0.9),
            Math.floor(size.width / 2),
            Math.floor(size.height * 0.1),
            300
        );
        await this.device.sleep(2500);
        xmlData = await this.getSafeUiDumpXml();
        return this.parseCommentTargetFromXml(xmlData);
    }

    private parseCommentTargetFromXml(xmlData: string): { x: number, y: number, isDirectInput: boolean } | null {
        const directInput = this.findCommentInput(xmlData);
        if (directInput) {
            return { ...directInput, isDirectInput: true };
        }

        let byId = this.findByResourceId(xmlData, 'com.instagram.android:id/row_feed_button_comment');
        if (!byId) byId = this.findByResourceId(xmlData, 'com.instagram.android:id/comment_button');
        const byDesc = this.findByContentDesc(xmlData, 'Comment');
        
        const commentBtn = byId || byDesc;
        if (commentBtn) {
            return { ...commentBtn, isDirectInput: false };
        }
        
        return null;
    }

    // ─── Comment Input — Dual Method ───────────────────────────────────────────

    private async smartInputText(text: string, inputX: number, inputY: number): Promise<boolean> {
        // Ensure field is focused
        await this.tapWithJitter(inputX, inputY);
        await this.device.sleep(1000);

        console.log(`[${this.deviceId}] [INPUT] Pasting text via edge agent...`);
        try {
            await this.device.pasteText(text);
        } catch (err) {
            console.warn(`[${this.deviceId}] [INPUT Warning] pasteText threw an error:`, err);
        }
        await this.device.sleep(1500);

        // Verify: check if EditText has non-empty text
        const xmlAfter = await this.getSafeUiDumpXml();
        const snippet = text.substring(0, Math.min(10, text.length));
        if (xmlAfter.includes(snippet)) {
            console.log(`[${this.deviceId}] [INPUT] pasteText succeeded.`);
            return true;
        }

        console.error(`[${this.deviceId}] [INPUT] pasteText failed! Text not found in UI dump.`);
        return false;
    }

    // ─── FSM: Clean State ───────────────────────────────────────────────────────

    private async establishCleanState(postUrl: string): Promise<void> {
        if (postUrl === 'SKIP_NAV') {
            console.log(`[${this.deviceId}] [IG-FSM] Skipping clean state / nav due to SKIP_NAV flag.`);
            return;
        }
        
        console.log(`[${this.deviceId}] [IG-FSM] Verifying device state...`);
        await this.device.verifyDeviceState();

        console.log(`[${this.deviceId}] [IG-FSM] Force stopping Instagram...`);
        await this.device.forceStopApp(IG_PACKAGE);
        await this.device.sleep(this.randInt(1500, 3000));

        console.log(`[${this.deviceId}] [IG-FSM] Navigating: ${postUrl}`);
        await this.device.openDeepLink(postUrl, IG_PACKAGE);

        console.log(`[${this.deviceId}] [IG-FSM] Waiting ${RENDER_WAIT_MS / 1000}s for render...`);
        await this.device.sleep(RENDER_WAIT_MS);
        
        if (postUrl.includes('/reel/')) {
            console.log(`[${this.deviceId}] [IG-FSM] Tapping screen to pause reel video (stabilizes uiautomator)...`);
            const size = await this.getScreenSize();
            await this.device.tapCoordinate(Math.floor(size.width / 2), Math.floor(size.height / 2));
            await this.device.sleep(1500);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // FSM: LIKE A POST
    // ═══════════════════════════════════════════════════════════════════════════

    public async likePost(postUrl: string): Promise<boolean> {
        const isReel = postUrl.includes('/reel/');
        console.log(`\n=== [IG-FSM: LIKE] Starting on ${this.deviceId} ===`);

        await this.establishCleanState(postUrl);

        const likeResult = await this.findLikeButton(4, isReel);
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
        const isReel = postUrl.includes('/reel/');
        console.log(`\n=== [IG-FSM: COMMENT] Starting on ${this.deviceId} ===`);

        await this.establishCleanState(postUrl);

        const commentTarget = await this.findCommentTargetWithStrategies(postUrl, isReel);

        if (!commentTarget) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_comment_btn_fail.xml`, await this.getSafeUiDumpXml());
            throw new Error(`[${this.deviceId}] [IG-FSM: COMMENT] Comment target not found after applying all strategies.`);
        }

        let inputCoords = { x: commentTarget.x, y: commentTarget.y };

        if (!commentTarget.isDirectInput) {
            // It was just the icon, we need to tap it to open the sheet
            console.log(`[${this.deviceId}] [IG-FSM: COMMENT] Tapping Comment Icon at ${commentTarget.x}, ${commentTarget.y}`);
            await this.tapWithJitter(commentTarget.x, commentTarget.y);
            await this.device.sleep(this.randInt(3500, 5000)); // wait for comment sheet

            // Now find the actual input box in the bottom sheet
            const sheetXml = await this.getSafeUiDumpXml();
            const foundInput = this.findCommentInput(sheetXml);
            if (!foundInput) {
                this.ensureLogsDir();
                fs.writeFileSync(`./logs/${this.deviceId}_ig_comment_input_fail.xml`, sheetXml);
                throw new Error(`[${this.deviceId}] [IG-FSM: COMMENT] Comment input field not found after tapping icon.`);
            }
            inputCoords = foundInput;
        } else {
            console.log(`[${this.deviceId}] [IG-FSM: COMMENT] Found Direct Comment Input (Strategy 1) at ${commentTarget.x}, ${commentTarget.y}`);
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
        const isReel = postUrl.includes('/reel/');
        console.log(`\n=== [IG-FSM: ENGAGE POST] Starting on ${this.deviceId} ===`);

        await this.establishCleanState(postUrl);

        // ── LIKE PHASE ──────────────────────────────────────────────────────
        const likeResult = await this.findLikeButton(4, isReel);
        if (likeResult && !likeResult.alreadyLiked) {
            console.log(`[${this.deviceId}] [IG-FSM: ENGAGE] Tapping Like at ${likeResult.x}, ${likeResult.y}`);
            await this.tapWithJitter(likeResult.x, likeResult.y);
            console.log(`✅ [${this.deviceId}] [IG-FSM: ENGAGE] Post Liked!`);
            await this.microPause();
        } else if (likeResult?.alreadyLiked) {
            console.log(`[${this.deviceId}] [IG-FSM: ENGAGE] Already liked, skipping.`);
        } else {
            console.warn(`[${this.deviceId}] [IG-FSM: ENGAGE] Like button not found, continuing.`);
        }



        // ── COMMENT PHASE ───────────────────────────────────────────────────
        await this.stealthDelay('comment action');
        const commentTarget = await this.findCommentTargetWithStrategies(postUrl, isReel);

        if (!commentTarget) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_engage_comment_fail.xml`, await this.getSafeUiDumpXml());
            throw new Error(`[${this.deviceId}] [IG-FSM: ENGAGE] Comment target not found after applying all strategies.`);
        }

        let inputCoords = { x: commentTarget.x, y: commentTarget.y };

        if (!commentTarget.isDirectInput) {
            // It was just the icon, we need to tap it to open the sheet
            console.log(`[${this.deviceId}] [IG-FSM: ENGAGE] Tapping Comment Icon at ${commentTarget.x}, ${commentTarget.y}`);
            await this.tapWithJitter(commentTarget.x, commentTarget.y);
            await this.device.sleep(this.randInt(3500, 5500)); // wait for comment sheet

            // Now find the actual input box in the bottom sheet
            const sheetXml = await this.getSafeUiDumpXml();
            const foundInput = this.findCommentInput(sheetXml);
            if (!foundInput) {
                this.ensureLogsDir();
                fs.writeFileSync(`./logs/${this.deviceId}_ig_engage_input_fail.xml`, sheetXml);
                throw new Error(`[${this.deviceId}] [IG-FSM: ENGAGE] Comment input field not found after tapping icon.`);
            }
            inputCoords = foundInput;
        } else {
            console.log(`[${this.deviceId}] [IG-FSM: ENGAGE] Found Direct Comment Input (Strategy 1) at ${commentTarget.x}, ${commentTarget.y}`);
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

    // ═══════════════════════════════════════════════════════════════════════════
    // FSM: REPOST POST
    // ═══════════════════════════════════════════════════════════════════════════
    public async repostPost(postUrl: string): Promise<boolean> {
        const isReel = postUrl.includes('/reel/');
        console.log(`[${this.deviceId}] [IG-FSM: REPOST] Starting flow for ${postUrl}`);

        await this.establishCleanState(postUrl);
        let xmlData = await this.getSafeUiDumpXml();

        // Find Share button
        let shareBtn = this.findByResourceId(xmlData, 'com.instagram.android:id/row_feed_button_share') ||
                       this.findByResourceId(xmlData, 'com.instagram.android:id/share_button') ||
                       this.findByContentDesc(xmlData, 'Share') ||
                       this.findByContentDesc(xmlData, 'Send post') ||
                       this.findByContentDesc(xmlData, 'Send reel') ||
                       this.findByContentDesc(xmlData, 'Send');

        if (!shareBtn && !isReel) {
            console.log(`[${this.deviceId}] [IG-FSM: REPOST] Scrolling to find Share button...`);
            const size = await this.getScreenSize();
            await this.device.swipe(Math.floor(size.width / 2), Math.floor(size.height * 0.6), Math.floor(size.width / 2), Math.floor(size.height * 0.3), this.randInt(400, 700));
            await this.device.sleep(this.randInt(1500, 2500));
            xmlData = await this.getSafeUiDumpXml();
            shareBtn = this.findByResourceId(xmlData, 'com.instagram.android:id/row_feed_button_share') ||
                       this.findByResourceId(xmlData, 'com.instagram.android:id/share_button') ||
                       this.findByContentDesc(xmlData, 'Share') ||
                       this.findByContentDesc(xmlData, 'Send post') ||
                       this.findByContentDesc(xmlData, 'Send reel') ||
                       this.findByContentDesc(xmlData, 'Send');
        }

        if (!shareBtn) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_repost_sharebtn_fail.xml`, xmlData);
            throw new Error(`[${this.deviceId}] [IG-FSM: REPOST] Share button not found.`);
        }

        console.log(`[${this.deviceId}] [IG-FSM: REPOST] Tapping Share at ${shareBtn.x}, ${shareBtn.y}`);
        await this.tapWithJitter(shareBtn.x, shareBtn.y);
        await this.device.sleep(this.randInt(3500, 5500));

        const sheetXml = await this.getSafeUiDumpXml();
        
        let targetBtn = this.findByContentDesc(sheetXml, 'Repost') ||
                        this.findByContentDesc(sheetXml, 'Add to story');

        if (!targetBtn) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_repost_targetbtn_fail.xml`, sheetXml);
            throw new Error(`[${this.deviceId}] [IG-FSM: REPOST] Repost / Add to story button not found in share sheet.`);
        }

        console.log(`[${this.deviceId}] [IG-FSM: REPOST] Tapping Target Repost Button at ${targetBtn.x}, ${targetBtn.y}`);
        await this.tapWithJitter(targetBtn.x, targetBtn.y);
        
        // Wait for Story Editor to load
        console.log(`[${this.deviceId}] [IG-FSM: REPOST] Waiting for Story Editor to load...`);
        await this.device.sleep(this.randInt(5000, 7000));
        
        const storyEditorXml = await this.getSafeUiDumpXml();
        
        // Find "Your story", "Share", or Next arrow
        let finalShareBtn = this.findByContentDesc(storyEditorXml, 'Your story') ||
                            this.findByContentDesc(storyEditorXml, 'Your Story') ||
                            this.findByContentDesc(storyEditorXml, 'Share to Your story') ||
                            this.findByContentDesc(storyEditorXml, 'Share') ||
                            this.findByResourceId(storyEditorXml, 'com.instagram.android:id/share_to_story_button') ||
                            this.findByResourceId(storyEditorXml, 'com.instagram.android:id/toolbar_share_button');

        if (!finalShareBtn) {
            this.ensureLogsDir();
            fs.writeFileSync(`./logs/${this.deviceId}_ig_repost_finalbtn_fail.xml`, storyEditorXml);
            console.warn(`[${this.deviceId}] [IG-FSM: REPOST] Final 'Your Story' button not found! Saved dump to logs. Attempting blind tap at bottom left...`);
            // Blind tap at bottom left as fallback (typically where "Your Story" is located)
            const size = await this.getScreenSize();
            finalShareBtn = { x: Math.floor(size.width * 0.2), y: Math.floor(size.height * 0.95) };
        }

        console.log(`[${this.deviceId}] [IG-FSM: REPOST] Tapping Final Share to Story at ${finalShareBtn.x}, ${finalShareBtn.y}`);
        await this.tapWithJitter(finalShareBtn.x, finalShareBtn.y);
        await this.device.sleep(this.randInt(4000, 6000));

        console.log(`✅ [${this.deviceId}] [IG-FSM: REPOST] Repost flow completed!`);
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
