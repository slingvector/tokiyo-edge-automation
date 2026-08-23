import { IDeviceController } from '../utils/IDeviceController';
import { LocalAdbController } from '../utils/LocalAdbController';
import * as fs from 'fs';

export class LinkedInEngager {
    private device: IDeviceController;
    private deviceId: string;

    constructor(deviceId: string, controller?: IDeviceController) {
        this.deviceId = deviceId;
        this.device = controller || new LocalAdbController(deviceId);
    }

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
     * Helper to establish a clean FSM state before any event.
     */
    private async establishCleanState(postUrl: string) {
        console.log(`[${this.deviceId}] [FSM] Verifying device state...`);
        if (typeof this.device.verifyDeviceState === 'function') {
            await this.device.verifyDeviceState();
        }

        console.log(`[${this.deviceId}] [FSM] Establishing Clean State...`);
        // Force stop to clear memory and states
        await this.device.forceStopApp('com.linkedin.android');
        await this.device.sleep(2000);
        
        console.log(`[${this.deviceId}] [FSM] Navigating to Deep Link: ${postUrl}`);
        await this.device.openDeepLink(postUrl);
        
        console.log(`[${this.deviceId}] [FSM] Waiting for content to render...`);
        await this.device.sleep(15000); // Allow time for network request and UI rendering
    }

    /**
     * Extracts the coordinates of the "Like" button from the accessibility tree.
     */
    private async findLikeButtonCoordinates(maxScrolls = 3): Promise<{x: number, y: number, width: number} | null> {
        for (let i = 0; i <= maxScrolls; i++) {
            const xmlData = await this.device.getUiDumpXml();

            const likeRegex = /content-desc="Reaction button state: no reaction"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/;
            let match = xmlData.match(likeRegex);

            if (!match) {
                 const likeFallbackRegex = /content-desc="Like"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/;
                 match = xmlData.match(likeFallbackRegex);
            }

            if (match) {
                const bounds = this.parseBounds(match[1]!);
                return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width } : null;
            }

            if (i < maxScrolls) {
                console.log(`[${this.deviceId}] [FSM] Scrolling down to find Like button...`);
                // Swipe up to scroll down
                await this.device.swipe(150, 500, 150, 100, 500);
                await this.device.sleep(2000);
            }
        }
        return null;
    }

    /**
     * FSM STATE: LIKING A POST
     */
    public async likePost(postUrl: string) {
        console.log(`\n=== [FSM: LIKE] Starting Like Event on ${this.deviceId} ===`);
        
        await this.establishCleanState(postUrl);

        const likeBounds = await this.findLikeButtonCoordinates();
        if (!likeBounds) {
            const dump = await this.device.getUiDumpXml();
            fs.writeFileSync(`./logs/${this.deviceId}_like_fail.xml`, dump);
            throw new Error(`[${this.deviceId}] [FSM: LIKE] Failed to locate Like button. UI dump saved.`);
        }

        console.log(`[${this.deviceId}] [FSM: LIKE] Found Like button at ${likeBounds.x}, ${likeBounds.y}`);
        await this.device.tapCoordinate(likeBounds.x, likeBounds.y);
        console.log(`✅ [${this.deviceId}] [FSM: LIKE] Successfully Liked the post!`);
        
        await this.device.sleep(2000); 
        return true;
    }

    /**
     * FSM STATE: COMMENTING ON A POST
     */
    public async commentOnPost(postUrl: string, commentText: string) {
        console.log(`\n=== [FSM: COMMENT] Starting Comment Event on ${this.deviceId} ===`);
        
        await this.establishCleanState(postUrl);

        const xmlData = await this.device.getUiDumpXml();

        // Look for the "Add a comment..." text box which is natively pinned to the bottom of the Post Details view
        // Using non-capturing group (?:…|\.\.\.) because different emulators/app versions use different characters
        const commentBoxRegex = /text="Add a comment(?:\…|\.\.\.)"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/;
        let match = xmlData.match(commentBoxRegex);
        
        if (!match) {
            // Fallback: search for resource-id directly
            const idRegex = /resource-id="com.linkedin.android:id\/comment_bar_edit_text"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/;
            match = xmlData.match(idRegex);
        }

        if (!match) {
            fs.writeFileSync(`./logs/${this.deviceId}_comment_fail.xml`, xmlData);
            throw new Error(`[${this.deviceId}] [FSM: COMMENT] Failed to locate the Comment Text Box. UI dump saved.`);
        }

        const boxBounds = this.parseBounds(match[1]!);
        if (!boxBounds) {
             throw new Error(`[${this.deviceId}] [FSM: COMMENT] Failed to parse Comment Text Box bounds.`);
        }

        console.log(`[${this.deviceId}] [FSM: COMMENT] Found Comment Box at ${boxBounds.x}, ${boxBounds.y}`);
        await this.device.tapCoordinate(boxBounds.x, boxBounds.y);
        console.log(`[${this.deviceId}] [FSM: COMMENT] Waiting for keyboard/tray...`);
        await this.device.sleep(6000); // Increased to handle concurrent ADB dump lag

        // Function to inject text
        const injectText = async () => {
            await this.device.inputText(commentText);
        };

        // Type the comment
        console.log(`[${this.deviceId}] [FSM: COMMENT] Typing payload...`);
        await injectText();
        await this.device.sleep(2000);

        // Submit the comment
        let commentXmlData = await this.device.getUiDumpXml();
        
        // Verify text was actually typed. If it still says "Add a comment...", the OS dropped the input.
        const emptyPlaceholderRegex = /text="Add a comment(?:\…|\.\.\.)"/;
        if (emptyPlaceholderRegex.test(commentXmlData)) {
            console.warn(`⚠️ [${this.deviceId}] [FSM: COMMENT] Text box still empty (input dropped). Retrying...`);
            await this.device.tapCoordinate(boxBounds.x, boxBounds.y);
            await this.device.sleep(2000);
            await injectText();
            await this.device.sleep(2000);
            
            commentXmlData = await this.device.getUiDumpXml();
            
            if (emptyPlaceholderRegex.test(commentXmlData)) {
                fs.writeFileSync(`./logs/${this.deviceId}_comment_retry_fail.xml`, commentXmlData);
                throw new Error(`[${this.deviceId}] [FSM: COMMENT] Text box STILL empty. Giving up.`);
            }
        }
        const postBtnRegex = /text="(Comment|Post)"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
        const postBtnMatch = commentXmlData.match(postBtnRegex);

        if (postBtnMatch) {
            const postBounds = this.parseBounds(postBtnMatch[2]!);
            if (postBounds) {
                console.log(`[${this.deviceId}] [FSM: COMMENT] Found Submit button at ${postBounds.x}, ${postBounds.y}`);
                await this.device.tapCoordinate(postBounds.x, postBounds.y);
            } else {
                console.warn(`[${this.deviceId}] [FSM: COMMENT] Found Submit button but failed to parse bounds! string: ${postBtnMatch[2]}`);
                await this.device.pressEnter();
            }
        } else {
            console.warn(`[${this.deviceId}] [FSM: COMMENT] Fallback: Hitting Enter key`);
            await this.device.pressEnter();
        }

        console.log(`✅ [${this.deviceId}] [FSM: COMMENT] Successfully posted comment!`);
        await this.device.sleep(2000);
        return true;
    }
    
    /**
     * FSM STATE: ENGAGE WITH POST (LIKE & COMMENT)
     */
    public async engagePost(postUrl: string, commentText: string) {
        console.log(`\n=== [FSM: ENGAGE POST] Starting Engage Event on ${this.deviceId} ===`);
        
        await this.establishCleanState(postUrl);

        const likeBounds = await this.findLikeButtonCoordinates();
        if (likeBounds) {
            console.log(`[${this.deviceId}] [FSM: ENGAGE POST] Found Like button at ${likeBounds.x}, ${likeBounds.y}`);
            await this.device.tapCoordinate(likeBounds.x, likeBounds.y);
            console.log(`✅ [${this.deviceId}] [FSM: ENGAGE POST] Successfully Liked the post!`);
            await this.device.sleep(2000);
        } else {
            console.warn(`[${this.deviceId}] [FSM: ENGAGE POST] Could not find Like button, proceeding to comment...`);
        }

        // We are already on the post page, no need to establish clean state again.
        // Just find the comment button and click it.
        const xmlData = await this.device.getUiDumpXml();
        let commentBtnMatch = xmlData.match(/content-desc="Comment"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/);
        
        if (commentBtnMatch) {
            const commentBtnBounds = this.parseBounds(commentBtnMatch[1]!);
            if (commentBtnBounds) {
                console.log(`[${this.deviceId}] [FSM: ENGAGE POST] Found Comment button at ${commentBtnBounds.x}, ${commentBtnBounds.y}`);
                await this.device.tapCoordinate(commentBtnBounds.x, commentBtnBounds.y);
                await this.device.sleep(3000); // wait for comment text box to appear
            }
        } else {
             // If we can't find the comment button, the CommentBox regex below might still find the text box directly.
             console.warn(`[${this.deviceId}] [FSM: ENGAGE POST] Could not find Comment button.`);
        }

        const commentXmlData = await this.device.getUiDumpXml();

        // Look for the "Leave your thoughts here..." text box
        const commentBoxRegex = /text="Leave your thoughts here(?:\…|\.\.\.)"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
        let match = commentXmlData.match(commentBoxRegex);
        
        if (!match) {
            // Fallback: search for resource-id directly
            const idRegex = /resource-id="com.linkedin.android:id\/comment_bar_edit_text"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/;
            match = commentXmlData.match(idRegex);
        }

        if (!match) {
            fs.writeFileSync(`./logs/${this.deviceId}_engage_post_comment_fail.xml`, commentXmlData);
            throw new Error(`[${this.deviceId}] [FSM: ENGAGE POST] Failed to locate the Comment Text Box.`);
        }

        const boxBounds = this.parseBounds(match[1]!);
        if (!boxBounds) {
             throw new Error(`[${this.deviceId}] [FSM: ENGAGE POST] Failed to parse Comment Text Box bounds.`);
        }

        console.log(`[${this.deviceId}] [FSM: ENGAGE POST] Found Comment Box at ${boxBounds.x}, ${boxBounds.y}`);
        await this.device.tapCoordinate(boxBounds.x, boxBounds.y);
        console.log(`[${this.deviceId}] [FSM: ENGAGE POST] Waiting for keyboard...`);
        await this.device.sleep(3000);

        console.log(`[${this.deviceId}] [FSM: ENGAGE POST] Typing payload...`);
        await this.device.inputText(commentText);
        await this.device.sleep(2000);

        // Submit the comment
        let submitXmlData = await this.device.getUiDumpXml();
        
        const postBtnRegex = /text="(Comment|Post)"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
        const postBtnMatch = submitXmlData.match(postBtnRegex);

        if (postBtnMatch) {
            const postBounds = this.parseBounds(postBtnMatch[2]!);
            if (postBounds) {
                console.log(`[${this.deviceId}] [FSM: ENGAGE POST] Found Submit button at ${postBounds.x}, ${postBounds.y}`);
                await this.device.tapCoordinate(postBounds.x, postBounds.y);
            } else {
                await this.device.pressEnter();
            }
        } else {
            console.warn(`[${this.deviceId}] [FSM: ENGAGE POST] Fallback: Hitting Enter key`);
            await this.device.pressEnter();
        }

        console.log(`✅ [${this.deviceId}] [FSM: ENGAGE POST] Successfully engaged with post!`);
        await this.device.sleep(2000);
        return true;
    }

    /**
     * FSM STATE: SEND DIRECT MESSAGE (THREAD)
     */
    public async sendDirectMessage(threadId: string, message: string) {
        console.log(`\n=== [FSM: MESSAGE] Starting DM Event on ${this.deviceId} ===`);
        
        await this.establishCleanState(`https://www.linkedin.com/messaging/thread/${threadId}`);

        const xmlData = await this.device.getUiDumpXml();

        // Look for the "Write a message..." text box
        const msgBoxRegex = /text="Write a message(?:\…|\.\.\.)"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
        let match = xmlData.match(msgBoxRegex);
        
        if (!match) {
            // Fallback resource-id
            const idRegex = /resource-id="com.linkedin.android:id\/messaging_compose_text"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/;
            match = xmlData.match(idRegex);
        }

        if (!match) {
            fs.writeFileSync(`./logs/${this.deviceId}_dm_fail.xml`, xmlData);
            throw new Error(`[${this.deviceId}] [FSM: MESSAGE] Failed to locate the Message Text Box.`);
        }

        const boxBounds = this.parseBounds(match[1]!);
        if (!boxBounds) {
             throw new Error(`[${this.deviceId}] [FSM: MESSAGE] Failed to parse Message Text Box bounds.`);
        }

        console.log(`[${this.deviceId}] [FSM: MESSAGE] Found Message Box at ${boxBounds.x}, ${boxBounds.y}`);
        await this.device.tapCoordinate(boxBounds.x, boxBounds.y);
        console.log(`[${this.deviceId}] [FSM: MESSAGE] Waiting for keyboard...`);
        await this.device.sleep(4000);

        console.log(`[${this.deviceId}] [FSM: MESSAGE] Typing payload...`);
        await this.device.inputText(message);
        await this.device.sleep(2000);

        // Submit the message
        const msgXmlData = await this.device.getUiDumpXml();
        const sendBtnRegex = /content-desc="Send"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
        const sendBtnMatch = msgXmlData.match(sendBtnRegex);

        if (sendBtnMatch) {
            const sendBounds = this.parseBounds(sendBtnMatch[1]!);
            if (sendBounds) {
                console.log(`[${this.deviceId}] [FSM: MESSAGE] Found Send button at ${sendBounds.x}, ${sendBounds.y}`);
                await this.device.tapCoordinate(sendBounds.x, sendBounds.y);
            }
        } else {
            console.warn(`[${this.deviceId}] [FSM: MESSAGE] Fallback: Hitting Enter key`);
            await this.device.pressEnter();
        }

        console.log(`✅ [${this.deviceId}] [FSM: MESSAGE] Successfully sent DM!`);
        await this.device.sleep(2000);
        return true;
    }

    /**
     * FSM STATE: MESSAGE A PROFILE (VANITY URL)
     */
    public async messageProfile(vanityUrl: string, message: string) {
        console.log(`\n=== [FSM: MESSAGE PROFILE] Starting Event on ${this.deviceId} ===`);
        
        await this.establishCleanState(`https://www.linkedin.com/in/${vanityUrl}`);

        const xmlData = await this.device.getUiDumpXml();

        // Find the "Message" button on the profile
        const messageBtnRegex = /text="Message"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
        let match = xmlData.match(messageBtnRegex);

        if (!match) {
            fs.writeFileSync(`./logs/${this.deviceId}_profile_msg_fail.xml`, xmlData);
            throw new Error(`[${this.deviceId}] [FSM: MESSAGE PROFILE] Failed to locate the Message button on profile.`);
        }

        const boxBounds = this.parseBounds(match[1]!);
        if (boxBounds) {
            console.log(`[${this.deviceId}] [FSM: MESSAGE PROFILE] Found Message Button at ${boxBounds.x}, ${boxBounds.y}`);
            await this.device.tapCoordinate(boxBounds.x, boxBounds.y);
            await this.device.sleep(5000); // Wait for chat thread to open
            
            // Now we are in the thread view, we can dump the UI and type
            const threadXml = await this.device.getUiDumpXml();
            const msgBoxRegex = /text="Write a message(?:\…|\.\.\.)"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i;
            let threadMatch = threadXml.match(msgBoxRegex);
            
            if (!threadMatch) {
                 const idRegex = /resource-id="com.linkedin.android:id\/messaging_keyboard_text_input_container"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/;
                 threadMatch = threadXml.match(idRegex);
            }
            
            if (threadMatch) {
                const threadBounds = this.parseBounds(threadMatch[1]!);
                if (threadBounds) {
                    console.log(`[${this.deviceId}] [FSM: MESSAGE PROFILE] Tapping compose box at ${threadBounds.x}, ${threadBounds.y}`);
                    await this.device.tapCoordinate(threadBounds.x, threadBounds.y);
                    await this.device.sleep(2000);
                    await this.device.inputText(message);
                    await this.device.sleep(2000);
                    
                    const postXml = await this.device.getUiDumpXml();
                    const sendBtnMatch = postXml.match(/content-desc="Send"[^>]*bounds="(\[\d+,\d+\]\[\d+,\d+\])"/i);
                    if (sendBtnMatch) {
                        const sendBounds = this.parseBounds(sendBtnMatch[1]!);
                        if (sendBounds) await this.device.tapCoordinate(sendBounds.x, sendBounds.y);
                    } else {
                        await this.device.pressEnter();
                    }
                    console.log(`✅ [${this.deviceId}] [FSM: MESSAGE PROFILE] Successfully sent message to ${vanityUrl}!`);
                    return true;
                }
            } else {
                fs.writeFileSync(`./logs/${this.deviceId}_profile_compose_fail.xml`, threadXml);
                throw new Error(`[${this.deviceId}] [FSM: MESSAGE PROFILE] Could not find the compose text box.`);
            }
        }
        return true;
    }
}
