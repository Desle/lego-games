# The race's pause and results menu

Source: `LEGORacers.exe`. State and answers: `race` (`pause-menu`, see [race-contacts.md](race-contacts.md)). Draw: `race-presentation` `getPauseMenuCommands`; viewer: `race-menu-input-source`, the HUD overlay and the race controller.

## The widget (race `+0x3058`)

Initialised by `Race_LoadTrackContent` through `0x004272c0` (font = race `+0x2d7c`, surface = race `+0x14`, string table = `GAME.SRF` of the race's language, confirm key = the language's key `+0x354` of the settings). **Hypothesis**: the font is the HUD's `font_ths` text font (the HUD object is at race `+0x2d5c` and its text font at `+0x20`; this was not traced further).

`0x00436010` opens a menu (called with `race +0x30c0` = 1, 2 or 3): the local players' controls are released, then `0x00427310(items, titleId, subtitleId, firstSelection)` copies the strings of the table and measures them (`0x00408be0`). Line height `+0x60` = tallest item + 2; first item `+0x5c` = `(surfaceHeight >> 1) - ((count * lineHeight) >> 1)`.

| Mode | Items (GAME.SRF ids)                                                           | Title / subtitle                                                         | First selection |
| ---- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | --------------- |
| 1    | `0x0e 0x0f 0x11` (continue, restart race, exit); in a circuit `0x0e 0x10 0x11` | `0x14` (game paused)                                                     | 0               |
| 2    | `0x12 0x13` (yes, no)                                                          | `0x15 0x16` (ghost not beaten) or `0x17 0x18` (`0x004234b0` says it was) | 0               |
| 3    | `0x12 0x13`                                                                    | `0x2c` (are you sure?)                                                   | 1               |

Draw `0x00427440` (called from `0x00435920`, in every state's render): a black quad over the surface at alpha `0x40` (`0x004276c0`), then the title at `(width / 2 - textWidth / 2, firstItem - lineHeight)` (moved up by half a line when there is a subtitle, which follows one line below), white; then each item centred, colour `0xff127f7f`; the selected item `0xff24ffff`, drawn only while the blink timer `+0x54` is below 250 ms and the menu still waits for an answer. Blink timer `0x00427420` wraps at 500 ms. Text is drawn at scale 1 at the surface's own pixels (the HUD's 640 × 480 scale is not applied).

Keys `0x00427810`: up (`0x100000c8`, joystick up codes) and down (`0x100000d0`, ...) move the selection with wrap-around; the confirm keys (`0x1000001c` enter, `0x10000039` space, `0x3000000c..f` joystick buttons) clear the waiting flag. The menu has no mouse codes (`0x2....`), so the in-race menus take no mouse input.

## Port

- `getPauseMenuCommands(raceState, hudContext)` gives HUD commands (a `fill` for the dimmer, `text` per line) with the layout above; the overlay draws them over the HUD.
- The viewer's `createRaceMenuInputSource` hands one key per frame (as `0x00435c00` takes one key per call) and turns the window losing focus into the pause key (application flag `0x4000`).
- While a menu is open the presentation is stepped with 0 ms (the race is frozen); the controller maps the race's `exit` to the session: quit → `abortSession`, restart → `restartRace` (first race or no circuit) or `requestCircuitRestart` (later races of a circuit), anything else → `finishRace`.
- The ghost result menu (mode 2) is opened by the race after a time trial's ghost run; the results screens that follow a circuit are the front end's `0x16..0x19` screens (see [front-end.md](front-end.md)).
