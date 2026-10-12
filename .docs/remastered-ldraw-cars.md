# LDraw cars (remastered layer)

With `?hd` in development, cars built from bricks are drawn from the LDraw parts library instead of the mesh the original builds. Everything lives in `packages/lego-racers-web/src/modules/remastered/services/ldraw-car/` (plus `ldraw-library/`, `development-ldraw-server/`, `ldraw-gallery/`). Physics, weight and collision still use the original car: only the drawing changes. Read [remastered.md](remastered.md) first for the rule.

## Setup

Download the official library (CC BY 2.0, `complete.zip` from <https://library.ldraw.org/library/updates/complete.zip>) and unzip it so that `~/ldraw/parts`, `~/ldraw/p` and `~/ldraw/LDConfig.ldr` exist (`LEGO_LDRAW_ROOT` overrides the folder). The dev server serves it at `/__development/ldraw/` (`apply: 'serve'`, nothing reaches a build). `three`'s `LDrawLoader` fetches only the parts a car names, with the primitives they use. Without the library the car falls back to the game's own mesh.

`?hd` draws LDraw cars; `?hd&bricks=classic` draws the original's. The developer panel has a **Bricks (reloads)** choice (Classic / LDraw) next to Textures.

## How it works

- Neutral extension point: `ViewerExtension.getBuiltCarDrawing` (optional). `race-viewport` asks it for each racer with a built design (`RaceDefinition.racers[i].savedCar.design`); an answer is added to the car body's group in the mesh's own frame and the original body mesh is hidden. With no extension registered nothing changes.
- `getCarOrigin` (`car-builder`, previously the private `getOrigin`) is exported so the drawing uses the same origin offset as `buildCarGeometry` (`0x0049b340`, `0x0049b740`).
- `createLDrawCarDocument` writes the design as an LDraw model: one type 1 line per brick, in LDraw axes. The game's frame is x, y, z up in studs (a stud is 1, a plate 0.4); LDraw is 20 units to a stud, 8 to a plate, y down. A brick's matrix is `LDraw<-game * place(x, y, base) * turn(orientation about the footprint corner) * part-in-brick-frame * game<-LDraw`, the orientation turns being those of `0x0049a450`. The root group applies `LDraw -> game` and 1/20.
- Bricks with no LDraw part are drawn from the game's own faces (`getBrickFaces`), in the LDraw colour, so a car is always complete.
- Colours (`L_COLORS.LEB` index to LDraw code): black 0, white 15, biege 19 (tan), ltgray 7, dkgray 8, red 4, brown 6, yellow 14, green 2, blue 1. The 1999 greys are the library's original grey codes, not the bluish ones.

## The mapping table (`ldraw-brick-mappings.ts`)

`LDRAW_BRICK_MAPPINGS`: game brick name to `{ partNumber, quarterTurns, isMirrored, offset, heightError }`, the part's frame into the brick's frame (see the type). `UNMAPPED_BRICK_REASONS` names every other brick of `LPIECELO.LEB`; a spec checks that all 161 are in one table or the other.

It was generated, not typed: for each of the 161 bricks the game's mesh (from `getBrickFaces`, hidden undersides dropped) and each of about 5,000 LDraw parts (studs left out, subparts followed) were turned into top-surface height maps on a 5-unit grid; each part was tried in the four quarter turns and mirrored, aligned by its bounding box, and scored by the mean height difference in plates over the footprint. Parts with a different bounding box (more than 8 % in height, 6 % in the footprint) are not tried. Ties go to the part with the fewest triangles, or the one the brick's name points at (`L300200` is LEGO element 3002). Accepted when the error is at most 0.30 plates, plus hand-picked parts for names that point at a part whose shape is close (`l395700` the antenna 3957a, `l347500` the jet engine plate 3475a, `l474600` the rocket tail 4746, `L347800` the tail 2340, `L239901`/`L239902` the wedge 2399, `L241900` the slope 3939, `L304500` the slope 3688, `srrgril2` the plate 3022, `spizza` the round brick 3941, `s00021` the slope 3678a). Mirrored matches never won over a left or right part, which confirms the axis mapping (`6564` and `6565`, the right and left 3 x 2 wedges, map to `L656400` and `L656500` unmirrored).

Verification: every saved design (`DEFAULT.LRS`, `QBUILD.LRS`: 28 cars) was drawn with the parts and, in wireframe, with the game's mesh over it; the studs, slopes and wedges line up (a gallery page does this, below), and a sheet of every mapped brick next to its part shows the same shapes in the same orientation.

### What the brick names are (tested against Rebrickable's catalogue)

**Hypothesis "a name is a LEGO element ID" is false.** Rebrickable's `elements.csv` has no element `243200`, `300200` and so on, and the piece ids in `LPIECELO.LEB` are just sequential (`5001`...`5219`, chassis `11`...`22`). The names follow three schemes:

- `L<4-digit part number><2 digits>` (28 bricks: `L300200` is part 3002, `L329700` part 3297, `L656400` part 6564). For 20 of them the part of that number matches the game mesh exactly (top-surface error 0.00 to 0.02 plates; all are in the table already). Where the number's part differs from the game's shape (`L241900` is 2419, a plate; `L304500` is 3045; `l248900` is 2489), the game's brick is a variant and the shape-matched part stays. `L81423` ... `L82530` and `L347800` are Racers-only numbers with no catalogue entry.
- `S00xxx` / `s000xx`: sequential special pieces, no number to look up.
- `s`/`S` plus a theme word (`sLance`, `sTorch`, `sFlag`, `Spear`, `Sbat`, `sspider`...): composite models, a base brick with the accessory moulded on (the flag stands on a plate, the torch on a brick), not catalogued parts. The 12 chassis (10 x 6 footprint) have no Rebrickable or LDraw equivalent either (no 4 x 10/6 x 10 racer base has the arches and cut-outs).

So the only source that can draw them is composition: the LDraw base brick plus the LDraw minifigure accessory (lance, sword, flag, ...) placed in the brick's frame; done for 24 pieces (next section). A candidate list (name rule, then shape rank) was rerun with a corrected quad triangulation of the game meshes (the quad's vertices are in strip order); it added `L304900` (the 2 x 2 double slope 3049, error 0.67 plates, mirrored).

### Bricks with no good LDraw match (drawn from the game's own mesh)

The fallback draws the game's faces double-sided in the plastic and also the decals: a face whose material has a picture and is no brick colour (`jt_carw`, `rr_car1`, `rr_logo`, `stw_wt`: headlights, windscreens, logos on the chassis) is drawn with that picture (the engine's own loader, colour-keyed pixels cut out); it was a flat colour before, which read as missing parts. No face is dropped beyond the original's hidden undersides (flags 1, as in `buildCarGeometry`). The gallery has `bottom` and `side` views to check a chassis alone.

- **All 12 chassis** (`JTchas0`, `GM_CHAS0`, `BVBCHA0`, `BBCHAS0`, `CRchas0`, `KKCHAS0`, `DACHAS0`, `DBCHAS0`, `DCCHAS0`, `DDCHAS0`, `RRchas0`, `VVCHAS0`): the Racers chassis are special moulds the library does not have (its car bases are other shapes; the closest plates differ by several plates over the footprint).
- LEGO Racers themed pieces the library lacks or that no part resembles: the lances, spears, swords, axes, bat, oars, guns, flags, shields, rocket noses, the torch, lamp, wand, idol, spider, jungle gem and the like (every `s...` brick below), the toolbox-shaped windscreen frame `s243200` (the most used unmapped brick: 1 or 2 on about half of the saved cars) and `S243201`, `l248900`, `sdrum`/`scylnder`, the sub-brick `Cylinder` (the stud, never in a design).
- The exact list, with the closest part and its error, is `UNMAPPED_BRICK_REASONS`.
- Approximate matches (`heightError` above 0.1 plates) are plain bricks standing in for a printed or decorated one (the game's brick carries a texture the library's part has no pattern for), or a part that is close but not the same (e.g. `S00016` the bracket 99207, `s00019` the Technic brick 80431).

`s243200` (the windscreen frame, the most used unmapped brick, 19 uses on 13 of the 28 saved cars) is now the 1 x 2 x 2 brick `3245c`: the bounding box is exact, the handle and the leaning front are not (`heightError` 0.6, approximate). `S243201` is a thin angled pane; the windscreen 21 is a solid block, so it stays unmapped.

Wheels: the game's own wheels keep their animation; LDraw wheels were not mapped (the chassis is the game's, and the wheels sit on its axles; the wheels are separate GDB models, not bricks). Done since: see [remastered-ldraw-racers.md](remastered-ldraw-racers.md) (wheels and drivers).

Where the LDraw car is drawn: the race, the build-a-car screen (as bricks are placed; the placeholder is the game's mesh in the same plastic until the parts arrive), and the Racer Select showcase, all through `showBuiltCarDrawing` (`track-viewer/services/built-car-drawing`), which asks `getBuiltCarDrawing` and does nothing without an extension. Computer racers and champions are the game's model files (`*cm` GDB models from `CHAMPS.CCB`), not brick lists, so they are not touched: only the cars built from bricks (the player's own and the `DEFAULT.LRS` racers) have designs.

## The look

- Plastic (`ldraw-plastic.ts`, numbers in `ldraw-plastic.constants.ts`): `MeshPhysicalMaterial` with a clear coat, a small studio cube map (generated in code, no file) as environment, subtle edge lines (conditional lines too, dimmed and darkened). Smooth normals come from the loader. The lights (key, fill, rim, hemisphere) live in the car's frame and aim at its origin, so a car looks the same wherever it is. The track keeps its own lighting.
- Studs carry the LEGO logo: `stud.dat` and `stud2.dat` are swapped for the library's `stud-logo<n>.dat` through the loader's file map (`setStudLogoLevel`: 0 plain, 1 thin lines, 2 outlined, 3 sharp 3D, 4 rounded 3D (default), 5 flattened 3D).
- Colours of the game's own faces (bricks with no part): a face is drawn with the brick colour only where the original paints it with the colour's material; the faces with a fixed material (`black` under a chassis, `ltgray`, ...) take that material's colour (`getGameBrickMaterials`; 0x0049a450). This fixed a blue underside on cars whose chassis the original draws black.
- The renderer stays the original's (no colour management, linear output), so the lights were tuned by eye on the gallery for that.

## The gallery

`/ldraw-gallery.html` on the dev server is a page that exposes `renderCar(savePath, index, mode, view, width, height)`, `renderPieceSheet(names, columns, cellSize)` and `getDesignCount(savePath)` on `window` (modes `ldraw`, `game`, `overlay`; views `front`, `rear`, `top`), for a headless browser to call and save the canvas. The page is not part of the build (`vite build` only builds `index.html`).

## Composite S bricks (`ldraw-composite-mappings.ts`)

`LDRAW_COMPOSITE_MAPPINGS`: game brick name to a list of LDraw parts, each with a 3 x 3 matrix and translation from the part (LDraw axes and units) into the brick frame, and an LDraw colour (null: the colour the player placed). The document writer emits one line per part. Generated like the single-part table: the game mesh's surface is sampled, the accessory part (a short list of candidates chosen by the piece's theme) is fitted over all 48 axis-aligned orientations and a translation search against a distance field of the mesh (precision of the part's surface on the mesh), the mesh points it explains are removed and the leftover is fitted with a plain brick, plate or tile (upright only, snapped to the stud grid). Every pair was then checked on a sheet of the game mesh beside the result (`~/ldraw-gallery/pickups/composites-*.png`).

Mapped (25 names, 24 distinct pieces drawn): the lances `sLance`, `sLance01` (3849), swords `sSWORD`, `sSWORD01`, `sprtswd`, `sprtswd2`, rifles `sprtgun`, `sprtgun2`, `srifle1`, `srifle02` (30141), pickaxes `sdsrtax1`, `sdsrtax2` (3841), the wand `SWand`, shields `sa0010`, `sa0011`, `Sshield1`, `Sshield2` (3846), the barrel `l248900` (2489, open top as the part is), flags `s395700`, `sFlag`, `sadm_flg`, `sprt_flg`, `sVvflg` (antenna 3957a as the pole plus a flag part and a base) and the jungle gem `Sjungem`. The flags' printed pictures and the shields' crests are not drawn (plain colour). Tried and dropped as not matching: torch, lamp, spider, round shield, spears, oars, axes, bat, rocket noses, the chest (the part is larger), the crossbow.

## Bricks on the track (`ldraw-pickup/`)

`getEffectModelDrawing` is asked by `race-effects` for each pool of the power-up bricks (`PUBRICKY`, by kind) and the enhancement brick (`ENHABRIK`). The models are bricks: `PUBRICKY` a 1 x 3 brick (2.34 units a stud), `ENHABRIK` a 1 x 2, turned in the mesh (24 vertices; the studs lie on the face toward (0, -0.71, 0.71)). Their drawing is LDraw 3622 and 3004 under a matrix fitted to those vertices, so the pose, spin and scale come from the Classic group matrix unchanged. Colours: projectile red, shield blue, turbo green, hazard yellow, enhancement white. **No printed symbol**: the original's textures (`pupred2` ...) hold only shaded studs; the symbols are HUD pictures, so there is no decal to carry over. The part has no lights of its own (dozens on a track): it takes its look from the studio reflections with a small glow.

Not replaced: the debris bricks (`brick1..4`, `2BRK02`) are not drawn by the port at all (power-up-visuals.md), the cannon ball is a sprite, the rocket `DMISSILE` is a skeletal figure, the grapple hook has no model here, and the barrel `BARREL` is an octagonal drum with a fuse that no LDraw barrel (round, no fuse) matches.
