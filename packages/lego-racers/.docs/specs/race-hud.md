# Feature: race-hud

## Behaviour

Lays out and draws the race HUD as commands: countdown, lap rows, place, wrong-way warning and held power-up, from `0x004261f0`, `0x00425e90` and `0x004263a0`.

## User flows

- **Lay out**: `getHudLayout` from the screen size, text sizes and holder image size.
- **Draw**: `getHudFrame(state, input)` returns the next state, text and image commands and the sounds of the frame.

## Invariants

- Positions are integers computed with the original's truncations.
- The commands name the font and image database entry; the caller draws.

## Out of scope

The gap-to-leader row, the HUD-mode widgets, split screen, and building the fonts from `FONT_THS.BMP` and `IGNUM.BMP`.
