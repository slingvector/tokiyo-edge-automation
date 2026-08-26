from fastapi import FastAPI
from pydantic import BaseModel
import uvicorn
from androguard.core.apk import APK
import base64
import cv2
import numpy as np
import easyocr

# Initialize EasyOCR reader once (downloads models on first run if missing)
reader = easyocr.Reader(['en'])

app = FastAPI(title="Tokiyo APK Analyzer")

class AnalyzeRequest(BaseModel):
    apk_path: str

@app.post("/analyze")
def analyze_apk(req: AnalyzeRequest):
    try:
        print(f"Analyzing APK: {req.apk_path}")
        a = APK(req.apk_path)
        
        deep_links = []
        
        activities = a.get_activities()
        
        for activity in activities:
            filters = a.get_intent_filters("activity", activity)
            
            if filters:
                if "action" in filters and "android.intent.action.VIEW" in filters["action"]:
                    # It's a deep link!
                    deep_links.append({
                        "activity": activity,
                        "intent_filters": filters
                    })
        
        print(f"Found {len(deep_links)} deep links.")
        return {
            "package_name": a.get_package(),
            "version_name": a.get_androidversion_name(),
            "deep_links": deep_links
        }
    except Exception as e:
        print(f"Error: {e}")
        return {"error": str(e)}

class UnmergeRequest(BaseModel):
    image_base64: str
    target_text: str
    bbox: list[int] = None # [left, top, right, bottom]

@app.post("/unmerge")
def unmerge_compose(req: UnmergeRequest):
    try:
        print(f"Unmerging request for target: {req.target_text}")
        img_data = base64.b64decode(req.image_base64)
        np_arr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(np_arr, cv2.IMREAD_COLOR)
        
        if img is None:
            return {"error": "Failed to decode image"}
            
        # Crop the image if bbox is provided
        offset_x, offset_y = 0, 0
        if req.bbox and len(req.bbox) == 4:
            l, t, r, b = req.bbox
            img = img[t:b, l:r]
            offset_x = l
            offset_y = t
            
        # Run EasyOCR
        results = reader.readtext(img)
        
        for (bbox, text, prob) in results:
            if req.target_text.lower() in text.lower():
                # bbox is a list of 4 points: [top-left, top-right, bottom-right, bottom-left]
                # Calculate center relative to crop
                tl = bbox[0]
                br = bbox[2]
                center_x = int((tl[0] + br[0]) / 2)
                center_y = int((tl[1] + br[1]) / 2)
                
                # Add offset back
                abs_x = center_x + offset_x
                abs_y = center_y + offset_y
                
                print(f"Found '{text}' at absolute ({abs_x}, {abs_y}) with prob {prob}")
                return {
                    "found": True,
                    "x": abs_x,
                    "y": abs_y,
                    "text": text,
                    "confidence": prob
                }
                
        return {"found": False, "error": "Target text not found in image crop"}
    except Exception as e:
        print(f"Error in unmerge: {e}")
        return {"error": str(e)}

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8082)
