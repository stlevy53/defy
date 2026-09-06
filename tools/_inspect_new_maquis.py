"""Inspect new Maquis scans: libs, OCR, and a first-pass slice of one card."""
from __future__ import annotations

import shutil
import sys
from pathlib import Path

print("python", sys.version)
try:
    import cv2
    print("cv2", cv2.__version__)
except Exception as e:
    print("cv2 FAIL", e)
try:
    from PIL import Image
    print("PIL ok")
except Exception as e:
    print("PIL FAIL", e)

print("tesseract.exe", shutil.which("tesseract"))
try:
    import pytesseract
    print("pytesseract", pytesseract.get_tesseract_version())
except Exception as e:
    print("no pytesseract", type(e).__name__, e)

src = Path(r"C:\Users\stephen.levy\GHRepos\DEFY!\Card Assets\New Maquis Art")
first = sorted(src.glob("*.jpg"))[0]
im = Image.open(first)
print("first", first.name, im.size)
# dump a few edge pixels to guess background
px = im.load()
w, h = im.size
corners = [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1), (w // 2, 0), (w // 2, h - 1)]
print("corner samples:", [px[x, y] for x, y in corners])
