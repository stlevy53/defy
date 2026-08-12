"""Detect, deskew and crop individual cards out of a photographed card sheet.

Usage:
    python tools/slice_cards.py <sheet.jpg> <orientation> <out_dir> [--rotate 90] [--min-area 0.006]

orientation: "landscape" (maquis / missions), "portrait" (enemies / civilians), or "auto"
to give each card the orientation it was photographed in (use for a mixed sheet).

--rotate turns the whole photo before detecting, for cards laid sideways to the camera;
pick the value that makes the card text upright in the crops.

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

ROTATIONS = {
    90: cv2.ROTATE_90_CLOCKWISE,
    180: cv2.ROTATE_180,
    270: cv2.ROTATE_90_COUNTERCLOCKWISE,
}


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


def bilerp(corners: np.ndarray, u: float, v: float) -> np.ndarray:
    """Point at (u, v) in [0,1]^2 across a quad ordered tl, tr, br, bl."""
    tl, tr, br, bl = corners
    return (tl + (tr - tl) * u) + ((bl + (br - bl) * u) - (tl + (tr - tl) * u)) * v


def subdivide(corners: np.ndarray, unit_short: float, unit_long: float, ar_lo: float, ar_hi: float):
    """Cut a blob holding several touching cards into one quad per card.

    Cards laid edge-to-edge merge into a single blob that no amount of eroding will separate,
    so we measure the blob against the card size taken from this sheet's cleanly separated
    cards and cut it into that many pieces.
    """
    span_x = np.linalg.norm(corners[1] - corners[0])
    span_y = np.linalg.norm(corners[3] - corners[0])
    best = None
    for ux, uy in ((unit_long, unit_short), (unit_short, unit_long)):
        kx, ky = max(1, round(span_x / ux)), max(1, round(span_y / uy))
        err = abs(span_x - kx * ux) / ux + abs(span_y - ky * uy) / uy
        if best is None or err < best[0]:
            best = (err, kx, ky)
    err, kx, ky = best
    if err > 0.35:  # not a whole number of cards — likely background clutter
        return []
    out = []
    for i in range(ky):
        for j in range(kx):
            u0, u1 = j / kx, (j + 1) / kx
            v0, v1 = i / ky, (i + 1) / ky
            cell = np.array([bilerp(corners, u0, v0), bilerp(corners, u1, v0),
                             bilerp(corners, u1, v1), bilerp(corners, u0, v1)], dtype="float32")
            w, h = np.linalg.norm(cell[1] - cell[0]), np.linalg.norm(cell[3] - cell[0])
            if not w or not h:
                continue
            ar = max(w, h) / min(w, h)
            if ar_lo <= ar <= ar_hi:
                out.append(cell)
    return out


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


def odd(n: int, floor: int = 3) -> int:
    return max(floor, int(n) | 1)


def texture_mask(img: np.ndarray) -> np.ndarray:
    """Segment cards from background on local texture (rolling standard deviation).

    A playmat or poster board is featureless while every part of a card carries art, text or a
    border, so this holds up where colour-distance fails — dark night-scene art on a black mat
    reads as background to a colour threshold but as texture here.
    """
    h, w = img.shape[:2]
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY).astype(np.float32)
    k = odd(0.006 * min(h, w), 9)
    mean = cv2.boxFilter(gray, -1, (k, k))
    sq = cv2.boxFilter(gray * gray, -1, (k, k))
    sd = np.clip(np.sqrt(np.clip(sq - mean * mean, 0, None)), 0, 255).astype(np.uint8)
    # Compare each pixel's texture against its neighbourhood rather than one global level: a sheet
    # is rarely lit evenly, and a card in shade carries real but faint texture that a global
    # threshold set by the well-lit cards throws away. An absolute floor keeps the local test from
    # promoting sensor noise on bare background.
    level, _ = cv2.threshold(sd, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    block = odd(0.1 * min(h, w))
    local = cv2.adaptiveThreshold(sd, 255, cv2.ADAPTIVE_THRESH_MEAN_C, cv2.THRESH_BINARY,
                                  block, -max(2.0, level * 0.15))
    mask = cv2.bitwise_and(local, (sd > max(3.0, level * 0.35)).astype(np.uint8) * 255)
    return cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((odd(0.002 * min(h, w)),) * 2, np.uint8))


def fill_blobs(mask: np.ndarray, seal_frac: float) -> np.ndarray:
    """Close gaps at the given strength, then solidify each blob by filling its outer contour."""
    seal = odd(seal_frac * min(mask.shape[:2]))
    sealed = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((seal, seal), np.uint8))
    outer, _ = cv2.findContours(sealed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    filled = np.zeros_like(sealed)
    cv2.drawContours(filled, outer, -1, 255, thickness=cv2.FILLED)
    return filled


def coverage(mask: np.ndarray, quad: np.ndarray) -> float:
    """Fraction of a quad's area that segmented as card — near 1 for a card, low for background."""
    x, y, w, h = cv2.boundingRect(quad.astype(np.int32))
    x, y = max(x, 0), max(y, 0)
    sub = mask[y:y + h, x:x + w]
    if sub.size == 0:
        return 0.0
    poly = np.zeros(sub.shape, np.uint8)
    cv2.fillPoly(poly, [(quad - [x, y]).astype(np.int32)], 255)
    inside = poly > 0
    return float((sub[inside] > 0).mean()) if inside.any() else 0.0


def find_quads(mask: np.ndarray, solid: np.ndarray, seal_frac: float, min_area_frac: float,
               max_area_frac: float, ar_lo: float, ar_hi: float):
    """Card quads from a texture mask at one sealing strength. See detect() for the search."""
    h, w = mask.shape[:2]
    img_area = h * w
    # Seal breaks, then flood the interiors: a flat area inside a card (blank text box, glare)
    # segments as background, and a card in shade comes through as a broken outline that has to be
    # closed before it will fill. Sealing may merge neighbours; subdivide() separates them again.
    filled = fill_blobs(mask, seal_frac)
    # Cards laid with only a sliver of mat between them come through as one blob, so pull the
    # blobs apart before measuring and give each rectangle the eroded margin back afterwards.
    r = max(1, int(0.006 * min(h, w)))
    split = cv2.erode(filled, np.ones((2 * r + 1, 2 * r + 1), np.uint8))
    cnts, _ = cv2.findContours(split, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    def sides(q):
        return np.linalg.norm(q[1] - q[0]), np.linalg.norm(q[3] - q[0])

    blobs = []
    for c in cnts:
        rect = cv2.minAreaRect(c)  # rotated bounding rect -> deskews the card's rotation
        (rw, rh) = rect[1]
        if not rw or not rh or cv2.contourArea(c) / (rw * rh) < 0.72:  # a card fills its rect
            continue
        blobs.append(order_pts(cv2.boxPoints((rect[0], (rw + 2 * r, rh + 2 * r), rect[2]))))

    blobs = [q for q in blobs if min(sides(q)) > 0]  # corner ordering can collapse a degenerate blob
    # One card per blob is the common case; those give the card size used to cut the merged ones.
    singles = [q for q in blobs if ar_lo <= max(sides(q)) / min(sides(q)) <= ar_hi
               and min_area_frac * img_area <= sides(q)[0] * sides(q)[1] <= max_area_frac * img_area]
    if not singles:
        return []
    unit_short = float(np.median([min(sides(q)) for q in singles]))
    unit_long = float(np.median([max(sides(q)) for q in singles]))

    quads = []
    for blob in blobs:
        for q in subdivide(blob, unit_short, unit_long, ar_lo, ar_hi):
            if min_area_frac * img_area <= sides(q)[0] * sides(q)[1] <= max_area_frac * img_area \
                    and coverage(solid, q) >= 0.85:
                quads.append(q)
    return dedupe(quads)


# How hard to close gaps in the mask, weakest first. Sheets differ: cards nearly touching need a
# light touch to stay separate, a card in shade needs a heavy one to fill at all.
SEAL_LADDER = (0.002, 0.004, 0.007, 0.010)


def detect(img: np.ndarray, min_area_frac: float, max_area_frac: float, ar_lo: float, ar_hi: float,
           seal: float = 0.0):
    """Return the card quads found in the image, plus the mask they were found from.

    Runs the search at each sealing strength and keeps whichever found the most cards, so one
    command works across sheets shot with different spacing and lighting. Pass an explicit seal
    to force one strength — needed for a sheet with cards in deep shade, where the outline only
    closes under heavy sealing that also lets some background through for you to discard by eye.
    """
    mask = texture_mask(img)
    ladder = (seal,) if seal else SEAL_LADDER
    # Candidate cards are checked against blobs sealed only lightly, so a cell that a heavy seal
    # invented out of background (a mat edge, the table) fails while a real card still passes.
    solid = fill_blobs(mask, seal or SEAL_LADDER[0])
    best = []
    for seal_frac in ladder:
        quads = find_quads(mask, solid, seal_frac, min_area_frac, max_area_frac, ar_lo, ar_hi)
        if len(quads) > len(best):
            best = quads
    return best, solid


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
    ap.add_argument("orientation", choices=["landscape", "portrait", "auto"])
    ap.add_argument("out_dir")
    ap.add_argument("--rotate", type=int, choices=[0, 90, 180, 270], default=0,
                    help="turn the photo this many degrees clockwise before detecting")
    ap.add_argument("--seal", type=float, default=0.0,
                    help="force one gap-closing strength (fraction of the photo, e.g. 0.01) instead "
                         "of picking the best automatically; use for cards shot in deep shade")
    ap.add_argument("--min-area", type=float, default=0.006, help="min card area as fraction of the photo")
    ap.add_argument("--max-area", type=float, default=0.30, help="max card area as fraction of the photo")
    ap.add_argument("--ar-lo", type=float, default=1.2, help="min long/short side ratio (poker card ~1.4)")
    ap.add_argument("--ar-hi", type=float, default=1.7, help="max long/short side ratio")
    args = ap.parse_args()

    img = cv2.imread(args.sheet)
    if img is None:
        sys.exit(f"could not read {args.sheet}")
    if args.rotate:
        img = cv2.rotate(img, ROTATIONS[args.rotate])
    os.makedirs(args.out_dir, exist_ok=True)

    quads, mask = detect(img, args.min_area, args.max_area, args.ar_lo, args.ar_hi, args.seal)
    scale = 1400 / img.shape[1]
    cv2.imwrite(os.path.join(args.out_dir, "_mask.jpg"), cv2.resize(mask, None, fx=scale, fy=scale))
    rows = row_major(quads)

    debug = img.copy()
    n = 0
    for ri, row in enumerate(rows):
        for ci, (quad, ctr) in enumerate(row):
            pts = order_pts(quad)
            wide = np.linalg.norm(pts[1] - pts[0]) >= np.linalg.norm(pts[3] - pts[0])
            out_w, out_h = SIZES["landscape" if wide else "portrait"] if args.orientation == "auto" \
                else SIZES[args.orientation]
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
