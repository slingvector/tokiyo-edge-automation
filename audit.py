import subprocess
import time
import easyocr
import cv2
import json

links = [
    ("Add Connections", "linkedin://mynetwork/add-connections", "https://www.linkedin.com/mynetwork/discover-hub/"),
    ("Groups Directory", "linkedin://groups/", "https://www.linkedin.com/groups/"),
    ("Edit Profile", "linkedin://profile/uedit", "https://www.linkedin.com/in/me/edit/"),
    ("Notification Settings", "linkedin://notifications-settings", "https://www.linkedin.com/mypreferences/d/categories/notifications"),
    ("Premium Upsell", "linkedin://premium/products/", "https://www.linkedin.com/premium/products/"),
]

reader = easyocr.Reader(['en'])

def test_link(link):
    print(f"Testing {link}")
    # Dismiss any dialogs
    subprocess.run(["adb", "shell", "input", "keyevent", "4"])
    time.sleep(1)
    subprocess.run(["adb", "shell", "input", "keyevent", "4"])
    
    res = subprocess.run(["adb", "shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", link, "com.linkedin.android"], capture_output=True, text=True)
    
    if "ResolverActivity" in res.stdout:
        print("ResolverActivity blocked the intent.")
        return "RESOLVER_BLOCKED"
        
    time.sleep(4)
    subprocess.run(["adb", "shell", "screencap", "-p", "/data/local/tmp/screen_audit.png"])
    subprocess.run(["adb", "pull", "/data/local/tmp/screen_audit.png", "./screen_audit.png"])
    
    img = cv2.imread('screen_audit.png')
    if img is None:
        return "ERROR_NO_IMAGE"
        
    ocr_results = reader.readtext(img)
    text_content = " ".join([text for (bbox, text, prob) in ocr_results]).lower()
    
    # Determine screen based on text heuristics
    if "search messages" in text_content or "unread" in text_content:
        return "MESSAGING_INBOX"
    elif "write a message" in text_content or "new message" in text_content:
        return "MESSAGING_COMPOSE"
    elif "invites" in text_content or "connections" in text_content:
        return "MY_NETWORK"
    elif "profile viewers" in text_content or "analytics" in text_content:
        return "PROFILE"
    elif "search" in text_content and "results" in text_content:
        return "SEARCH_RESULTS"
    elif "notifications" in text_content and "earlier" in text_content:
        return "NOTIFICATIONS"
    elif "home" in text_content and "network" in text_content and "jobs" in text_content:
        return "HOME_FEED"
    else:
        return "UNKNOWN: " + text_content[:100]

results = {}
for name, scheme, app_link in links:
    # Reset to home feed using a known good intent
    subprocess.run(["adb", "shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "https://www.linkedin.com/feed/", "com.linkedin.android"])
    time.sleep(2)
    
    scheme_res = test_link(scheme)
    
    subprocess.run(["adb", "shell", "am", "start", "-W", "-a", "android.intent.action.VIEW", "-d", "https://www.linkedin.com/feed/", "com.linkedin.android"])
    time.sleep(2)
    
    app_link_res = test_link(app_link)
    
    results[name] = {
        "scheme": scheme_res,
        "app_link": app_link_res
    }

with open("audit_results.json", "w") as f:
    json.dump(results, f, indent=4)
