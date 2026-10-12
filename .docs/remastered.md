# The remastered layer

An optional layer above the exact port: things the original never did (upscaled textures, widescreen) live here and nowhere else.

## The rule

**Classic code changes only for fidelity.** Code that draws, simulates or lays out what the original does (everything outside `packages/lego-racers-web/src/modules/remastered/`) changes only to match `LEGORacers.exe` or `GolDP.dll` better. A remastered feature never edits it, except to add a neutral extension point (a hook or an option that says nothing about any feature, and with no extension registered changes nothing). The pixel trace, render trace and golden cases run Classic and must stay green unchanged.

## Where it lives

`packages/lego-racers-web/src/modules/remastered/` (module-first, public `index.ts`). It is a module and not a package: it implements interfaces the web package defines (`src/shared/viewer-extensions/`), uses Three.js and the DOM, and a package would have to depend on the web package that loads it, a cycle. The simulation packages stay free of it.

- `src/shared/viewer-extensions/`: the extension points and the registry (`registerViewerExtension`). Today: `onTextureCreated` (a texture was made from an original bitmap), `onPictureCreated` (a 2D picture, menu image or font sheet, was made; it may be replaced by a bigger one and the viewer scales source rectangles by its size factor), `getMenuSurfaceScale` (resolution of the menu surface relative to its 640 x 480 design), `getSoundReplacement` (a recording to play for an archive sound or tune), `getRaceDisplay` (how the race is laid out: stage size, pixel ratio, HUD design size, HUD command mapping), `getRaceRenderPass` (work to run before each frame of a race is rendered, given the renderer, camera, track scene and the track's group), `getCarDrawing` (a complete car, body, chassis and wheels, in place of the original's, from a champion's body code or a built design), `getDriverDrawing` (a complete driver in place of the original's) and `getEffectModelDrawing` (something to draw in place of the model the original draws for an effect: the power-up and enhancement bricks on the track). A car or a driver the layer has no complete model for is the original's, never mixed; see [remastered-ldraw-racers.md](remastered-ldraw-racers.md).
- `modules/remastered/services/`: `high-definition-texture` (texture packs), `widescreen-display`, `development-texture-server` (the Vite dev route), `remastered-registration` (what `?hd` registers, and the developer panel's choices).

- `modules/remastered/services/real-shadows/`: sun, shadow map and the track's shadow-catching materials; see [remastered-shadows.md](remastered-shadows.md).

## How it is loaded

`main.tsx` imports the module dynamically only when `import.meta.env.DEV` and the URL has `?hd`; a production build has no such import, so none of it is bundled. The developer panel (also development only) offers the Textures choice, which reloads the page with `?hd=<pack>`. Races are recorded for replay with the header marked `isRemastered` (the layer changes drawing and sound only; see [session-replay.md](reverse-engineering/session-replay.md)).

## What it does today

- **Textures**: `?hd=<pack>` swaps each texture for `<LEGO_HD_TEXTURES_ROOT>/<pack>/<archive path>.png` (default root `~/textures/lego-racers`, default pack `ultrasharp`) once loaded, keeping the original's alpha.
- **Widescreen**: the race canvas fills the window at `devicePixelRatio`. The camera keeps the original's 65 degree vertical field of view, so the horizontal one widens (Hor+), and the culling frustum uses the real aspect. The HUD is laid out for the biggest 4:3 area at window height (at native resolution) and each command is then anchored: right third to the right edge, middle third to the centre, left third stays; bottom half to the bottom edge; the pause dimmer stretches over the window. Whether a centred text counts as centred is decided from its start position (**hypothesis**: good enough for the HUD's texts, not exact). Menus stay 4:3 (letterboxed).
- **LDraw cars**: with `?hd`, cars built from bricks are drawn from the official LDraw parts library (`~/ldraw`, served by the dev server) through the extension point `getBuiltCarDrawing`; the developer panel's **Bricks** choice switches back to the original's mesh. See [remastered-ldraw-cars.md](remastered-ldraw-cars.md).

- **Look presets**: `look=manual|studio|photo|movie` changes how the LDraw plastic is made (edge lines, gloss, ambient occlusion, wear, a filmic grade on the LDraw objects only); see [remastered-ldraw-cars.md](remastered-ldraw-cars.md).
- **Real shadows**: with `?hd` the cars, wheels, drivers, power-up bricks, projectiles and hazards cast soft shadows onto the prelit track, and the original's blob shadows are hidden (`shadows=classic` brings them back, `shadows=scenery` lets the static scenery cast too). See [remastered-shadows.md](remastered-shadows.md).

## Adding a remastered feature

1. If Classic needs a way to ask, add a neutral extension point to `ViewerExtension` (name it for what happens, not for the feature), call it from Classic where it happens, and make it a no-op with no extension registered.
2. Implement the feature in `modules/remastered/services/`, with a co-located spec, and register it in `remastered-registration.ts`.
3. Run `pnpm run ci`: the Classic traces prove Classic did not move.
4. Check `pnpm --filter @lego-games/lego-racers-web run build` and that the build output has no remastered code.

## Menus, UI text and audio (`?hd`)

- **Menus at native resolution**: the front end draws on a canvas of `640 x 480 x scale`, where the scale is the device pixels the menu covers per design pixel (quarter steps, at most 8). Every blit, fill and glyph is drawn through a transform by that scale; the 3D backdrops, figures and cinemas render at the same resolution.
- **Menu art and UI text**: menu images (`MENUDATA\*.BMP`), the menu font sheets (`MENUDATA\ENGLISH\*.BMP`), and the race HUD's images and font sheets (`GAMEDATA\COMMON\*.BMP`, `...\ENGLISH\*.BMP`) come from the texture pack. Glyph and source rectangles are in the original's pixels and are multiplied by the picture's size factor. The original's colour key becomes a smooth alpha (bilinear, sharpened) at the pack's resolution. Pictures show the original until the pack's has loaded.
- **Targa effect textures**: the nine `.TGA` textures swap like the bitmaps (path based, `.png`); their alpha is a gradient, so it is stretched bilinearly instead of nearest.
- **Loose `LEGO<n>.BMP`**: `LEGORacers.exe` `FUN_00435f20` and `FUN_0042e720` (callers `FUN_00435c00`, `FUN_0042d510`) look for the first `LEGO<n>.BMP` that does not exist and write the screen to it: they are the player's screenshots, never read by the game. Nothing displays them, so there is nothing to wire; the pack's `GAMEFOLDER/LEGO*.png` are unused.
- **Audio**: `?hd&audio=<variant>` (a bare `audio` is `resample-48k`) plays `<LEGO_HD_AUDIO_ROOT>/<variant>/<archive path>.wav` (default root `~/audio/lego-racers`) in place of an archive sound (`MENUDATA/SOUNDS/X.PCM` is `X.wav`, `GAMEDATA/COMMON/X.PCM` likewise) or tune (`MUSIC/<name>.wav`). The dev route lists a pack's files at `/<variant>/` so absent sounds cost no request; replacements are preloaded, the original plays when one is not ready yet, and the sample timing is the original's (the recording is decoded at the context's rate over its own duration). The developer panel has an Audio selector next to Textures.

## Performance

`?hd&perf` shows an overlay (and keeps the latest numbers in `window.legoPerformance`) in a race: draw calls, triangles and line segments of the frame, the shadow pass's draw calls, triangles and milliseconds, geometries, textures and programs, the frame time (the GPU is waited for, so it is the whole frame), the heap and the seconds the library has spent delivering models. `window.legoSceneBreakdown()`, `legoHeaviest(depth)`, `legoDetailReport()` and `legoWork` say where a frame's cost sits. Code: `modules/remastered/services/performance-monitor/`.

**Measured** (headless Chrome on an Apple GPU, 1280 x 720, a Single Race of six racers, all six cars LDraw models with their LDraw drivers, samples from 20 seconds into the race, median of six one second apart; "long tasks" are the page's thread blocked over 50 ms while the race loaded; Classic with no LDraw is about 140 draw calls, 5 k triangles and 1.1 s of long tasks):

| Look and shadows        | Draw calls | Triangles | Line segments | Shadow triangles | Programs | Long tasks (longest) | Frame ms |
| ----------------------- | ---------- | --------- | ------------- | ---------------- | -------- | -------------------- | -------- |
| Manual, scenery: before | 187        | 57.0 k    | 66.0 k        | 52.1 k           | 48       | 5.2 s (1.04 s)       | 1.6      |
| Manual, scenery: after  | 108        | 20.0 k    | 15.8 k        | 18.2 k           | 24       | 1.4 s (0.43 s)       | 1.6      |
| Manual, classic: before | 702        | 374.7 k   | 473.7 k       |                  | 43       | 5.9 s (1.05 s)       | 2.2      |
| Manual, classic: after  | 117        | 19.7 k    | 15.8 k        |                  | 19       | 1.6 s (0.44 s)       | 1.4      |
| Photo, scenery: before  | 142        | 52.8 k    | 60.8 k        | 52.1 k           | 37       | 5.1 s (1.04 s)       | 1.7      |
| Photo, scenery: after   | 97         | 20.0 k    | 15.8 k        | 18.2 k           | 24       | 1.6 s (0.52 s)       | 2.1      |
| Photo, classic: before  | 201        | 57.8 k    | 66.0 k        |                  | 44       | 5.9 s (1.09 s)       | 1.6      |
| Photo, classic: after   | 124        | 19.3 k    | 15.3 k        |                  | 18       | 2.2 s (0.49 s)       | 1.5      |

The numbers move with where the cars are: the 702 calls, 375 k triangles and 474 k line segments of the third row are the start grid with the cars close to the camera (before: every one of them in the logo detail, each with its own five lights). On an earlier base the same race blocked the page for 11 to 15 s while it loaded. The frame times are those of a fast GPU (the race is CPU bound on it); on a software renderer (SwiftShader, 800 x 450, the weak-GPU proxy) the Manual and scenery frame went from 1070 ms to 205 ms with the cars on the grid. The heap did not shrink (220 to 480 MB before, 230 to 350 MB after: the shared parts are kept for the page's life). The car builder screen draws the same 57 calls, 33 k triangles and 38 k line segments before and after: its car is close, so it is drawn in the logo detail.

**Where the cost was**, in the order of its size:

1. **Logo studs.** `stud-logo4.dat` (the default logo) is some twenty times the triangles and lines of a plain stud; they were 90 % of a car's 84 k triangles and 110 k line segments. A car body is now two models, plain studs and logo studs (`ldraw-car/detail-switch.ts`): the plain one is drawn, and the logo one is built (one at a time, when the camera comes within one and a half times the distance) and drawn only when a stud is at least 14 CSS pixels wide, so the logo is readable (484 LDraw units from the camera at 720 px high, 262 on a 390 px high phone, 969 on a 1440 px monitor). The shadow map always gets the plain one, without edge lines. A close picture (the builder, the showcase, a gallery) looks as before once the logo model has arrived (the gallery render of a car, Manual and Photo, was compared before and after; the plain one shows for the moment the logo one is parsed).
2. **A studio for each car.** Every LDraw car brought five lights, and three.js lights every material of a scene by every light: six cars were 30 lights in each fragment, and each time a car came into view or left it the light count changed and every program was compiled again (37 to 48 programs). The scene now has one studio that the first car moves (`createCarStudio`): the player's car is lit as before, the others by the first car's frame. Wheels and drivers asked the whole scene for its lights every frame (a `getObjectByProperty` over the track); the answer is kept.
3. **Parsing on the page's thread.** The loader's smooth normals and the merge took 4 to 10 s of the page's thread for six cars (the profile's biggest entry). A module worker (`ldraw-worker/`) now parses each model, bakes its occlusion grid, takes a car's wheels out and merges the model, and sends buffers (transferred, not copied); the page makes the materials and the plastic. Without `Worker` the same code runs on the page.
4. **Many small objects.** `mergeModelByMaterial` turns a model into one mesh per material and one line set per edge material, in the model's frame. Wheel, driver and pickup parts are parsed, baked and merged once for each text and detail and shared by every drawing (`detailed-model.ts`); each drawing keeps its own copies of the mesh materials, so a ghost can fade alone. The power-up bricks of a track share one set of materials.
5. **Shaders.** A model's programs are compiled with `renderer.compileAsync` (the browser's compile threads) before it joins the race, once the scene has its lights.
6. **Texture memory.** On a touch screen of at most 1400 CSS pixels (a phone, a tablet) the texture pack's pictures are drawn at most 1024 pixels on a side (the 2560 x 1920 menu pictures are 20 MB each on the GPU); `?maxtexture=<pixels>` sets it by hand, `0` lifts it. A desktop is untouched.

**Not done.** Conditional lines are kept (a third of the line count now). Instancing the repeated parts of a car, and the library's 8-segment primitives for round parts, were left out: the 8-segment ones would show as octagons on the large round parts at race distance (judged from the sizes, not tried). The drivers' parts are still a mesh and a line set each (about 30 draw calls for six drivers). Classic is not touched.
