# Menu backdrops (3D items of the front end)

Source: `LEGORacers.exe` and the emulator's render trace ([render-trace.md](render-trace.md)). Port: `packages/lego-racers/src/modules/front-end` (`menu-world`, `menu-camera`, `menu-figure`, the main menu screen), `racer-appearance` (`loadMenuDriverScene`), the viewer's `menu-viewport` and `driver-view`. The screens and their items are in [front-end.md](front-end.md); the figure builder is in [car-builder.md](car-builder.md) and [racer-setup.md](racer-setup.md).

## The camera is the world's `Camera01`

Every 3D draw of the original records the model-to-screen matrix and the camera matrix (device `+0xc8518`, `+0xc8490`). Reading them:

- the camera matrix is the view and projection with the viewport folded to the unit square: for a point seen at lateral offset `s` at depth `z`, `x' / w = 0.5 + k * s / z`, `w = z`. The **eye** is the point it sends to `x' = y' = w = 0`, the view direction follows from the lateral columns, and `k` gives the field of view (`tan(half) = 0.5 / k`);
- the main menu (`tt`): eye `(28.786, -10.146, 3.599)`, vertical field of view 36.0 degrees, the aspect of the 400 x 480 rectangle. This is `TT.WDB`'s `Camera01` to five digits (position, and `0x47` = 35.99995). The item's nine floats `0x2e` (`-12, -19, 28, 0, 0, 10, 45, 1, 1023`) are **not** the camera (hypothesis: template values nothing reads);
- the racer showcase (`racer`, race select): eye `(14.066, -0.556, 6.453)`, field of view 31.77 degrees, aspect 1.25 (the 3D area is the item's rectangle inset by the 16-pixel frame: `(267, 141)` to `(572, 385)` of `(251, 125)` to `(588, 401)`). This is `RS_SET\RACER.WDB`'s `Camera01` and its `0x47` (31.7687);
- the race cinema (`0x45` item `pst`, circuit and single race): eye `(7.008, -47.955, 3.321)`, 36.0 degrees, aspect 1.25 (the 320 x 256 rectangle). `SINGRACE\PST.WDB`'s `Camera01`.

The projection matrix also exposes the planes: `far / (far - near)` and `-near * far / (far - near)` give near 5 and far 800, the camera's `0x45` and `0x46`. So the world camera keywords are the near plane, the far plane and the vertical field of view in degrees (see [world.md](world.md)), and `getWorldMenuCamera` builds the three.js camera from them. The port uses the world camera for `tt` and `racer` (`getWorldCameraInset`); the editor's, the licence's and the garage's worlds keep their item floats until traced (their floats are not template values, so they may be overrides: open).

## The main menu's figure

`MainMenu_CreateViewports` (`0x00480e40`, from the screen constructor `0x00480f20`) builds the platform item with `Viewport_CreateFromItem` (`0x0046c480`: it copies the item's `0x21` words, `0x0046ba60`, and adds the camera at the end), and a figure widget (`FigureWidget_Constructor` `0x0047e0a0`, `FigureWidget_BuildFigure` `0x0047df90`) attached to it with `0x00465b40`. The figure is built by the figure builder in **menu mode** (`FigureBuilder_BuildDriver` `0x0049db90`, mode 0):

- the parts come from `MENUDATA\PARTDB\MENUPART` (`CBBODIES.GCB` with the world `cbbodies`, the bodies `RR HR RP HP` as `.GDB` with their `.ADB` skeletons), the part catalogue and materials from `MENUDATA\PARTDB` (`BODYPART.PCB`, `BODYPART.MDB`), and the animations from `MENUDATA\LEGOMAN.ADB` (`MainMenu_Enter`, `0x00481000`: `legoman`);
- the body is `torso type + legs type * 2` in `rr hr rp hp` (`0x00498510`): a hook torso and peg legs change it (the game's mode 1 uses `LEG_BOX` in `GAMEPART`);
- the figure is the driver whose part bytes `DriverDatabase_GetPartBytes` (`0x00421050`) copies from `DRIVERS.DDB` (the five bytes `+0x2b..+0x2f`, the ones the race does not read): driver index `DAT_004c214c[Profile_GetUnlockedCircuitRunLength]` = `0x13, 0x12, 0x16, 0x15, 0x14, 0x17` (`cr`, `kk`, `bb`, `jt`, `bvb`, `gm`) for 0 to 5 circuits unlocked after the first; with all six the table's seventh byte is 0, the driver `rr`. The new-game main menu shows Captain Redbeard (`cr`, parts `4 4 24 10 0`), as in the original frame;
- the root frame: world position `(18.181, -10.623, 0.0257)` (the widget's three floats `0x41917328 0xc129f6d2 0x3cd29995`), scale 1/64 (the mesh scale), turned to face `(0.9724, -0.2334, 0)`. Verified: `model matrix x inverse(camera matrix)` of the parts' draws gives the root at that position and the bones at 2 to 3.5 above it.

Verified by `front-end-render-trace.trace.spec.ts` (main menu case): the port's figure position times the original's camera matrix equals the translation of one of the original's draws, and `TT.WDB`'s eye is the point the original's camera matrix sends to zero.

## The main menu figure's behaviour (`MainMenu_Update` `0x00481450`)

The screen's update (vtable `+0x78`) runs every frame with the elapsed milliseconds; the figure (`+0x2438` = the figure widget's figure) has the exe's own animation player (`Figure_PlayFrom` `0x0040dae0`, `Figure_Blend` `0x0040db80`, `Figure_Update` `0x0040dd60`, `Animation_GetIsFinished` `0x0040e360`; the flags are those of `skeletal-animation`). `MENUDATA\LEGOMAN.ADB` has three clips: 0 `start` (329 frames), 1 `begin` (103) and 2 `wait` (395), all 0.03 frames per millisecond.

- The constructor's timers (`MainMenu_ResetTimers` `0x00480e10`): `+0x2444` = 60,000 ms (idle), `+0x2448` = 30,000 ms (wait).
- Entering the screen (`MainMenu_Enter` `0x00481000`; the figure is built from the driver of the profile): `Figure_Play(0)`, flag `0x10000` set, flag `0x40000` cleared: `start` plays **once**.
- Each update both timers go down by the elapsed time (to 0). While the figure shows `wait` (the blend's target while blending), the tap on the glass sounds once when the clip passes frame 208 (`0x004b3770` = 208.0): `MenuSound_Play` `0x0046e970` with id `0x1d` = the 29th entry of `GENC0R0.SBK` = `glasstap.pcm` (`+0x243c` is the played flag; it clears while the clip is before frame 208).
- When the wait timer is 0: `Figure_Blend(2, 200 ms, start 0.0, current stops, target stops, target does not loop)`, timer = 30,000. Else, when the first clip has ended (`0x0040e360`: flag `0x80000`, or not looping and on its last frame): `Figure_Blend(1, 200, 0.0, 0, 0, target loops)`. A blend to the clip already shown does nothing, so `begin` then loops until the next 30 seconds are over; `wait` plays through once (13 seconds) and returns to `begin`. Both clips are frozen during the 200 ms blend. No random draw is involved.
- When the idle timer is 0 the update sets the screen's done flag (`+0x364`) with no target: the screen stack empties and the front end returns with the race flag set; the game starts a demonstration race (the trace shows a race frame 1,975 after the scenario began, 60,000 ms after the menu opened at frame 154; HUD, lap counter and a car viewed from behind). Not ported.

Verified (`front-end-figure-animation.trace.spec.ts`, 33 ms frames): the part frames the original draws (each frame's world position from `model matrix x inverse(camera matrix)`) are matched by the port's bone positions within 3 cm for at least 70 percent (about 80 percent over 340 frames; the rest are part frames that are not bone origins) at frames 300 and 500 (`start`), 900 (`begin`), 1100 and 1250 (the blend and `wait` of the 30 s timer) and 1400; the menu opens at frame 154 and the figure is gone between frames 1970 and 1975 (154 + 60,000 / 33 = 1,973). The clip phases fit best one frame earlier (frame 153) than the timers (154): the first frame's timer decrement seems to be skipped; not modelled (hypothesis).

## Open

- The idle timeout: after 60 seconds of the main menu the original leaves the front end for a demonstration race (see the figure's behaviour); the port keeps the timer at zero and does nothing.
- The driver editor's figure position `(-5.359, -3.15, 0.026)` (widget of `0x0047d230`) is read from the code but not traced.
- The racer showcase of the race select and of the garage: the original places the racer's car and driver on `RACER.WDB`'s platform (`carp`; the driver's root near `(-0.9, -0.9, 0)`); not ported. The world's `bground` swirl is drawn dark by the port.
- The cinemas (`0x45` items: the circuit and single race previews `SINGRACE\PST.WDB`, the circuit and award screens): `PST.WDB` holds every race's track and the figure `guy1`; which instances show for a race, the camera paths and the events are in `.CDB`/`.CEB` (`Cinema_Load` `0x00406980`, `CinemaEvents_Load` `0x004a0730`). Not ported: the circuit and single race screens keep a dark panel.
- Camera movement between screens: every traced frame has one constant camera per screen; nothing moves between screens in the data read so far.
