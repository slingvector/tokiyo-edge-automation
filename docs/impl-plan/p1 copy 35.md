# Instagram Local Testing Plan — Phase 2

## Testing Stack

```
[LocalAdbController] ← direct ADB (no WebSocket)
        ↓
[emulator-5554]  tokiyo_test_avd   (API 33, ARM64)
[RZCY110AKDZ]    Samsung S24 Ultra (API 36, real device)
        ↓
[Instagram APK 443.0.0.48.82]
```

Orchestrator runs locally via docker-compose. Tests use `LocalAdbController` directly
(not `RemoteShizukuController`) so there's no WebSocket layer to debug through.

---

## Phase 1: Emulator Setup

### 1A. Install Instagram on emulator
```bash
# Emulator: emulator-5554
adb -s emulator-5554 install -r apk-analyzer/instagram/instagram-base.apk

# OR: install from Play Store (requires Google Play emulator image)
# tokiyo_test_avd should have Google APIs image
```

> [!WARNING]
> Emulators without ARM translation cannot run Instagram (native libs).
> tokiyo_test_avd uses arm64-v8a image so it should work.
> If Instagram crashes on launch → use real device RZCY110AKDZ for all tests.

### 1B. Login to Instagram on emulator
- Manual step: log in with a test account before running automation
- Required: Instagram must be logged in, or all deep links will redirect to login screen

### 1C. Verify deep link works
```bash
adb -s emulator-5554 shell am start -a android.intent.action.VIEW \
  -d "https://www.instagram.com/p/DFahPO3S3aP/"
# Wait 8s → dump UI → check for row_feed_button_like
```

---

## Phase 2: APK Cross-Device Analysis

### Problem
Button IDs and bounds differ across:
- Samsung S24 Ultra (1440×3120, Android 16)
- Generic emulator (320×640 → 1080×1920, Android 13)
- Other India devices (Redmi, OnePlus, Realme)

### What we need to verify on EACH device/emulator
```bash
# Run this after opening any Instagram post
adb -s DEVICE_ID shell uiautomator dump /sdcard/ig_dump.xml
adb -s DEVICE_ID pull /sdcard/ig_dump.xml apk-analyzer/instagram/ig_dump_DEVICE.xml
grep -oE 'resource-id="[^"]*"' ig_dump_DEVICE.xml | sort -u | grep instagram
```

### Cross-device comparison matrix

| Element | S24 Ultra | Emulator-5554 | Redmi/OnePlus |
|---|---|---|---|
| `row_feed_button_like` | ✅ Confirmed | ❓ TBD | ❓ TBD |
| `row_feed_button_comment` | ✅ Confirmed | ❓ TBD | ❓ TBD |
| `row_feed_button_save` | ✅ Confirmed | ❓ TBD | ❓ TBD |
| `row_feed_view_group_buttons` | ✅ Confirmed | ❓ TBD | ❓ TBD |
| `inline_follow_button` | ✅ Confirmed | ❓ TBD | ❓ TBD |
| Comment EditText class | ✅ Confirmed | ❓ TBD | ❓ TBD |
| Post button label | `"Post"` | ❓ TBD | ❓ TBD |

**Finding:** If resource-ids match across devices → system works universally.
If they differ → we need device-profile-based selector overrides.

---

## Phase 3: FSM Test Cases

### TC-01: Happy Path — Like + Comment
```
Input:  Valid public post URL, non-empty comment text
Expect: Like tapped (content-desc flips to "Unlike"), comment appears in feed
```

### TC-02: Already Liked Post
```
Input:  Post URL where account has already liked
Expect: FSM detects "Unlike" button → skips like → proceeds to comment
```

### TC-03: Post Not Found (404)
```
Input:  https://www.instagram.com/p/INVALIDCODE/
Expect: Queue pre-flight check catches 404 → job skipped with log warning, NOT thrown as error
```

### TC-04: Deep Link Redirects to Login
```
Input:  Valid post URL, but Instagram not logged in on device
Expect: FSM detects login screen (no row_feed_button_like found) → throws descriptive error
        "Instagram not logged in on device DEVICE_ID"
```

### TC-05: Post Not Visible After Navigation (scroll fails)
```
Input:  Valid post URL, feed loaded but post scrolled past
Expect: 4 scroll attempts → buttons still not found → save UI dump → throw error
```

### TC-06: Comment Button Not Found
```
Input:  Valid post, like works, comment button obscured/missing
Expect: Log warning → save XML dump → throw error with dump path
```

### TC-07: Comment Input Field Not Found After Tapping Comment Button
```
Input:  Comment button tapped, but sheet doesn't open (keyboard dismiss race)
Expect: Retry tap once after 2s → if still no input → throw error
```

### TC-08: Input Text Method A Fails (text doesn't appear)
```
Input:  Comment with special chars — emojis, Hindi text, etc.
Expect: Method A fails verification → auto-fallback to clipboard paste → succeeds
```

### TC-09: "Post" Submit Button Not Found
```
Input:  Comment typed, but Post button not in UI tree
Expect: Fallback to Enter key → verify comment was submitted
```

### TC-10: Network Timeout During Navigation
```
Input:  Device has poor network, Instagram takes >15s to load
Expect: Increase render wait timeout → if UI dump shows no Instagram content after 20s → throw timeout error
```

### TC-11: Device Locked / Screen Off
```
Input:  Device screen is off when job starts
Expect: verifyDeviceState() wakes device → swipes to unlock → proceeds normally
```

### TC-12: Concurrent Jobs on Same Device
```
Input:  Two jobs dispatched to same node_id simultaneously
Expect: nodeLock_v2 prevents second job from starting → second job retries after lock expires
```

### TC-13: App Crash During Automation
```
Input:  Instagram crashes mid-flow (OOM, ANR)
Expect: UI dump returns empty/system UI → FSM throws error → device lock released in finally block
```

### TC-14: Rate Limit Warning from Instagram
```
Input:  >10 actions in short period
Expect: [BACKLOG] ig:hourly:{node_id} counter — blocked with rate limit error before starting
        Current: no rate limiting — log a warning when >5 actions observed
```

---

## Phase 4: Edge Cases by Device Type

### Emulator-specific
| Issue | Detection | Mitigation |
|---|---|---|
| ARM translation failure | Instagram crashes on launch | Fallback: use real device for test |
| Slow rendering | Buttons appear after >8s | Increase `RENDER_WAIT_MS` to 12s for emulators |
| No clipboard app | `am broadcast clipper.set` fails | Fallback: use `content insert` clipboard method |
| Different display size | Bounds in XML differ | Irrelevant — we use resource-id not coords |

### Samsung-specific (S24 Ultra)
| Issue | Detection | Mitigation |
|---|---|---|
| Samsung One UI overlay | Different statusbar elements | Ignore non-IG resource-ids |
| Secure folder | Instagram in secure folder | Not supported — standard install only |
| DeX mode | Desktop UI layout | Not supported — phone mode only |

### Generic India devices (Redmi, Realme, OnePlus)
| Issue | Detection | Mitigation |
|---|---|---|
| MIUI/ColorOS gesture nav | Back gesture conflicts | Use `input keyevent KEYCODE_BACK` instead |
| Aggressive battery saver | App killed mid-flow | `dumpsys deviceidle whitelist` for IG package |
| Old Instagram version | Different resource-ids | Detect version, use version-matched selectors |

---

## Phase 5: Graceful Error Handling Requirements

Every FSM state must follow this pattern:

```typescript
// ✅ GOOD — descriptive, saves dump, releases lock
try {
  const btn = await this.findLikeButton();
  if (!btn) {
    this.ensureLogsDir();
    fs.writeFileSync(`./logs/${this.deviceId}_like_fail_${Date.now()}.xml`, 
                     await this.device.getUiDumpXml());
    throw new Error(`[${this.deviceId}] Like button not found after 4 scrolls. ` +
                    `Dump: ./logs/${this.deviceId}_like_fail.xml`);
  }
} finally {
  // Lock always released — even on crash
  await redisClient.del(lockKey);
}

// ❌ BAD — silent failure, no context
if (!btn) return false;
```

### Required error messages format
```
[DEVICE_ID] [IG-FSM: STATE] Error description. Dump saved: ./logs/FILE.xml
```

### Required for each failure
- [ ] Save UI dump XML with timestamp in filename
- [ ] Log error with `console.error` (not just `warn`)  
- [ ] Release nodeLock in `finally` (already done in queue)
- [ ] Throw error so BullMQ retries (not silent return)

---

## Phase 6: Log Watching Guide

```bash
# Watch all orchestrator logs in real-time
docker-compose -f cloud-orchestrator/docker-compose.yml logs -f orchestrator

# Filter only Instagram FSM logs
docker-compose logs -f orchestrator | grep "\[IG-FSM"

# Filter failures only
docker-compose logs -f orchestrator | grep -E "ERROR|FAIL|❌|⚠️"

# Watch saved XML dumps (errors)
ls -lt cloud-orchestrator/logs/*.xml | head -10

# Check Redis queue depth
docker exec tokiyo-redis redis-cli llen bull:instagram-jobs:wait
docker exec tokiyo-redis redis-cli llen bull:instagram-jobs:failed
```

---

## Phase 7: Test Execution Order

```
[ ] 1. Install Instagram on emulator-5554
[ ] 2. Log in manually on emulator with test account
[ ] 3. Run APK UI dump on emulator → compare resource-ids with S24 Ultra dump
[ ] 4. Start edge agent on emulator (or use LocalAdbController directly for unit tests)
[ ] 5. TC-01: Happy path on emulator (screen record)
[ ] 6. TC-03: 404 URL handling
[ ] 7. TC-04: Login screen detection
[ ] 8. TC-08: Emoji/special char comment (dual input method)
[ ] 9. TC-11: Device lock/unlock flow
[ ] 10. TC-01 on real device RZCY110AKDZ (compare behavior)
[ ] 11. Fix all failures found
[ ] 12. Deploy to Cloud Run
```

---

## Files to Create/Modify

| File | Action | Purpose |
|---|---|---|
| `src/services/InstagramEngager.ts` | Modify | Add retry logic, better error messages, login detection |
| `src/tests/instagram_local_test.ts` | CREATE | Local test runner (no WebSocket, uses LocalAdbController) |
| `apk-analyzer/instagram/ig_dump_emulator.xml` | CREATE | UI dump from emulator for cross-device comparison |
| `apk-analyzer/instagram/device_profiles.json` | CREATE | Per-device selector overrides if resource-ids differ |
