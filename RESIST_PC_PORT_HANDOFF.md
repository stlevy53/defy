# Resist! — PC Port Project Handoff

Context for a new conversation. Goal: build a PC (digital) version of the physical solitaire card game **Resist!** (Salt & Pepper Games / Studio Supernova, 2022; designers Trevor Benjamin, Roger Tankersley, David Thompson; illustrator Albert Monteys).

Source materials live in the user's connected folder: `Card Assets/` (7 photographed sheets of the physical cards) and `Resist_Rulebook_English_v4_(1).pdf` (official 16-page rulebook). A YouTube "full teach + visuals" walkthrough was also reviewed (transcript captured below; live video playback was unwatchable in-session due to streaming stalls, so the transcript + chapter thumbnails were used instead).

Everything below was verified directly — rulebook was OCR'd/extracted in full, every card-sheet image was visually inspected at full resolution and confirmed legible, and the video transcript was pulled via YouTube's caption panel.

---

## 1. Asset status — no reshoots needed

All 7 images in `Card Assets/` are phone photos of the physical cards laid out on a rug/couch, at 2560×1920 (or 1920×2560) resolution. At full resolution every card's name, hidden/revealed stats, action-type labels (PLAN/ATTACK/DEFEND/DEFEAT/SURVIVE), icon values, and body rules-text are crisp and readable — verified by zooming 3–4x into individual cards. **No new photos are required**; all card text/values can be transcribed directly from these images.

Files and what each contains:
- `Maquis Cards.jpg` — 24 Maquis character cards (Celia, Pilar, Soledad, Emilio, Anastasio, Manuela, Benigno, Adela, Jacinto, Ricardo, Domingo, Roberto, Marcelino, Antonio, Paquita, Abel, Nicolás, Adolfo, Consuelo, Ramona, and others — 24 total), each with Hidden side (name/art/value/action) and Revealed side (name/art/value/action).
- `Era 1 Cards.jpg`, `Era 2 Cards.jpg`, `Era 3 Cards.jpg` — Mission cards, 8 photographed per sheet (20 used in-game after setup removes some; see rules below), each showing: title, era label, DEFEND/DEFEAT keyword + effect text, and three stat icons (Defense value, Garrison/enemy-count value, Victory Point value — icons are card-back/skull/laurel per the rulebook's component key).
- `Civilian Cards.jpg` — 8 Civilian cards, each labeled "N Civilian(s)" (0, 1, 1, 1, 2, 2, 2, 3 seen across the sheet), plus a special "0 Civilians — shuffle back in, don't replace" card.
- `Spy Cards.jpg` — 6 Spy cards (dead-weight cards that clog the deck; no text/action, just "SPY" label + art).
- `Enemy Cards.jpg` — 33 Enemy cards photographed (rulebook says 32 total in the physical game) — types seen: Counter-Guerrilla, Military, Jailor, Guard, Grunt, Spy Master, Engineer, Radio Operator — each with a Defense value and a DEFEND/DEFEAT/SURVIVE keyword + effect.

Note: card counts visible in photos vs. rulebook's stated component counts should be cross-checked once transcribing (e.g., Enemy sheet shows 33 not 32) in case of a miscount or a duplicate in frame — flagged but not yet resolved.

The rulebook PDF is a native InDesign export (not scanned), so all rules text extracts cleanly via `pdftotext`; no OCR needed there either.

---

## 2. Game mechanics — full rules (from rulebook)

**Genre**: solitaire (single-player, no AI opponent needed), card-driven, deck-destruction. ~30 min playtime.

**Theme**: Spanish Maquis resistance fighters vs. Franco's regime, post-Spanish-Civil-War.

### Components
- 24 Maquis cards, 6 Spy cards, 20 Mission cards (in play; rulebook says 4+3+3 removed from a larger pool during setup — see below), 32 Enemy cards, 8 Civilian cards, 1 player aid.

### Setup
1. **Maquis**: Shuffle 24 Maquis, divide into 2 equal 12-card face-down decks — one designated **Hidden deck** (left side of play area, with space for a face-up Hidden discard pile), one designated **Recruit deck** (right side, with space for a face-up Revealed pile). Recommended alternative: **draft** — reveal top 2 cards at a time, choose one for Hidden deck, one for Recruit deck, repeat until 12/12, then shuffle each separately.
2. **Spies**: Shuffle 3 of the 6 Spy cards into the Hidden deck. Remaining 3 spies sit face-up near the play area (available to add via certain effects).
3. **Missions**: Sort 20 Mission cards by Era (1/2/3), shuffle each era separately. Remove 4 cards from Era 1, 3 from Era 2, 3 from Era 3 — set these aside/back in box (not used this game). Flip the remaining 4 Era-1 cards face-up in a row = the initial **Available Missions**. Stack remaining Era-2 cards on top of remaining Era-3 cards face-down = the **Mission deck** (drawn from as missions are defeated). Leave space for a face-up **Defeated Missions** pile.
4. **Enemies**: Shuffle 32 Enemy cards. Deal face-down Enemy cards next to each Available Mission, count equal to that Mission's **Garrison value**. Remaining enemies = face-down **Enemy deck**; leave space for face-up **Enemy discard pile**.
5. **Civilians**: Shuffle 8 Civilian cards face-down = **Civilian deck**; leave space for a face-up **Graveyard**.
6. **Starting hand**: Draw 5 cards from the Hidden deck.

### Round structure (4 phases, in strict order)
**1. PLAN**
 A) Play any number of Maquis from hand, choosing **hidden** or **revealed** persona for each (revealed = stronger stats but discarded at end of round; hidden = weaker but recycles through the deck). May execute the card's PLAN action if its action-type matches (PLAN or PLAN/ATTACK). Actions must be performed in full or not at all (no partial execution) and are never mandatory.
 B) Choose one Available Mission to attack this round. Flip any remaining face-down Enemies at that Mission face-up.

**2. ATTACK**
 A) DEFEND effects on the chosen Mission and its Enemies trigger (e.g., "must defeat Guard before Mission").
 B) Play remaining Maquis from hand, executing ATTACK actions if applicable. **All Maquis in hand must be played this round** (no holding cards for later) — this includes cards drawn mid-round from actions.
 C) **Defeat Targets**: Sum Attack value across all played Maquis this round (Hidden Attack value for hidden Maquis, Revealed Attack value for revealed Maquis) = **Attack Strength**. Spend Attack Strength one Target at a time (Mission or any Enemy at it) — defeating a target costs Attack Strength equal to its Defense value. Defeated Enemies → face-up Enemy discard; defeated Mission → face-up Defeated Missions pile (scores its Victory Points). DEFEAT effects trigger immediately on defeat; DEFEND effects on a defeated target become inactive. Any leftover Attack Strength is lost (no banking). Undefeated Enemies: resolve SURVIVE effects, then discard.

**3. AFTERMATH**
 A) Check Civilian losses: if total civilians shown on cards in the Graveyard ≥ 5 → **lose the game immediately**.
 B) Mission outcome: if Mission was defeated → draw new Mission from Mission deck to refill the row (if any left), deal it Enemy cards equal to its Garrison (reshuffle Enemy discard into a new deck if needed). If Mission was NOT defeated → flip it face-down, do not replace it (permanently one fewer Available Mission slot); if this is the **2nd failed Mission** → **lose the game immediately**.
 C) Decide: **end the resistance** (go straight to scoring/game end) or **continue** (go to Recover phase). Must end if there are no Available Missions left.

**4. RECOVER**
 A) Cleanup: revealed Maquis played this round → face-up Revealed discard pile. Hidden Maquis played + any Spy cards in hand → face-up Hidden discard pile.
 B) Draw new hand of 5 from Hidden deck (reshuffle Hidden discard into new deck if it runs out; if both empty, draw fewer than 5).
 C) Check Spy loss: if the new hand is **all Spies** → **lose the game immediately**. Otherwise, start next round at PLAN.

### Loss conditions (any one ends the game as a loss, no score)
1. Fail 2 Missions.
2. 5+ civilians dead (Graveyard total).
3. Draw a hand of all Spies during Recover.

### Win / scoring (only if player voluntarily ends the resistance, undefeated)
Sum Victory Points on Defeated Missions pile, map to result tier:
- Defeat all 10 (wait — text says up to Epic at "Defeat all missions") → **Epic Victory**
- 22+ → **Major Victory**
- 19–21 → **Victory**
- 15–18 → **Minor Victory**
- 1–14 → **Draw**

(Note: rulebook table's top row literally says "Defeat all missions" for Epic Victory, distinct from a point threshold — worth re-reading the PDF table directly during implementation to get this exactly right, since text extraction flattened the table structure a bit.)

### Effect timing types (on Missions and Enemies)
- **DEFEND** — triggers at start of Attack phase (while still undefeated/in play at the chosen Mission).
- **DEFEAT** — triggers only if the card is defeated in combat (not if merely discarded/removed by another effect).
- **SURVIVE** — triggers if the card is NOT defeated by end of Attack phase.
- Multiple simultaneous triggers: player chooses resolution order.

### Key rules-lawyer clarifications (from rulebook FAQ)
- Running out of cards to draw: reshuffle the relevant discard pile into a new deck first; if still short, draw as many as possible.
- "Discard" ≠ "Defeat" — discarding an Enemy does NOT trigger its DEFEAT effect.
- "Remove from the game" = goes back in the box, not to any discard pile.
- "In play" = played face-up in front of the player this round only; Maquis leave play during Recover cleanup.
- Any card drawn mid-round (from an effect) must also be played that same round.
- Getting Maquis back from the Recruit deck is rare: only via defeating an Enemy Jailor, defeating the "Jailbreak at the Prison" Mission, or specific Maquis actions (Antonio, Ramona revealed actions).
- You never have to defeat every Enemy at a Mission — often you can't, and choosing what to sacrifice is the core decision.
- Attack Strength is totaled across ALL Maquis played that round (both Plan and Attack phase plays) before being spent target-by-target — not assigned card-by-card.

A full worked example-of-play (first round, turn-by-turn) is in the rulebook and was extracted — useful as a reference/test case for validating game logic once coded. Available on request from the source PDF (`Resist_Rulebook_English_v4_(1).pdf`, pages ~11–13) if needed for unit-testing the rules engine.

---

## 3. Physical table layout (confirmed via rulebook diagram + video transcript)

This is the intended spatial layout to mirror in the digital UI:

- **Left column**: Hidden deck (face-down draw pile) → Hidden discard pile beneath it. Maquis played as "hidden" this round sit in a left-side play zone.
- **Right column**: Recruit deck (face-down, inactive Maquis) → Revealed pile beside it. Maquis played as "revealed" this round sit in a right-side play zone.
- **Center row**: Available Missions face-up side by side, each with its Enemy cards arranged in two columns directly above it (count = Mission's Garrison value, face-down until revealed).
- **Off to the side**: face-down Mission deck (refill source), Civilian deck + face-up Graveyard, Enemy deck + face-up Enemy discard pile.
- **Player's hand/play area**: in front of the player, 5 cards drawn each round, fanned out before being committed left (hidden) or right (revealed).

Setup sequence detail (draft variant, as narrated in video): reveal 2 Maquis at a time, keep one toward the Hidden-deck pile (left), send the other toward the Recruit-deck pile (right); repeat for all 12 pairs; shuffle each pile separately afterward.

This maps cleanly to a standard digital solitaire-tableau layout: two side rails (Hidden/Recruit + their discards), a center strip of Mission+Enemy clusters, and a bottom hand tray — nothing exotic needed for a first UI pass.

---

## 4. Open items / not yet resolved
- Card-count discrepancy: Enemy sheet photo shows 33 cards, rulebook states 32 — needs reconciling when transcribing card data (possible duplicate in frame, or a miscount).
- Exact win-table thresholds should be re-verified against the rulebook PDF directly (table structure was flattened by text extraction; screenshotting/re-reading the actual table image is cheap insurance before coding scoring).
- Have not yet transcribed the full text/values of all 24 Maquis, 20 Missions, 32 Enemies, 8 Civilians into structured data (e.g., JSON) — this is the next concrete task before any coding starts.
- Haven't yet decided: engine/framework for the PC build, target platform(s), art pipeline (reuse photographed card faces vs. re-illustrate), UI framework, save/undo model, etc. — all wide open for the next conversation to scope.

---

## 5. Suggested next steps for the new conversation
1. Transcribe all card data (names, stats, text, keywords) from the 7 card-sheet photos into structured data files — this is mechanical but essential groundwork.
2. Resolve the Enemy card-count discrepancy and confirm exact win-table thresholds against the rulebook.
3. Decide tech stack for the PC build (engine, language, UI approach).
4. Design the digital tableau layout based on Section 3 above.
5. Build a rules engine and validate it against the rulebook's worked example (Section 2).
