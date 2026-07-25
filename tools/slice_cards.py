"""Detect, deskew and crop individual cards out of a photographed card sheet.

Usage:
    python tools/slice_cards.py <sheet.jpg> <orientation> <out_dir> [--min-area 0.006] [--rows N]

orientation: "landscape" (maquis / missions) or "portrait" (enemies / civilians).

For each detected card it finds the 4 corners, perspective-corrects it to a straight
rectangle, and writes crop_<row>_<col>.jpg (row-major order, top-left first). It also
writes _debug.jpg — the sheet with every detection outlined and numbered — so the crops
can be eyeballed and the params tuned before mapping filenames to card IDs.
"""

import argparse
import os
import sys

import cv2
import numpy as np

# Canonical output sizes (poker card ratio 2.5 x 3.5).
SIZES = {"landscape": (1050, 750), "portrait": (750, 1050)}


def order_pts(pts: np.ndarray) -> np.ndarray:
    """Order 4 points as top-left, top-right, bottom-right, bottom-left."""
    pts = pts.astype("float32")
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    d = np.diff(pts, axis=1).ravel()
    rect[0] = pts[np.argmin(s)]  # tl
    rect[2] = pts[np.argmax(s)]  # br
    rect[1] = pts[np.argmin(d)]  # tr
    rect[3] = pts[np.argmax(d)]  # bl
    return rect


def warp(img: np.ndarray, quad: np.ndarray, out_w: int, out_h: int) -> np.ndarray:
    rect = order_pts(quad)
    dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]], dtype="float32")
    m = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(img, m, (out_w, out_h))


def dedupe(quads, dist_frac=0.4):
    """Drop near-duplicate quads (inner/outer border loops of the same card) by centre proximity."""
    kept = []
    for q in quads:
        c = q.mean(axis=0)
        side = np.sqrt(cv2.contourArea(q.astype("float32")))
        if any(np.linalg.norm(c - k.mean(axis=0)) < dist_frac * side for k in kept):
            continue
        kept.append(q)
    return kept


def detect(img: np.ndarray, min_area_frac: float, max_area_frac: float, ar_lo: float, ar_hi: float):
    """Return a list of 4x2 card quads found in the image.

    Cards are far more colour-saturated than the drab fur/couch background, so we segment
    on the HSV saturation channel (plus bright highlights) rather than edges, which avoids
    the textured background bleeding into giant false contours.
    """
    h, w = img.shape[:2]
    img_area = h * w
    # Assumes cards shot flat on a PLAIN, contrasting background (see tools/card-art.md). Sample the
    # background colour from a ring around the border, then threshold on colour-distance from it —
    # against a uniform backdrop this is cleanly bimodal, so each card pops out as one solid blob.
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB).astype(np.float32)
    b = max(2, int(0.02 * min(h, w)))
    ring = np.ones((h, w), bool)
    ring[b:h - b, b:w - b] = False
    bg = np.median(lab[ring], axis=0)
    dist = np.sqrt(((lab - bg) ** 2).sum(axis=2))
    dist = np.minimum(dist, 255).astype(np.uint8)
    dist = cv2.GaussianBlur(dist, (5, 5), 0)
    _, mask = cv2.threshold(dist, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((7, 7), np.uint8), iterations=2)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8), iterations=2)
    cnts, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    quads = []
    for c in cnts:
        area = cv2.contourArea(c)
        if area < min_area_frac * img_area or area > max_area_frac * img_area:
            continue
        rect = cv2.minAreaRect(c)  # rotated bounding rect -> deskews the card's rotation
        (rw, rh) = rect[1]
        if not rw or not rh:
            continue
        ar = max(rw, rh) / min(rw, rh)
        fill = area / (rw * rh)  # a real card fills its bounding rect; noise/L-shapes don't
        if not (ar_lo <= ar <= ar_hi) or fill < 0.72:
            continue
        quads.append(cv2.boxPoints(rect))
    return dedupe(quads), mask


def row_major(quads, row_tol_frac=0.5):
    """Sort quads top-to-bottom then left-to-right, grouping into rows."""
    if not quads:
        return []
    centers = [q.mean(axis=0) for q in quads]
    heights = [np.linalg.norm(order_pts(q)[0] - order_pts(q)[3]) for q in quads]
    row_tol = np.median(heights) * row_tol_frac
    items = sorted(zip(quads, centers), key=lambda z: z[1][1])
    rows, cur, cur_y = [], [], None
    for q, ctr in items:
        if cur_y is None or abs(ctr[1] - cur_y) <= row_tol:
            cur.append((q, ctr))
            cur_y = ctr[1] if cur_y is None else (cur_y + ctr[1]) / 2
        else:
            rows.append(cur)
            cur, cur_y = [(q, ctr)], ctr[1]
    if cur:
        rows.append(cur)
    for r in rows:
        r.sort(key=lambda z: z[1][0])
    return rows


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("sheet")
    ap.add_argument("orientation", choices=["landscape", "portrait"])
    ap.add_argument("out_dir")
    ap.add_argument("--min-area", type=float, default=0.006, help="min card area as fraction of the photo")
    ap.add_argument("--max-area", type=float, default=0.30, help="max card area as fraction of the photo")
    ap.add_argument("--ar-lo", type=float, default=1.2, help="min long/short side ratio (poker card ~1.4)")
    ap.add_argument("--ar-hi", type=float, default=1.7, help="max long/short side ratio")
    args = ap.parse_args()

    img = cv2.imread(args.sheet)
    if img is None:
        sys.exit(f"could not read {args.sheet}")
    os.makedirs(args.out_dir, exist_ok=True)

    quads, mask = detect(img, args.min_area, args.max_area, args.ar_lo, args.ar_hi)
    scale = 1400 / img.shape[1]
    cv2.imwrite(os.path.join(args.out_dir, "_mask.jpg"), cv2.resize(mask, None, fx=scale, fy=scale))
    rows = row_major(quads)
    out_w, out_h = SIZES[args.orientation]

    debug = img.copy()
    n = 0
    for ri, row in enumerate(rows):
        for ci, (quad, ctr) in enumerate(row):
            crop = warp(img, quad, out_w, out_h)
            cv2.imwrite(os.path.join(args.out_dir, f"crop_{ri:02d}_{ci:02d}.jpg"), crop, [cv2.IMWRITE_JPEG_QUALITY, 92])
            cv2.polylines(debug, [quad.astype(int)], True, (0, 0, 255), 4)
            cv2.putText(debug, f"{ri},{ci}", tuple(ctr.astype(int)), cv2.FONT_HERSHEY_SIMPLEX, 1.4, (0, 255, 0), 3)
            n += 1

    dbg_path = os.path.join(args.out_dir, "_debug.jpg")
    scale = 1400 / debug.shape[1]
    cv2.imwrite(dbg_path, cv2.resize(debug, None, fx=scale, fy=scale), [cv2.IMWRITE_JPEG_QUALITY, 85])
    print(f"{os.path.basename(args.sheet)}: detected {n} cards in {len(rows)} rows -> {args.out_dir}")
    print(f"rows: {[len(r) for r in rows]}")


if __name__ == "__main__":
    main()
