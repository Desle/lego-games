# Cars as the original builds and draws them

Source: `LEGORacers.exe`. Ports: `packages/lego-racers/src/modules/car-builder` (the builder's data side and mesh), `racer-appearance` (what a racer is drawn from, its figures), `racer` (`vehicle-lean.ts`), `race-presentation` (poses and effect views), `scene` (`loadGeometryScene`, skeleton models). Viewer: `race-viewport`, `race-effects`, `model-object`. Names are in `reverse-engineering/names/LEGORacers.exe.txt`. Related pages: [racer-setup.md](racer-setup.md), [chassis-database.md](chassis-database.md), [driver-database.md](driver-database.md), [champion-database.md](champion-database.md), [racer.md](racer.md), [projectiles.md](projectiles.md), [model.md](model.md).

## What a racer is made of

`Vehicle_Setup` (`0x0043d7a0`) gets six things: the **car model frame** (vehicle `+0x3c`), the second chassis figure (`+0x40`, none in the data), the **wheel figure** (`+0x44`, which is also racer `+0x5c`, the display frame the physics moves), the **driver figure** (`+0x48`), and the chassis's vehicle point (`+0x4c`, the **seat**). It starts the wheels in animation 0 and the driver in animation 9, both with figure flag `0x10000` (plays).

| Part      | Computer racer (champion)                                                                                                                                                       | Car built from bricks                                                                                                      |
| --------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Car model | `Champion_CreateInstance` (`0x0041d7a0`): the champion's `*cm` model (GDB, no bones, its own scale, key `0x33`), texture database and material library of the same name         | the mesh the builder makes from the player's design (below), scale 1, materials from `MENUDATA\PIECEDB\LPIECELO.MDB`/`TDB` |
| Wheels    | chassis variant 0 (`Chassis_CreateInstances`, `0x0041e360`): model, skeleton and animation all `<xx>jmw` (three bones: root, front axle, back axle; two clips `frwrd`, `rvrse`) | same, from the chassis of the saved car                                                                                    |
| Driver    | `Driver_CreateInstance` (`0x00420ef0`): the driver's `*pelvis` model with skeleton and animation `pelvis` (six bones, 18 clips)                                                 | the figure builder `0x0042dfa0` (`0x0049db90`) from the save's five part bytes; **not ported**                             |

Models are in `GAMEDATA\COMMON`. The GDB scale (key `0x33`) is 1/64 for the wheels, the drivers and most car bodies and differs for some bodies (0.0074, 0.0078, 0.0055 ...); bones and animation positions are in the same 64ths. The race draws a model scaled by it.

**Dead branch.** `0x0043b480` falls back to a driver named `"bb"` when the slot has no figure, but the name table compares `strncmp` (case sensitive) and the database spells it `BB`: the lookup answers null and the code reads through it. The front end always makes a figure for a local player, so the branch never runs.

### Figures

A `Figure` (class `0x004af5ec`) is the exe's copy of the skeleton instance (`GolDP.dll 0x10023b10`): `racer` module `Figure` mirrors it and `getFigureAnimationState` (`race-presentation`) maps it to the `skeletal-animation` state (`+0xb4..` first clip, `+0xd0..` target, `+0xec` blend factor, flags `0x40000` loops, `0x20000` blends, `0x400000` target loops ...), so the viewer samples poses with `getSkeletonPose`/`getBoneMatrices` like any skeleton instance.

The animation set (figure `+0xa8` → `+0x2c`) is the ADB's keyword `0x2c` entries in file order: rate `+0` (frames per ms, 30 · 0.001), vector `+4`, bounding sphere `+0x10` (keyword `0x31`: centre and radius), frame count `+0x24` (keyword `0x2d`), period `+0x26` (keyword `0x2e`). `createRacerFigures` builds them; `0x0040e0b0` multiplies the clip's radius by the model's scale (`model +0x38`) and the figure's scale. Consequences now in the port:

- The **display bounding radius** (ground probe height, `racer-setup.md`) is the wheels' clip 0 radius times the model scale: 329.12/64 = 5.14 for `dajmw`, 349.77/64 = 5.47 for `kkjmw` (was the constant 5). **Hypothesis**: the original's frame radius is −1 after every `Figure_Play` until `0x004113c0` recomputes it (the racer-vs-racer sort); the port uses the computed value from the first frame on.
- Racer-against-racer collisions would now find a non-zero sphere (`collide-racers`); the race still delivers contacts through `deliverContacts`.
- `Vehicle_Update` (`0x0043e070`) now runs in the race, with the driver's random draws (`lookMilliseconds` starts as the `% 2000` draw of `0x0043d7a0`, which the race had made but dropped). The effect emitters' draws (smoke, dust) are not made: no emitter exists here, so the cursor still drifts from the original once a racer slides.

### The lean of the car model (`0x0043e740`)

Called by `Vehicle_Update` after the display figure is updated. Ported as `getVehicleLean` (`racer/types/vehicle/vehicle-lean.ts`), **bit-exact against the original in both precisions** (`vehicle-lean.differential.spec.ts`, 1500 cases each; the first distance goes through memory: `FSTP [0x10]` then `FLD`, the second stays in a register).

Rows `D0, D1, D2` of the display frame, `B2` the car model frame's third row, `m` the car body mass (`+0xc8`), `s` the step as float: `E1 = D1 × B2`, `d1 = |D0 − E1|` (negative when `E1 · D2 < 0`); the forward spring `v = −30 · d1 · s / m + previous` (`+0x398`), damped by `s · 0.01 · v` towards 0 from either side, else 0. `E2 = B2 × D0`, `d2 = |D1 − E2|`, the side spring (`+0x39c`, **the same field as racer `+0x3b4`, `vehicleSlideAngle`, which power slides write**) with 100 and 0.03. The car model frame is then `0x00410a00(E1 + forward·D2, E2 + side·D2)` at the display frame's position, and the driver sits at `seat · (frame rotation) + position` with the frame's rotation (`0x0043ebd0`). All its stores are float32; `RacerPose` carries `bodyRotation` and `driverPosition`.

## Drawing a racer

The viewport (`race-viewport.ts`) sets, per racer: the wheel model's group to the display frame (rows of the rotation are the images of the model's axes) and poses its bones from `RacerPose.wheelAnimation`; the car model's group to the display position with `bodyRotation`; the driver's group to `driverPosition` with `bodyRotation`, posed from `driverAnimation`. Each model's group scale is its GDB scale. Verified against screenshots of the running viewer: champion cars with bodies, wheels and seated drivers; the player's built car (blue, flame decals, side exhausts).

## The car builder (data side)

The front end (`FrontEnd_PrepareRaceSettings`, `0x0042d730`) loads `MENUDATA\PIECEDB\LPieceLo.leg` (brick database), `L_Colors.leg`, the car sets (`CRSTMGR.LEB`), and per local player calls `FrontEnd_BuildBuiltCarSlot` (`0x0042dcb0`): the saved racer's chassis name (record `+0x21`), the design into the builder (`0x0049c7f0` → `CarDesign_Load` `0x0049fb30`), the mesh builder (`0x0049b740`, `0x0049b920`, `0x0049c840`), the weight (`0x0049c6a0`), and the figure builder (`0x0042dfa0`). `loadRaceDefinition` now takes the player's car from `MENUDATA\DEFAULT.LRS` (racer 0, "JOAN OF KART", chassis `dachas0`): weight **214**, centre offsets −0.8178, −0.0935, so the mass is 2,500 + 214 = 2,714.

### LEB files (token streams, `.leb` extension)

- `L_COLORS.LEB`: `0x2d [n] { name × n }`, ten names `black white biege ltgray dkgray red brown yellow green blue`; a design stores the index. A colour's material is the first of `LPIECELO.MDB` with the same name (eight characters, `0x00497980`): `black` is 11, `blackaa` (12) is its textured variant with the nub texture `adnubint`.
- `CRSTMGR.LEB`: `0x2f [12] { "dp_cset.leg" ... }`. Each `xx_CSET.LEB` (`LegoCarSet_Load` `0x0049cb30`): `0x2e` an integer (the menu's limit, meaning not traced), `0x31` the chassis name, `0x30 [n] { piece name, colour name × n }` (the bricks the set offers; names resolve case-insensitively, `0x0049ebf0`).
- `LPIECELO.LEB` (`LegoBrickDatabase_Load` `0x0049ee30`): sections in any order, skipped to `}` after each: `0x27` pieces (name, id, footprint offset, face-record count `+0x16`, geometry offset `+0x18`), `0x28` face words (u16), `0x29` positions (3 × s16, /256), `0x2a` normals (3 × s8, /127), `0x2b` texture coordinates (2 × s16, /1024), `0x2c` byte pairs (footprints). 161 pieces: 12 chassis parts (ids `0xb`..`0x16`, 10 × 6 footprints, plus the origin vertex), the stud `Cylinder` (`0x800`) and the bricks (`0x1389` up). Pieces are sorted by id and face-record count; same-id pieces are variants (level of detail; the Lo file has one each).
- A **footprint** is `width, height, (top, bottom) × width·height`, cells column by column, then a u16 (the chassis part's origin vertex, `0xffff` for none). Heights in bits 0..5 (units of 0.4 stud); top byte bit 7: an attachable top (stud); bottom byte bit 7: a connector; bits 6/7 of the bottom relax the overlap test. Orientation (bits 0 and 1) swaps the extent and indexes the cells as `0x0049ea60`.

### Racer saves (`DEFAULT.LRS` 4 racers, `QBUILD.LRS` 24)

`SaveFile_Parse` (`0x00442770`, `0x00442910`): 128-byte blocks, 127 data bytes and a one-byte sum (`0x004429d0`). The header is 9 blocks (`"LR"`, count at byte 2); each racer is a 0x22d-byte record on its own five blocks (640 bytes): 13 UTF-16 name characters, **five part bytes at `+0x1c`** (`0x0042b330` hands the figure builder bytes 1, 0, 3, 2 and `4 & 0x7f`), the chassis name at `+0x21`, the design at `+0x29`: a big-endian u16 count (at most `0x40`) and eight bytes per brick: id (u16), x, y, orientation, colour, one more u16 (kept in the entry, read by nothing the race uses).

### Placement rules (`BuildGrid_*`, `0x0049e2d0` ...)

The grid is 10 × 6 cells (`0x0049e230` from `0x00499fc0`), each cell a brick index, a height and an attachable flag. `getRestingHeight` (`0x0049e2d0`): codes −2 (negative x or y), −3, −4 (past the grid in x, y); for each cell of the oriented footprint, over an attachable top with a connector `max(cell height − bottom)`, over empty floor (only with auto height) `−bottom`; the result starts at −1 (nothing to rest on). `getOverlapCount` (`0x0049e450`): a cell collides when the brick's bottom lies below what is there, or exactly at it where the top is attachable and the bottom byte has neither bit 6 nor 7. `getPlacement` (`0x0049e710`) = rest ≥ 0 and no overlap. `loadCarDesign` (`0x0049fb30`, variant 1 of the id, maximum height `0xf`): a brick whose resting height would make it taller than 15 is skipped; otherwise it is placed at its connectors' height, failing that on the floor. **Every brick of both saves loads** (4 + 24 designs; the declared count equals the placed count), which is the check that the rules are right.

### Weight (`0x0049c6a0`, differential tested, 1000 cases per precision)

Over the bricks with id ≥ `0x800`: for each unit cell between a footprint cell's bottom and top, `W += 1`, `Σx += x`, `Σy += y`, `Σz += base + level`; `centre = (Σx/W − 4.5, Σy/W − 2.5, Σz/W)`, `weight = W`. No such brick: all 0. The slot takes `W` as `+0x14` (so mass = base mass + `W`, rating bonus `ftol(W · 0.05)`).

### Mesh (`buildCarGeometry`)

`MeshBuilder_Build` (`0x0049b920`) walks the bricks; `0x0049a450` expands a brick's face records. A record is a word then, per vertex, the position index, a normal index and a texture index:

- `word & 0x3000 == 0x2000`: one more vertex for the previous face (a quad). Otherwise a new triangle: `0x1000` has texture coordinates per vertex, bit 14 gives every vertex a normal (else only the first reads one), bit 15 keeps the last normal; material = `word & 0x7ff`, source flags = `word & 0xfff`.
- A vertex turns by the orientation about the footprint corner: 1 → `(py, W − px)`, 2 → `(W − px, H − py)`, 3 → `(H − py, px)`, then `+ (x, y)`; z is `pz + base`. Normals turn the same way. A face without texture coordinates whose flags are 2 or carry bit `0x800` gets `(x', y') · 0.4` as texture coordinates.
- Material: ids 0 and 1 are the brick's colour, id 2 the colour's textured variant (`+1`), other ids themselves (`+1` with bit `0x800`) — the textured mode is on because `+0xd9 = +0xd8 = 0` and `+0xdb = +0xda = 1` after the constructor (`0x00499d00`).
- Faces whose flags are exactly 1 (hidden undersides) are dropped (`0x00497690`, bit `0x10`); a quad `(0,1,2,3)` becomes `(0,1,2)` and `(2,1,3)`; vertices are welded (`0x00495030`). Finally every vertex gets the origin offset and `z · 0.4`: for a chassis part as the first brick the offset is minus its origin vertex (z · −0.4); otherwise the centre of the first brick's extent (`0x0049b340`).

Not ported (hidden surfaces only): the coplanar clipping of neighbouring bricks' rectangles (`0x00495440`), the vertex-cache ordering (`0x00497360`), the studs of the menu's builder (`+0xd8` is clear for the race car).

**Lighting (hypothesis).** The track worlds define no lights and the built mesh has normals and no vertex colours, so the device lights it. `0x0042d730` builds a light set: ambient `0x808080` and a white directional light along (−1, 0, −1); the viewer applies it, fixed in the world.

## Projectiles and explosions

`getEffectViews(raceState)` (`race-presentation`) lists the launched effects with the position of their body (ballistic flights, the rocket's homing body and heading, the magnet, the grapple hook) and the explosions that grow or fade with the frame scale the engine gives them. The viewer draws, from `GAMEDATA\COMMON` with the materials of `POWERUP`, `GRAPPLE`, `BARREL` and `DBRICKS`: the rocket (`DMISSILE`, nose first along the heading), the barrel (`BARREL`), the magnet (`MAGNET04`) and the spiked explosion (`SPIKEXP`, uniformly scaled by the explosion's frame scale). **Not drawn**: the cannon ball (`@@cannon`, `CANNON.BMP`: not traced), the grapple's hook and rope (`tether`), the wand's beam (`LIGHTNG.TGA`), the plain explosion (its model `"Explsn"` is looked up in the chassis table `+0xb4`, which has no such record, so the original has none; the flash `exflash.bmp` and scar `exscar` are images), the debris (`DBRICKS` attached to slots), oil slick, shield, curse and bricks. Not verified in the running race: no effect fires in the viewer's opening seconds.

## Not ported / open

- **Figure builder, ported** (`figure-builder` module; `0x0042dfa0` to `0x0049db90`): `parseBodyPartCatalog` reads `BODYPART.PCB` (`0x00498740`; keywords `0x27` worlds, `0x28` directories, `0x29` hats, `0x2a` heads, `0x2b` torsos, `0x2c` legs, `0x2d` hat meshes, `0x2e` body models, `0x2f` bones: 36 hats, 30 heads, 29 torsos, 20 legs). `parsePartGeometry` reads the packed `.GCB` (`0x00407690`: vertex pool `0x28` lit or `0x29` coloured, 5 signed 16-bit values then 3 normal bytes or 4 colour bytes; UV = value / 4096, normal = byte / 127; parts `0x2c` with scale `0x2d` and groups `0x2b` of material name `0x27` and triangles `0x2a`). `buildDriverModel` composes the game's `LEG_BOX.GDB` body with the hat/head part of `ICB_CHAR.GCB` on the face bone and replaces the `face`, `torso` and `legs` materials with the driver's own (`<head prefix>dflt`, torso, legs) tinted 200,200,200. The part bytes come from `getDriverPartBytes` (`0x0042b330`: hat, face, torso, legs, expression). The viewer draws it on the pelvis skeleton. Hypotheses: the hat follows the face bone; the default expression; the exact `+0xc70` figure and the `0x0041fc00` random draws (the menu's idle animation choice) are not ported. Not confirmed visually: the rear race camera hides the driver behind the car body.
- The menu screens (another agent's work): they use `getPlacement`, `getGridWithBrick`, `loadCarDesign`, `getCarWeight`, `parseCarSet`, `parseSaveFile`; **unlocks** (which sets and bricks the player has) are in the save's header, which is not decoded.
- The second spring's other writers, the vehicle's smoke and dust emitters, the shadow (`carshadN.bmp`), the model bounding sphere (`0x100278c0`, unused while an animation plays), skid and engine sound.
