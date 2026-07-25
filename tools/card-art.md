# Card art pipeline

Goal: get one clean, straightened image per card into `src/assets/cards/<category>/<id>.<ext>`.
The game picks them up automatically (see `src/ui/cardArt.ts`) — no code change needed. Any card
without an image keeps the themed text frame as a fallback, so you can add art incrementally.

Accepted extensions: `.jpg`, `.jpeg`, `.png`, `.webp`.

---

## 1. Photograph the cards for reliable auto-slicing

The auto-slicer segments cards by color-contrast against the background, so the background is what
matters most:

- **Plain, matte, contrasting background.** A solid sheet of black or dark-gray poster board is
  ideal (the cards are light/colorful). Avoid the fur blanket, wood grain, patterned tablecloths —
  any texture defeats detection.
- **Leave gaps.** ~1/2 inch of clear background between cards and from the frame edge. Cards must not
  touch or overlap.
- **Shoot straight down**, camera parallel to the table (a phone directly overhead). Mild rotation is
  fine — the slicer deskews it — but avoid steep angles.
- **Even, glare-free light.** Diffuse daylight or two side lights; no hard shadows or hotspot glare.
- **One category per photo**, all cards the same way up. A loose grid is easiest to map afterward.

You can do one photo per category, or a few photos each — whatever keeps cards big and well-separated.

## 2. Slice a photo into straightened crops

```
python tools/slice_cards.py <photo> <orientation> <out_dir>
```

- `<orientation>`: `landscape` for **maquis** and **missions**; `portrait` for **enemies**,
  **civilians**, and the **spy**.
- Writes `crop_<row>_<col>.jpg` (top-left first, row-major) plus `_debug.jpg` (detections outlined
  and numbered) and `_mask.jpg` (what it segmented). **Always check `_debug.jpg`** — every card
  should have a tight box and nothing spurious.

If detection is off, tune (values are fractions of the whole photo):

- missing cards / merged blobs → raise `--min-area`, lower `--max-area`
- background picked up as cards → check the background is plain; raise `--min-area`
- non-card rectangles slipping in → tighten `--ar-lo/--ar-hi` (poker cards ≈ 1.4)

Example:

```
python tools/slice_cards.py photos/maquis.jpg landscape .slice_out/maquis --min-area 0.01
```

## 3. Rename crops to card IDs and drop them in

Match each crop to its card (the name is printed on the card) and move it to the right folder using
the ID as the filename, e.g. `crop_00_02.jpg` → `src/assets/cards/maquis/soledad.jpg`.

### maquis/ (24 — one image per card; it shows both Hidden + Revealed halves)
`celia, pilar, soledad, emilio, abel, domingo, manuela, anastasio, nicolas, roberto, benigno,
carlos, adolfo, marcelino, adela, sagrario, consuelo, antonio, jacinto, manuel, ramona, paquita,
ricardo, juana`

### mission/ (20)
- Era 1: `barracks, border, mountain_pass, valley, railroad_bridge, officer, villa, bunker`
- Era 2: `supply_convoy, prison, cg_headquarters, caves, farmhouse_e2, train_depot_e2`
- Era 3: `farmhouse_e3, train_depot_e3, crossroads, police_station, mayor_house, franco_hq`

### enemy/ (8 — one per *type*; copies differ only in the Defense number, which the app overlays)
`counter_guerrilla, military, guard, grunt, spy_master, jailor, engineer, radio_operator`
- Optional: `back` (the face-down Enemy card back) → `enemy/back.jpg`

### civilian/ (8 — the 1s/2s are interchangeable, any crop works for each)
`civ_0, civ_1a, civ_1b, civ_1c, civ_2a, civ_2b, civ_2c, civ_3`

### spy/ (1)
`spy`

## 4. Verify

```
npm run build   # tsc + vite; confirms images bundle
npm run dev      # eyeball them in the game
```

Cards with art render the real image with the interactive controls overlaid; everything else stays
on the themed frame until its image is added.
