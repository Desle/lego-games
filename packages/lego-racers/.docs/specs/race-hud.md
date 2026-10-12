# Feature: race-hud

## Behaviour

Lays out and draws the race HUD as commands: countdown, lap rows, place, wrong-way warning and held power-up, from `0x004261f0`, `0x00425e90` and `0x004263a0`.

## User flows

- **Lay out**: `getHudLayout` from the screen size, text sizes and holder image size.
- **Draw**: `getHudFrame(state, input)` returns the next state, text and image commands and the sounds of the frame.

## Invariants

- Positions are integers computed with the original's truncations.
- The commands name the font and image database entry; the caller draws.

- The minimap (HUD display mode 1) is drawn after everything else: the map's two triangles, a dot per other racer and the player's arrow, from the racers' display frame positions and the race's display bounds; it is left out when the race has no bounds, and the map when the world has no picture.

## Out of scope

The gap-to-leader row, the HUD-mode widgets, split screen, and building the fonts from `FONT_THS.BMP` and `IGNUM.BMP`.
