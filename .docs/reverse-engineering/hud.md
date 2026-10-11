# The race HUD: layout and draw (`0x004263a0`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/race-hud`. The HUD objects are race `+0x283c` (stride `0x140`); `Hud_Initialize` is `0x00425d80`, `Hud_Update` (`0x00426390`) only adds the frame time to `+0x34`. `Race_Render` draws them in states 2, 3 and 4 only (vtable slot `+0x40`, `0x00435a90` → `Hud_Draw` `0x004263a0`).

## Layout (`Hud_SetScreenSize` `0x004261f0`, `Hud_Layout` `0x00425e90`, mode 1: whole screen, scales 1.0)

`vertical = float(H * (1/480))`, `horizontal = vertical * (3W / 4H)` (`0x004b02d8`). With `w0` the width of `0:00:00` and `w1`, `h1` the size of `59:59:88` (`0x36ee08`) in the text font, `ftol` truncating:

- time column `x = W - ((ftol(w1 * horizontal) * 11) >> 3)` (`+0xac`)
- first row `y = ftol(vertical * 7)` (`+0xc8`); further rows add `ftol(((h1 * k) >> 3) * vertical)` for k = 7 (`+0xd0`), 14 (`+0xdc`), 21 (`+0xc4`, the countdown row)
- centre `W >> 1`; place column `W / 10` (`+0xa8`); the wrong-way text (string `0x24`) centred at `y = H / 5`
- power-up holder at `x = W >> 5`, `y = H - ftol((holderHeight + 10) * vertical)`

## Elements

- **Countdown** (`+0x70`, set to 1 at the end of the introduction by `0x00426360`): second `s = t / 1000`; scale `(1000 (s + 1) - t) * 1.8 * 0.001`; seconds 0..2 draw `3`, `2`, `1`, seconds 3 and 4 draw string `0x29` (GO; 1.8 for the first, shrinking in the second), centred at `(centre - (w' >> 1), row - (h' >> 2))` in the digit font, colour `0xff00ffff`. Sound 0 on the first frame and each second; sound `0xf` when GO starts. After 5 s it stops. After the finish (`0x00426370`, `+0x70 = -1`) string `0x28` is drawn at the same place and the counter runs down to -60,000.
- **Lap row**: lap number text (`min(lap + 1, lapCount)`), its right edge `14 * scale` left of the time column; label string `0x27` `6 * scale` left of it; the current lap time at the column (7-character times are shifted right by `w1 - w0`). The time blinks (250 ms period) for 3 s after a lap: the previous lap's time shows on even beats. Time format `Hud_FormatTime` (`0x004246d0`): `M:SS:CC`, `MM:SS:CC` from 10 minutes, modulo an hour.
- **Best lap** (second row): label `0x25` and the time, set when a finished lap is at most the best (or none yet).
- **Place**: string `0x19 + place` (`ST`, `ND`, ... from `GAME.SRF`) at the place column plus `5 * scale`; the big digit (`place + 1`, digit font) right-aligned to the column. A change starts a pop (`+0x74`): size 1 + 0.0058 t up to 175 ms, down to 1 by 350 ms, reset at 1,050 ms.
- **Wrong way**: racer flag `0x4000` draws string `0x24`.
- **Held power-up** (image database `LEGOIMGS.IDB`: speed, dot, cannon, grapple, wand, rocket, oilcan, barrel, magnet, curse, igdcrdot, holder, holderwp, oneenh, twoenh, threeenh, shld1-4, octan1-4): holder (entry 11) and its frame (12) tinted by kind (1 `0xff0000ff`, 2 `0xffff5050`, 3 `0xff00ff00`, 4 `0xff00ffff`); icon entry 2 + level (projectile), `0x10` + level (shield), `0x14` + level (turbo), 6 + level (hazard), centred at `(31 w >> 6, 38 h >> 6)` of the holder; from level 1 entry 12 + level at `3w/8`.

## Not ported

The gap-to-leader row (racer `+0xd84`, value `+0xd88` not kept by the racer module), the displays the HUD-mode binding cycles (`0x004249b0`, `0x004258e0`, `0x00424fb0`), split-screen modes, and the bitmap fonts (`font_ths` and `ignum`, built from `FONT_THS.BMP` and `IGNUM.BMP`; `0x00408be0` measures them). The viewer measures and draws with a browser font.
