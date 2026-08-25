# Lessons

Patterns worth not repeating, written down after a correction. Newest at the top.

## Coach copy lives on the table, not on the hole

**Correction:** the last tour card (Undo and Settings) sat so far right that Skip / Start playing
were off-screen. No horizontal scroll.

**What went wrong:** the card aligned to `hole.left` of the top-bar controls, then CSS `zoom` on
`<html>` pushed that coordinate past the visible window.

**Pattern:** constrain the coach card to `#root` ∩ the visible window (`innerWidth / scale`).
(`.board-main` was the table column before v0.2.0 dropped it.) A right-edge spotlight still lights
the control; the copy sits on the table so the buttons stay clickable.

## Zoom every card surface, not only the table

**Correction:** the Revealed-pile picker showed full Maquis art but right-click did nothing.

**What went wrong:** zoom lived on `Card.tsx` faces. The decision modal has its own `DecisionCard`
and never wired `onContextMenu`.

**Pattern:** if a face-up card is on screen, right-click zooms it. Off-board pickers reuse
`zoomNodeFor`.

## Printed era on the current photos is gospel

**Correction:** a playtester started seed 476208415 and circled the **2** in the laurel wreath on
Railroad Bridge and Valley, taking that number as era. Those wreaths are Victory Points. Era is
the subtitle under the title ("Era 1: Re-invasion of Spain"). All four starting cards print Era 1.

**What went wrong:** first pass assumed they had misread the era ribbon. They had pointed at a
different icon. The wreath is the most prominent number on the card at board size; the era line
is a thin subtitle.

**Pattern:** the printed era line on `Card Assets/Missions.jpg` / `Missions 2.jpg` / `Missions 3.jpg`
is gospel for era. The laurel number is VP. If a player says "era" while circling a stat icon,
identify the icon before changing data. JSON `era` follows the photos; if art and data disagree,
change the data.

## Undo a targeting action as one move, not two

**Correction:** after Anastasio discarded the wrong Enemy, Undo put the Enemy back but left
Anastasio used and hid every other Maquis action.

**What went wrong:** UseAction and the pick are two history entries. One Undo landed on the
`pendingDecision` snapshot, where `legalActions` is empty and `actionUsed` is already true — so it
looked like the table broke. The player wanted the whole action back.

**Pattern:** when Undo would land on a prompt that an action just opened (previous snapshot has no
pending decision), pop that prompt too — unless doing so would hide revealed Enemies.

## Combat cues have to sound like combat

**Correction:** a playtester only heard the card-play click. Choosing a Mission ("Click to attack")
was silent, and striking an Enemy used the same quiet tap family as putting a card on the table.

**What went wrong:** the spec biased toward sparse paper/wood and treated attack as another short
table SFX. The strike file was 100 ms of the same click, quieter than `play`, so it disappeared.
ChooseMission was never wired, even though the UI copy calls that click an attack.

**Pattern:** table cues can stay dry. Attack cues are a different family (gunshot on an Enemy,
explosion on a destroyed Mission) and must be loud enough to notice on the first play. If the UI
says "attack", that click gets a sound.

## Judge card orientation from the art, not from one crop

**Correction:** the Spy card was placed portrait during the art integration, and had to be rotated to
landscape.

**What went wrong:** the Spy's name banner sits top-left instead of centred like the Maquis banners, so
a sideways crop looked plausibly portrait, and the decision got made by reasoning about a single image
instead of looking at the alternatives.

**Pattern:** when orientation is in question, render all four rotations into one labelled contact sheet
and read it. The correct one is obvious in a second — a human figure standing upright and a name
reading left-to-right — and it costs one throwaway script. Applies to any "which way round is this
asset?" question, not just cards.
