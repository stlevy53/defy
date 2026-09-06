# Card art pipeline

Goal: get one clean, straightened image per card into `src/assets/cards/<category>/<id>.<ext>`.
The game picks them up automatically (see `src/ui/cardArt.ts`) — no code change needed. Any card
without an image keeps the themed text frame as a fallback, so you can add art incrementally.

Accepted extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.

**The full set is already in** — 62 images (24 Maquis, 20 Missions + Mission back, 8 Enemy types, 8
Civilians, the Spy), sliced from the playmat photos in `Card Assets/`. What follows is how to redo or
extend it. The only image still missing is the optional face-down Enemy back (`enemy/back.jpg`).

**v0.2.2 re-scanned the 24 Maquis** from `Card Assets/New Maquis Art/` — 24 individual, upright,
full-bleed single-card scans (not a playmat sheet), so the sheet slicer below did not apply. Each was
centre-cropped to the cards' native **3:2** and resized to **1125×750** (the scans clustered at
1.475–1.531, so the crop trims only a few px — no distortion, no clipping of the corner sunbursts),
with the scan→id mapping read from each printed name banner and confirmed against `data/maquis.json`.
The Spy (`spy/spy.jpg`) was re-cropped to the same 3:2 to match. If you re-shoot Maquis the same way
(one card per scan, full frame on a plain bed), a simple centre-crop-to-3:2 + resize is all you need.

---

## 1. Photograph the cards for reliable auto-slicing

The slicer segments cards by **texture**: a playmat or poster board is featureless while every part of
a card carries art, text or a border. Dark art on a black mat is therefore fine — what matters is
that the background is smooth and unpatterned.

- **Plain, matte background.** A solid playmat or poster board is ideal. Avoid the fur blanket, wood
  grain, patterned tablecloths — any texture reads as card.
- **Gaps help but are not required.** Cards may sit nearly edge-to-edge; a blob holding several
  touching cards is cut back into single cards by measuring it against the sheet's separated ones.
- **Shoot straight down**, camera parallel to the table (a phone directly overhead). Mild rotation is
  fine — the slicer deskews it — but avoid steep angles.
- **Even light.** Some shade is tolerated (the texture threshold is local, not global), but avoid hard
  shadows and hotspot glare.
- **One category per photo**, all cards the same way up. A loose grid is easiest to map afterward.

You can do one photo per category, or a few photos each — whatever keeps cards big and well-separated.

## 2. Slice a photo into straightened crops

```
python tools/slice_cards.py <photo> <orientation> <out_dir> [--rotate 90|180|270]
```

- `<orientation>`: `landscape` for **maquis** and **missions**; `portrait` for **enemies** and
  **civilians**; `auto` gives each card the orientation it was photographed in, which is what a mixed
  sheet needs — the Spy is printed portrait and was laid among the landscape Maquis.
- `--rotate` turns the photo before detecting, for cards laid sideways or upside down to the camera.
  Slice once, open a crop, and pick the value that makes the card text upright. It also changes the
  row/column order, so read your crop-to-card mapping off the rotated `_debug.jpg`.
- Writes `crop_<row>_<col>.jpg` (top-left first, row-major) plus `_debug.jpg` (detections outlined
  and numbered) and `_mask.jpg` (what it segmented). **Always check `_debug.jpg`** — every card
  should have a tight box and nothing spurious.

If detection is off, tune (values are fractions of the whole photo):

- a card in deep shade is skipped → `--seal 0.01` forces heavier gap-closing, at the cost of possibly
  inventing a cell out of background clutter (discard those when mapping crops to IDs)
- non-card rectangles slipping in → tighten `--ar-lo/--ar-hi` (poker cards ≈ 1.4)
- something far too small or large is accepted → raise `--min-area`, lower `--max-area`

The art now in the game came from these commands, run from the repo root:

```
python tools/slice_cards.py "Card Assets/Maquis.jpg"        auto .slice_out/maquis1 --rotate 270
python tools/slice_cards.py "Card Assets/Maquis 2.jpg"      auto .slice_out/maquis2 --rotate 180
python tools/slice_cards.py "Card Assets/Missions.jpg"      auto .slice_out/miss1
python tools/slice_cards.py "Card Assets/Missions 2.jpg"    auto .slice_out/miss2
python tools/slice_cards.py "Card Assets/Missions 3.jpg"    auto .slice_out/miss3
python tools/slice_cards.py "Card Assets/Enemy Cards.jpg"   auto .slice_out/enemy1 --rotate 270
python tools/slice_cards.py "Card Assets/Enemy Cards 2.jpg" auto .slice_out/enemy2
python tools/slice_cards.py "Card Assets/Civilians.jpg"     auto .slice_out/civ
```

## 3. Rename crops to card IDs and drop them in

Match each crop to its card (the name is printed on the card) and move it to the right folder using
the ID as the filename, e.g. `crop_00_02.jpg` → `src/assets/cards/maquis/soledad.jpg`.

### maquis/ (24 — one image per card; it shows both Hidden + Revealed halves)
`celia, pilar, soledad, emilio, abel, domingo, manuela, anastasio, nicolas, roberto, benigno,
carlos, adolfo, marcelino, adela, sagrario, consuelo, antonio, jacinto, manuel, ramona, paquita,
ricardo, juana`

### mission/ (20 + back)
- Era 1: `barracks, border, mountain_pass, valley, railroad_bridge, officer, villa, bunker`
- Era 2: `supply_convoy, prison, cg_headquarters, caves, farmhouse_e2, train_depot_e2`
- Era 3: `farmhouse_e3, train_depot_e3, crossroads, police_station, mayor_house, franco_hq`
- `back` — the printed Mission card back, shown when a Mission fails and stays in the row face-down.

### enemy/ (8 — one per *type*; copies differ only in the Defense number, which the app overlays)
`counter_guerrilla, military, guard, grunt, spy_master, jailor, engineer, radio_operator`
- Optional: `back` (the face-down Enemy card back) → `enemy/back.jpg`

### civilian/ (8 — the 1s/2s are interchangeable, any crop works for each)
`civ_0, civ_1a, civ_1b, civ_1c, civ_2a, civ_2b, civ_2c, civ_3`

### spy/ (1)
`spy` — landscape like the Maquis, but its name banner sits top-left rather than centred, so it is easy
to mistake for a portrait card when it comes off the slicer sideways. Turn the crop until the figure
stands upright and "SPY" reads left-to-right.

## 4. Verify

```
npm run build   # tsc + vite; confirms images bundle
npm run dev      # eyeball them in the game
```

Cards with art render the real image with the interactive controls overlaid; everything else stays
on the themed frame until its image is added.
