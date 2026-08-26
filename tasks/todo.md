# Use-bar double-click

The gold Use control under a played Maquis often needed two clicks. The bar was ~22px tall, sat under the printed action text (the obvious click target), and a fidgety mouseup either missed the control or armed a card-slide that ate the click.

## Queue

- [x] Enlarge the foot bar (min-height 40px, extra hit padding) and capture the pointer so a slight drift still counts
- [x] Clicking the played card itself fires a legal Use (drag still rearranges during PLAN; dimmed half still moves)
- [x] Coach / guidance / patch notes

## Review

- **Cause:** missable hit target, not lag. First click usually landed on the card art (no-op) or drifted off the thin bar.
- **Fix:** bigger gold bar + click-to-use on the card when the action is legal.
- **To verify:** PLAN and ATTACK — one click on the bar, one click on the live half of the card; drag still moves during PLAN.
