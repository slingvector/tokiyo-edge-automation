import requests

url = "http://127.0.0.1:8082/analyze"
data = {
    "apk_path": "/Users/cortex/ventures/tokiyo-edge-automation/docs/com.linkedin.android_4.1.1227-213500_minAPI28(arm64-v8a,armeabi-v7a,x86,x86_64)(nodpi)_apkmirror.com.apk"
}

try:
    response = requests.post(url, json=data)
    result = response.json()
    print(f"Package: {result.get('package_name')}")
    print(f"Version: {result.get('version_name')}")
    print(f"Found {len(result.get('deep_links', []))} deep links.")
    
    if result.get('deep_links'):
        for i, link in enumerate(result['deep_links'][:5]):
            print(f"--- Deep Link {i+1} ---")
            print(f"Activity: {link['activity']}")
            print(f"Filters: {link['intent_filters']}")
except Exception as e:
    print(f"Request failed: {e}")
