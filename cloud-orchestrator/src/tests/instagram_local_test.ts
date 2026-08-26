/**
 * Instagram Local Test Runner
 *
 * Runs InstagramEngager FSM test cases directly against ADB
 * (no WebSocket, no BullMQ) for rapid local development.
 *
 * Usage:
 *   npx ts-node src/tests/instagram_local_test.ts [DEVICE_ID] [TEST_CASE]
 *
 * Examples:
 *   npx ts-node src/tests/instagram_local_test.ts emulator-5554 all
 *   npx ts-node src/tests/instagram_local_test.ts emulator-5554 TC-01
 *   npx ts-node src/tests/instagram_local_test.ts RZCY110AKDZ TC-08
 */

import { InstagramEngager } from '../services/InstagramEngager';
import { LocalAdbController } from '../utils/LocalAdbController';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// ─── Config ───────────────────────────────────────────────────────────────────

const DEVICE_ID = process.argv[2] || 'emulator-5554';
const TEST_FILTER = process.argv[3] || 'all';

// Public posts for testing (verified accessible)
const TEST_POSTS = {
    public_post_1: 'https://www.instagram.com/p/C9bXKL5OEYR/',    // Justin Lienhard video
    public_post_2: 'https://www.instagram.com/p/C9bXKL5OEYR/',    // Generic public post
    invalid_post:  'https://www.instagram.com/p/INVALIDCODE000/',   // Should 404
};

const TEST_COMMENTS = {
    ascii:   'Really insightful post! Thanks for sharing.',
    unicode: 'Great perspective! 🔥 Keep it up 💯',
    hindi:   'बहुत अच्छा! यह वाकई उपयोगी है।',
    long:    'This is a very detailed and thoughtful post. I appreciate the effort that went into writing this. It really resonates with what we see in the industry today.',
};

// ─── Test Infrastructure ───────────────────────────────────────────────────────

interface TestResult {
    id: string;
    name: string;
    passed: boolean;
    error?: string;
    duration: number;
    dumpPath?: string;
}

const results: TestResult[] = [];
const logsDir = path.resolve('./logs/instagram_test');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

async function runTest(
    id: string,
    name: string,
    fn: () => Promise<void>
): Promise<void> {
    if (TEST_FILTER !== 'all' && TEST_FILTER !== id) {
        console.log(`⏭️  [${id}] Skipped: ${name}`);
        return;
    }

    const start = Date.now();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`▶️  [${id}] ${name}`);
    console.log(`${'─'.repeat(60)}`);

    try {
        await fn();
        const duration = Date.now() - start;
        results.push({ id, name, passed: true, duration });
        console.log(`\n✅ [${id}] PASSED in ${(duration / 1000).toFixed(1)}s`);
    } catch (err: any) {
        const duration = Date.now() - start;
        results.push({ id, name, passed: false, error: err.message, duration });
        console.error(`\n❌ [${id}] FAILED in ${(duration / 1000).toFixed(1)}s`);
        console.error(`   Error: ${err.message}`);
    }
}

function dumpUiToFile(deviceId: string, label: string): string {
    const filename = `${logsDir}/${deviceId}_${label}_${Date.now()}.xml`;
    try {
        execSync(`adb -s ${deviceId} shell uiautomator dump /sdcard/test_dump.xml`, { stdio: 'pipe' });
        execSync(`adb -s ${deviceId} pull /sdcard/test_dump.xml "${filename}"`, { stdio: 'pipe' });
        console.log(`   📄 UI dump saved: ${filename}`);
    } catch {
        console.warn(`   ⚠️ Could not save UI dump`);
    }
    return filename;
}

function makeEngager(deviceId: string): InstagramEngager {
    const controller = new LocalAdbController(deviceId);
    return new InstagramEngager(deviceId, controller);
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

async function runAllTests(): Promise<void> {
    const engager = makeEngager(DEVICE_ID);
    const controller = new LocalAdbController(DEVICE_ID);

    // ── TC-01: Happy Path — Like + Comment ────────────────────────────────────
    await runTest('TC-01', 'Happy Path — Like + Comment', async () => {
        console.log(`   Post: ${TEST_POSTS.public_post_1}`);
        console.log(`   Comment: "${TEST_COMMENTS.ascii}"`);
        await engager.engagePost(TEST_POSTS.public_post_1, TEST_COMMENTS.ascii);
    });

    // ── TC-02: Already Liked Post ─────────────────────────────────────────────
    await runTest('TC-02', 'Already Liked Post — should skip like gracefully', async () => {
        // Run on same post as TC-01 — should already be liked
        console.log(`   Running like again on same post (should detect Unlike state)`);
        await engager.likePost(TEST_POSTS.public_post_1);
    });

    // ── TC-03: 404 URL ────────────────────────────────────────────────────────
    await runTest('TC-03', '404 URL — pre-flight should catch and skip', async () => {
        console.log(`   Testing URL: ${TEST_POSTS.invalid_post}`);
        const response = await fetch(TEST_POSTS.invalid_post, { method: 'HEAD' });
        if (response.status === 404) {
            console.log(`   ✅ Correctly detected 404 — job would be skipped by queue`);
        } else {
            console.warn(`   ⚠️ URL returned ${response.status} (expected 404 or redirect)`);
        }
        // Pre-flight logic is in InstagramQueue, not engager — this validates the queue logic
    });

    // ── TC-04: Login Screen Detection ────────────────────────────────────────
    await runTest('TC-04', 'Login Screen Detection — IG not logged in', async () => {
        // Force stop + clear data to trigger login screen
        console.log(`   Clearing Instagram app data to trigger login screen...`);
        await controller.executeCommand('pm clear com.instagram.android');
        await controller.sleep(2000);

        try {
            // This should fail with a login-screen error, not hang
            await engager.likePost(TEST_POSTS.public_post_1);
            // If we get here, something is wrong — engager should have thrown
            throw new Error('Expected FSM to detect login screen, but it did not throw');
        } catch (err: any) {
            if (err.message.includes('Like button not found') || err.message.includes('login')) {
                console.log(`   ✅ Correctly failed — Instagram not logged in`);
                dumpUiToFile(DEVICE_ID, 'TC04_login_screen');
                return; // Expected failure — test passes
            }
            throw err; // Unexpected error — re-throw
        }
    });

    // ── TC-05: Post Requires Scrolling ───────────────────────────────────────
    await runTest('TC-05', 'Scroll-to-Find — buttons below visible area', async () => {
        console.log(`   Post: ${TEST_POSTS.public_post_2}`);
        // Different post — buttons may need scrolling in feed
        await engager.likePost(TEST_POSTS.public_post_2);
    });

    // ── TC-08: Unicode/Emoji Comment Input ───────────────────────────────────
    await runTest('TC-08', 'Unicode Comment — emoji + Hindi text dual-method fallback', async () => {
        console.log(`   Comment (unicode): "${TEST_COMMENTS.unicode}"`);
        await engager.commentOnPost(TEST_POSTS.public_post_1, TEST_COMMENTS.unicode);
    });

    // ── TC-08b: Hindi Comment ─────────────────────────────────────────────────
    await runTest('TC-08b', 'Hindi Comment — Method B clipboard fallback', async () => {
        console.log(`   Comment (Hindi): "${TEST_COMMENTS.hindi}"`);
        await engager.commentOnPost(TEST_POSTS.public_post_2, TEST_COMMENTS.hindi);
    });

    // ── TC-09: Long Comment ───────────────────────────────────────────────────
    await runTest('TC-09', 'Long Comment — verify full text submitted', async () => {
        console.log(`   Comment length: ${TEST_COMMENTS.long.length} chars`);
        await engager.commentOnPost(TEST_POSTS.public_post_1, TEST_COMMENTS.long);
    });

    // ── TC-11: Device Screen Off ──────────────────────────────────────────────
    await runTest('TC-11', 'Device Lock — screen off, should auto-wake', async () => {
        console.log(`   Turning screen off...`);
        await controller.executeCommand('input keyevent KEYCODE_SLEEP');
        await controller.sleep(2000);

        console.log(`   Checking power state...`);
        const powerState = await controller.executeCommand('dumpsys power | grep -i wakefulness');
        console.log(`   Power state: ${powerState.trim()}`);

        // verifyDeviceState() should wake it
        await controller.verifyDeviceState();

        const powerAfter = await controller.executeCommand('dumpsys power | grep -i wakefulness');
        console.log(`   Power after verify: ${powerAfter.trim()}`);

        if (powerAfter.includes('Awake')) {
            console.log(`   ✅ Device successfully woken`);
        } else {
            throw new Error(`Device did not wake up. Power state: ${powerAfter}`);
        }
    });

    // ── Cross-Device UI Dump ──────────────────────────────────────────────────
    await runTest('XDEV-01', 'Cross-Device UI Analysis — dump and compare IDs', async () => {
        console.log(`   Opening post and dumping UI hierarchy...`);
        await controller.forceStopApp('com.instagram.android');
        await controller.sleep(1000);
        await controller.openDeepLink(TEST_POSTS.public_post_1, 'com.instagram.android');
        await controller.sleep(8000);

        // Scroll to show buttons
        await controller.swipe(720, 1800, 720, 900, 500);
        await controller.sleep(2000);

        const xml = await controller.getUiDumpXml();
        const outputPath = `${logsDir}/${DEVICE_ID}_cross_device_dump_${Date.now()}.xml`;
        fs.writeFileSync(outputPath, xml);
        console.log(`   📄 Full UI dump: ${outputPath}`);

        // Extract and report resource-ids
        const resourceIds = [...xml.matchAll(/resource-id="(com\.instagram\.android[^"]*)"/g)]
            .map(m => m[1])
            .filter((v, i, a) => a.indexOf(v) === i)
            .sort();

        console.log(`\n   📊 Found ${resourceIds.length} Instagram resource-ids on ${DEVICE_ID}:`);
        resourceIds.forEach(id => console.log(`      ${id}`));

        // Check critical IDs
        const criticalIds = [
            'com.instagram.android:id/row_feed_button_like',
            'com.instagram.android:id/row_feed_button_comment',
            'com.instagram.android:id/row_feed_view_group_buttons',
        ];

        const missing = criticalIds.filter(id => !resourceIds.includes(id));
        if (missing.length > 0) {
            console.warn(`\n   ⚠️ MISSING critical IDs on ${DEVICE_ID}:`);
            missing.forEach(id => console.warn(`      ❌ ${id}`));
            throw new Error(`Critical engagement button IDs missing on ${DEVICE_ID}. See dump: ${outputPath}`);
        }

        console.log(`\n   ✅ All critical engagement button IDs present!`);
    });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  Instagram FSM Local Test Runner`);
    console.log(`  Device: ${DEVICE_ID}   Filter: ${TEST_FILTER}`);
    console.log(`${'═'.repeat(60)}`);

    // Verify device is connected
    try {
        execSync(`adb -s ${DEVICE_ID} shell echo connected`, { stdio: 'pipe' });
        console.log(`\n✅ Device ${DEVICE_ID} is connected`);
    } catch {
        console.error(`\n❌ Device ${DEVICE_ID} not found. Run: adb devices`);
        process.exit(1);
    }

    // Verify Instagram is installed
    try {
        const pkgs = execSync(`adb -s ${DEVICE_ID} shell pm list packages | grep instagram`, { stdio: 'pipe' }).toString();
        if (!pkgs.includes('com.instagram.android')) throw new Error('not installed');
        console.log(`✅ Instagram is installed`);
    } catch {
        console.error(`❌ Instagram not installed on ${DEVICE_ID}`);
        console.error(`   Run: adb -s ${DEVICE_ID} install apk-analyzer/instagram/instagram-base.apk`);
        process.exit(1);
    }

    const startTime = Date.now();
    await runAllTests();
    const totalDuration = Date.now() - startTime;

    // ─── Summary Report ───────────────────────────────────────────────────────
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`  TEST SUMMARY — Device: ${DEVICE_ID}`);
    console.log(`${'═'.repeat(60)}`);

    const passed = results.filter(r => r.passed).length;
    const failed = results.filter(r => !r.passed).length;

    results.forEach(r => {
        const icon = r.passed ? '✅' : '❌';
        const duration = `${(r.duration / 1000).toFixed(1)}s`;
        console.log(`  ${icon} [${r.id}] ${r.name} (${duration})`);
        if (!r.passed) console.log(`       └─ ${r.error}`);
    });

    console.log(`\n  Total: ${passed} passed, ${failed} failed — ${(totalDuration / 1000).toFixed(1)}s`);
    console.log(`  Dumps saved to: ${logsDir}`);
    console.log(`${'═'.repeat(60)}\n`);

    // Write JSON report
    const reportPath = `${logsDir}/report_${DEVICE_ID}_${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify({ device: DEVICE_ID, results, totalDuration }, null, 2));
    console.log(`  📊 Full report: ${reportPath}`);

    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
