# LDraw wheels and drivers (remastered layer)

With `?hd` in development and Bricks = LDraw (the default), every racer's wheels and driver (and a car with a complete model) are drawn from the official LDraw parts library, in the same plastic as the [LDraw cars](remastered-ldraw-cars.md): the player, the computer opponents and the champions, in the race, the Racer Select showcase, the driver editor, the main menu and the race cinemas. Physics, the simulation and the original's skeleton animations are untouched: the LDraw parts follow the poses the viewer already computes. Read [remastered.md](remastered.md) first for the rule. Code: `packages/lego-racers-web/src/modules/remastered/services/ldraw-racer/`.

## The neutral hooks (Classic side)

Classic code knows nothing about LDraw. It has two extension points (`src/shared/viewer-extensions/`) and one helper (`track-viewer/services/racer-drawing`):

- `getCarDrawing(request)`: a complete car (body, chassis, wheels). The request is the archive, the champion's body code (such as `RRCM`) or the built design (which names its chassis), and the chassis's wheel model. The answer (`CarDrawing`) has an object, `applyPose({ body, wheels, opacity })` and `dispose`. A pose part is what Classic already computes: the group matrix (frame, position, lean, part scale), whether it is drawn, and the animation state of the wheels (spin and steering).
- `getDriverDrawing(request)`: a complete driver, from the five part bytes or the driver model, with `applyPose({ matrix, isVisible, animationState, opacity })` (the skeleton pose) and `animate`.
- Either answers `null` for the original, and then the whole piece is the original's, never mixed. `attachCarDrawing` and `attachDriverDrawing` serve the race and the ghosts (parts the viewer moves every frame: the drawing follows their groups); `showCarDrawing` and `showDriverDrawing` serve the places that move a model's group as a whole: the builder (with its wheels), the showcase turntable, the main menu figure, the showcase driver, the driver editor and the cinemas.
- The ghost of the player's best run is drawn from the same drawings at the alpha of the ghost; the champion's ghost (GHOST.WDB models) stays the original's.

## Sources of a complete car (`ldraw-racer-model/`)

1. `~/ldraw-models/<CODE>.ldr|.mpd` (a hand-built champion car; `LEGO_LDRAW_MODELS_ROOT` moves the folder), served by the dev route `/__development/ldraw-models/` with an `index.json` read before the first frame. The file is in the car's frame, written in LDraw axes (see the folder's README, generated from `reference-kit/ldraw-models-readme.md`).
2. The LDraw Official Model Repository: no set of its 1,470 is a LEGO Racers car (checked by name and year, 2026-10), so there is no set-to-car table; a downloaded model can be saved as `<CODE>.mpd`.
3. A garage car: `createLDrawCarDocument` writes its brick list as the same kind of document, with its chassis part as a reference to `chassis/<CHASSIS>.ldr` (recipe frame: the chassis brick's footprint corner), or, with `?hd&chassis=game`, a converted unofficial part (`ldraw-chassis/chassis-fallback.ts`, studs on every flat cell).

Wheels are added when the file has none (the library sets below, on the original's wheel bones). If it has some (parts of the library's category `Wheel` or `Tyre`), they are found, taken out of the body and each follows the original wheel nearest to it. A minifigure in a file is removed: the driver is its own drawing. The dev panel lists which of the 20 cars and 12 chassis have a model.

## Reference kit

`pnpm --filter @lego-games/lego-racers-web run reference-kit` writes `~/ldraw-models/reference/<CODE>.svg|.txt` for the 20 champions and `reference/chassis/<CHASSIS>.svg|.txt` for the 12 chassis (four orthographic views over a stud grid, dimensions, LDraw colour names, wheel mounts), `~/ldraw-models/README.md`, `_convention-test.ldr` and `chassis/_fallback/*.dat`. A spec (`convention-test-model.spec.ts`) proves the axis conventions.

## Wheels

`wheel-analysis` reads the original's wheel model (`<chassis>JMW`, three bones: the model frame and the two axles): its triangles are welded by position into pieces, a hubcap beside a tyre is one wheel, and each wheel gets its bone, its centre in the bone's frame, its axle (the axis whose two other extents match), radius and width. All 24 chassis have four wheels, 40 to 70 LDraw units across (a stud is 64 raw units and 20 LDraw units, the same scale as the bricks).

`ldraw-wheel-sets` lists tyre and rim pairs of the library (the rim's seat is the tyre's bore, measured on the parts; `51011` + `4624`, `56890` + `6014b`, `30391` + `11208`, `2696` + `2994`, `2857`/`4267` + `2695`, `4410` + `6595c02`). The set whose tyre is nearest in diameter is scaled to the wheel's exact size; a drum as wide as several tyres (two wheels fused in the original's model: `dcchas0`, `gm_chas0`) is that many tyres side by side. The rim takes the colour the original paints its hub: the most common bright colour of the wheel's texture. Each wheel is placed with the bone's matrix of the pose, so the animation spins and steers it.

## Drivers

A driver is five part bytes (hat, face, torso, legs, expression). The race's computer drivers are fixed models (`rrpelvis`), but the driver database holds their five bytes (the port's `unreadBytes`: `RR` is `1 28 15 18 0`: `helmtrr`, `rr_`, `rr_chst`, `rr_leg`), so a champion is built the same way as a player's driver.

- **Parts** (`minifig-assembly`): hips `3815b`, legs `3816b` and `3817b` (a peg leg `2532` for the legs of type 1, `leg_peg`), torso `973`, head `3626b`, arms `3818` and `3819`, hands `3820` (a hook `2531` for the left hand of a torso of type 1, `vb_chst` and `cr_chst`), and the hat. The figure is assembled in LDraw's frame as the library's own assemblies do (torso at y -24, head and hat at y -48, hips and legs `3815c01`; seated as `3815c02`) and scaled 3.2 raw units to an LDraw unit, so a minifigure is as big as a brick of the car.
- **Hats** (`ldraw-minifig-hats`): the 36 hats of `BODYPART.PCB` by index, the nearest library headwear in the colour the game paints it (`helmtrr`/`helmet01..03`/`helmetvv` are the classic racing helmet `3842a` in black, blue, red, white, grey; `bb_hats` the bat helmet `30105`; `jt_hats` the fedora `61506`; the hair of `gh_`, `mh_`, `il_`, `rk_`, `al_` the library's hair). The library has no part for the red feathered helmet (`kk_hats`) or the tribal headdress (`ap_hats`): the bird headdress `30276` and the warbonnet `30138` stand in. **Hypothesis**: the names (`kk` King Kahuka, `cr` Captain Redbeard, ...) are not read from the game; the mapping was made by looking at the game's hats (a contact sheet of all 36) next to the parts.
- **Colours and pictures** (`minifig-surfaces`): read from the figure builder's own model of the bytes, so they are the original's. The skin is the dominant colour of the face card's part of the face picture; the torso is the dominant colour of the chest picture's front, the arms of the arms' part of it; the legs the dominant colour of the leg picture, the hips a second colour when the picture is plain with a small patch (`leg_bkrd`: black legs, red hips). The face is the original's picture on a patch of the head (`ICB_CHAR.GCB`'s face card, 32 x 20 raw units, shows u 0.27 to 0.72 and v 0.375 to 0.688 of the 64 x 64 picture on all 30 faces; **v counts down the bitmap's rows** for these parts) and the chest picture covers the front of the torso. With the texture pack on (`?hd`) the pictures come from the pack as they load.
- **Skeletons** (`minifig-rig`): the race driver's seated skeleton (`pelvis`, `torso`, `arm_l`, `arm_r`, `dummy01`, `head`; bind pose: legs forward, arms reaching 14 degrees below the horizontal, measured as the principal axis of their vertices) and the menus' standing one (`rr`, `hr`, `rp`, `hp`: 29 bones, bind pose arms out sideways). A part is attached to a bone (hips, torso, head and hat, the race driver's arms) or follows a chord between two bones (a menu figure's arms from shoulder to wrist, its legs from thigh to ankle): one rigid library arm cannot bend at the elbow, so it keeps pointing from the shoulder to the wrist the animation moves, with the hand at its end, and a hanging arm splays outward by 9.78 degrees as the library's own do. Each frame the part's matrix is the bone's (or the chord's) change from the bind pose, so the original's animations (steering, celebrating, the menu idles) play.

## The look

Same plastic and the same studio as the cars. three.js lights every material by all lights of a scene, so a scene gets the studio once (`ensureStudioLights`): a car's drawing brings its own, a scene without one (a menu) gets it, turned to light from the front for the standing figure and from behind for the race, the way each is looked at. The face and chest decals glow a little so they stay readable on the unlit side.

## The gallery

`/ldraw-racer-gallery.html` on the dev server (not part of the build) exposes `renderWheels(chassisIndex, view, width, height, milliseconds)`, `renderWheelSheet`, `renderDriver(partBytes, 'race' | 'menu', view, width, height, clip, milliseconds)`, `renderDriverSheet`, `renderChampion(name, view, width, height)` and `renderCatalogueSheet(slot, indices, baseBytes, columns, cell)` (every hat, face, torso or leg of the catalogue on a seated driver) for a headless browser to call and save the canvas. The renders in `~/ldraw-gallery/drivers/` come from it.

## Open

- The ghost cars and the champions' car bodies are the original's.
- Hats the library cannot match are approximations (above); the legs' prints (`tc_leg`, `kk_leg`, ...) are not drawn, only their colour; the two-tone hips rule is a measurement of the 20 leg pictures, not a read of the game.
- The race driver's bind pose is a measured pose of the box body (`leg_box`), the LDraw legs sit forward as a minifigure sits; they do not follow the box's exact outline.
