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

### Bricks with no good LDraw match (drawn from the game's own mesh)

- **All 12 chassis** (`JTchas0`, `GM_CHAS0`, `BVBCHA0`, `BBCHAS0`, `CRchas0`, `KKCHAS0`, `DACHAS0`, `DBCHAS0`, `DCCHAS0`, `DDCHAS0`, `RRchas0`, `VVCHAS0`): the Racers chassis are special moulds the library does not have (its car bases are other shapes; the closest plates differ by several plates over the footprint).
- LEGO Racers themed pieces the library lacks or that no part resembles: the lances, spears, swords, axes, bat, oars, guns, flags, shields, rocket noses, the torch, lamp, wand, idol, spider, jungle gem and the like (every `s...` brick below), the toolbox-shaped windscreen frame `s243200` (the most used unmapped brick: 1 or 2 on about half of the saved cars) and `S243201`, `L304900`, `l248900`, `sdrum`/`scylnder`, the sub-brick `Cylinder` (the stud, never in a design).
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
