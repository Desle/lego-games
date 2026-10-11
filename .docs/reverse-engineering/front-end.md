# Front end (the menus)

Source: `LEGORacers.exe`. Ports: `packages/lego-racers/src/modules/menu-file`, `front-end` (with `font-rendering`, see [font-rendering.md](font-rendering.md)). Viewer: `track-viewer` race mode.

## Structure

`GameApplication_Run` (`0x0042bc40`) loops `RunFrontEnd` (`0x0042bdc0` → `FrontEnd_Run` `0x0042b1e0`) and `RunRaceSession` while `app +0xabc` is set. `FrontEnd_Run` builds a `0x4dd4`-byte front-end object (`0x0042c5d0`), initialises it (`0x0042cb90`: loads `GImages`/`GFonts`, `LEGORACE.CRB/.RCB`, `MENUNAME.SRF`, `MENUTEXT.SRF`, `CIRCUIT.SRF`, `GSTYLES.MSB`), runs the loop `0x0042d510` and, if a race was asked for, `FrontEnd_PrepareRaceSettings` (`0x0042d730`).

- **Screen stack** (`0x0047fa00`, push `0x0047fa70`, pop `0x0047faa0`, top `0x0047fac0`). The factory `0x0047f4e0` maps a screen id (the string index in `MENUDATA\MENUNAME.SRF`, 0..0x31 and 0x90) to a class; e.g. 2 = main menu, 5 circuit race, 6 single race (also 0x1d time trial and the versus race: `0x00487ca0` stores the real id at `+0x362` and loads the `singrace` files), 8 options, 0x13..0x15 racer pick, 0x1f..0x25 circuit introductions, 0x27 credits. Names of 0x37+ in `MENUNAME.SRF` are widgets and styles (`backdrp`, `nubutton`, `brickbox` ...).
- Each screen loads `<name>.MIB` (menu description), `<name>.MSB` (its styles), `<name>.IDB` (its images) through `MenuScreen_LoadDescription` (`0x0046b890`); styles shared by all screens are `GSTYLES.MSB`.
- A screen sets its target (`+0x360`) and a done flag (`+0x364`) in its button handler; its leave handler pushes or pops (`0x004812c0`). Codes above 0x31 are actions (`0x3f` back, `0x41` start the race).

## Menu description (MIB) and styles (MSB)

Port: `parseMenuDescription`, `parseMenuStyles` (one reader `parseMenuFile` driven by grammar tables; all 31 MIB and 9 MSB files of `LEGO.JAM` parse to their last byte, entry names unique and at most `total`).

```
0x27 total
( keyword [ count ] { ( keyword "name" { properties } ) * count } ) *
```

`total` sizes the name table (`0x00411800`); every entry name is added to it (`0x00411870`, a repeated name is fatal). The properties are read by the item readers `0x00469a20` .. `0x0046af50` (MIB, via the section switch `0x00469950`; the screen base class adds section `0x46` buttons `0x0047f290`/`0x0047f2b0`) and `0x0046fe20` .. `0x00470dc0` (MSB, switch `0x0046fd80`; GSTYLES adds `0x3e` button styles `0x00480740`). The grammar tables in `menu-file/types/*-grammar` list every keyword with its operand kinds; an unknown keyword is the original's fatal syntax error. The names of the section kinds in the port (fill, image, text, frame, arrow, ... , button) are hypotheses read from the files; the original has only the reader functions.

Item facts used by the port: position block `0x36 { 0x2f left top right bottom, 0x31 "parent" ... }` (coordinates in the parent; a zero right or bottom takes the image's or text's own size, `0x0046f150`; absolute = sum of the ancestors' left and top, `0x00472e90`); images name `0x28`; boxes name eight border images (`0x28`) and two colours (`0x2a`); viewports (`0x42`) name a world of `MENUDATA` (`0x2d "tt"` = `TT.WDB`) and nine camera floats; `0x45` items name a cinema (`singrace` → `SINGRACE\PST.*`). Colours are `A R G B` (`0x0046b210`).

Button styles (MSB `0x3e`): six images, six fonts and 13 colours (`0x2a`: one, then six, then six); the last six are the text colours of the six states (`nubutton`: grey, grey, dark yellow, green, yellow, green). The gap between a button's 32-pixel image and its text is 14 (first value of `0x2b`, hypothesis for the role). The port maps normal, disabled and focused to states 0, 1 and 5 (hypothesis).

## Port of the screens

`front-end`: `createFrontEnd`, `stepFrontEnd(state, resources, environment, input, ms)`, `getFrontEndFrame` (draw commands: images, fills, text as glyph rectangles from `font-rendering`, viewports), `getFrontEndRaceRequest`, `getRaceLoadOptions` (→ `LoadRaceOptions`), `loadFrontEndResources(archive, language)`.

| Screen                             | Port                     | From                                                                                                                                                                                                                                                              |
| ---------------------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Main menu (2)                      | `main-menu-screen`       | `0x00480f20` (buttons, labels `MENUTEXT.SRF` 0x25 0x21 0x22 0x23 0x24 0x26 0x27), `0x00481150` (targets, versus flag set by "vs", cleared by "circuit" and "single", "quit" asks 0x75). "vs" is disabled with no controller (`0x00480f20`: `input manager +0x98`) |
| Circuit race (5)                   | `race-selection-screens` | `0x00479f70`, `0x0047a0e0` (mode 0, circuit name, the circuit's four races copied into the settings), `0x0047a3f0` (race name cycles every 2,000 ms), `0x0047a250` (leave → racer pick `0x13`); closed circuit disables "next"                                    |
| Single race (6), time trial (0x1d) | same                     | `0x00487b50`, `0x00487d40` (circuit and race into the settings, push `0x13`), `0x00487f90` (mode 1 or 2; a time trial has no opponents)                                                                                                                           |
| Racer pick (0x13..0x15)            | `pick-racer-screen`      | `0x00484d90`, `0x00484f40`, `0x004850a0` case `0x41`: racer count = opponents + players (circuit: 5 + players; versus: players; time trial: 1); versus asks a second racer                                                                                        |
| Options (8)                        | `options-screen`         | `0x00475730`, `0x004832d0` (targets 0xa, 0xb, 0x2c, 0x27), `0x004833e0` (the game tab writes `+0x100` opponents and `+0x2c` laps). Video and audio tabs not ported                                                                                                |
| All others                         | `static-screen`          | the page's name with a way back                                                                                                                                                                                                                                   |

### What the menus write (game settings)

`FrontEndSettings`: `mode` (`+0x24`: 0 circuit, 1 single, 2 time trial), `isVersus` (frontend `+0x4bb8` bit 2), `circuitName` (`+0x2d`), race `+0x40`/`+0x48`/`+0x3c` (key, folder, flag) and `circuitRaces`, `racerCount` (`+0x100`), `lapCount` (`+0x2c`), `localPlayerCount` (`+0x32c`), chosen racers. `getRaceLoadOptions` gives `raceFolder`, `racerCount`, `localPlayerCount`, `multiplayerLapCount` (a field added to `LoadRaceOptions`). `0x0042d730` further fills the racer slots from the circuit's codes (`race` does that with `racerCodes`) and, with no local player, picks one of four races with the random table (not ported: demo mode).

## Hooks for other work

`FrontEndEnvironment`: `unlockedCircuitMask` (progression: the original asks `0x0042f1f0`), `playerRacerNames` (the garage and save files), `controllerCount`. The garage (3), car builder (0xe), driver and car editors, awards, credits and introductions are static placeholders. A circuit, a single race and a time trial go through the game session of [game-progression.md](game-progression.md): `getSessionSettings` turns the menus' request into `SessionSettings`, the viewer runs `startNextRace`, `recordRaceStep` and `finishRace` for each race, and a circuit plays its four races with the points record. When the session ends the menus open on `session.resultScreen`: 2 is the main menu, 0x16..0x19 are the circuit result screens, which the port draws as the page's backdrop with the standings from `getStandingRows` (the award cinemas are not ported). A race's scene is not mirrored for a flagged race (hypothesis: the viewer's scene loader has no mirror option yet). The circuit introduction cinema (`0x1f + circuit`, pushed by `0x004850a0`) is skipped.

## Not ported / open

- The retained-mode widget toolkit (`0x00471c30` and the widget classes): layout and states are read from the data; draw order, text alignment inside rectangles (`0x0046f9b0` stretches text to its rectangle), icon placement and the exact button state mapping are approximations.
- The animated 3D backdrops (`TT.WDB`, racer showcase) and the cinemas (`.CDB`): the viewer draws a dim panel; draw commands carry the model name, rectangle and camera floats.
- Menu sounds: the original plays ids of `GENC0R0.SBK` through `0x0046e970` (`base - 1 + id`) from the styles' sound tables; the port plays `hilight1`, `ok`, `cancel`, `cantdo2` by role (hypothesis).
- Mouse input (the original's menus take device events `0x10000014` ...); the port takes keyboard and gamepad.
- Splash and introductions (screens 1, 0x26, 0x28, 0x29, 0x2b), save/load profile screens (0x2d..0x31). The in-race pause menu is in [pause-menu.md](pause-menu.md).
