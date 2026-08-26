import easyocr
import cv2
import sys
import os

img_path = sys.argv[1] if len(sys.argv) > 1 else 'screen.png'
img = cv2.imread(img_path)
if img is None:
    print(f"Could not load {img_path}")
    sys.exit(1)

reader = easyocr.Reader(['en'])
results = reader.readtext(img)

for (bbox, text, prob) in results:
    tl = bbox[0]
    br = bbox[2]
    center_x = int((tl[0] + br[0]) / 2)
    center_y = int((tl[1] + br[1]) / 2)
    print(f"TEXT: '{text}' at ({center_x}, {center_y}) prob: {prob:.2f}")
