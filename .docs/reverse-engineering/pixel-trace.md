# Pixel trace: what the viewer puts on the screen, against the original

The golden, render and decal traces compare the **data**: simulation state, triangles in world or screen space. None of them looks at what the viewer's WebGL output contains, so a bug between the data and the pixels slips through. `pnpm run pixel-trace` closes that gap: it draws the original's frame in software, runs the **real viewer** in a headless Chrome, and compares the two images pixel by pixel.

`pnpm run pixel-trace` needs the original files, the emulator's virtualenv and a Chrome (`/Applications/Google Chrome.app`, `google-chrome`, or `CHROME_PATH`); without them the specs skip. It is not part of `pnpm run ci`. Each case takes 10 to 60 seconds.

## The two images

**Reference.** The emulator records every Direct3D draw of a frame (`render_trace.py`, see [render-trace.md](render-trace.md)): screen-space vertices, indices, the render and stage states, the texture surface. `rasteriseFrame` (`presentation-trace` module, `controller/pixel-trace/`) draws them into 640 x 480 RGBA: pixel centres at +0.5 and the top-left rule, UVs perspective correct with the recorded `1/w`, colours linear in screen space, the 16-bit surfaces decoded through their masks, point or bilinear sampling and wrap or clamp from the stage state, the depth test (less or equal) and write, texture operations select-diffuse, select-texture and modulate, the alpha test and the blend factors, strips and fans as well as lists. Not drawn: the HUD (the draws after the last depth-tested one; the viewer draws the HUD as page elements, not canvas pixels), mip-mapping, the colour key (render state 41), specular. The clear colour is the viewer's, because the original's sky covers the frame.

**Port.** `pixel-trace-browser.ts` starts a Vite development server of its own (from port 5400 up, never the developer's) and a headless Chrome with its own profile and software WebGL (SwiftShader, so the pixels do not depend on the graphics card), and opens `/?pixel-trace`. In development `main.tsx` installs `window.runPixelTrace` instead of the game (`pixel-trace-harness.ts`). The runner loads the race from the development routes (`LEGO.JAM`, `LEGORacers.exe`) exactly as the trace scenario does, steps it with the scenario's frame times, controls and power-up grants (`runRaceFrames`, shared with the other traces), drives the real `createRaceViewport` (`update`, `showHazards`, `animate`, `render`) at 640 x 480, and copies the canvas into a 2D canvas in the same task to read the pixels. The camera is the port's own chase camera, not the original's matrix: a camera error shows as a difference.

What is **not** the viewer's own path: the race loop of `useRaceController` (menus, ghost cars, pause, audio) is replaced by the scripted loop; the viewport, the materials, the scene objects and the decals are the viewer's.

## The comparison

`comparePixels` marks a pixel when any colour channel differs by more than the tolerance (32 levels: the surfaces are 5 or 6 bits per channel and the port filters differently). It reports:

- the share of differing pixels per frame;
- the regions: 16-pixel cells with at least 12 differing pixels, joined into 8-connected regions, each with its bounding box, the mean colour of its differing pixels in the original and in the port, and the **original textures under them** (named by the port texture they match, `matchTextures`, or by hash when none matches), so a failure says what is missing or wrong;
- per original texture, the pixels it owns and how many differ.

A case (`pixel-trace-cases.ts`) is a `TraceScenarioRequest` of the render trace plus the largest share of differing pixels on its worst frame and, optionally, `watchedTextures`: a texture whose own pixels may differ at most so much (the oil slick's picture, so the slick's few pixels cannot hide in the frame's total). Set `PIXEL_TRACE_DUMP=<folder>` to write each frame's reference and port RGBA to files for analysis with numbers (`<case>-<frame>-reference.rgba` and `-port.rgba`, 640 x 480 x 4 bytes). Add `--silent=false` to vitest to print the report of a passing case.

## Adding a case

Add an entry to `PIXEL_TRACE_CASES`, run `pnpm run pixel-trace` with a threshold of 1 to read the baseline, set the threshold to the measurement plus a margin, and document anything open below. A change to what the viewer draws is done only when its case passes (`.docs/rules.md`).

## Finding 1: decal textures were sampled upside down

The first case, `Royal Knights, oil slick` (the slick is dropped at frame 305; frames 306 to 330 have it behind the car), failed on main: 2.56 percent of the frame differed at frame 306 and **35 percent of the pixels the original paints with the oil picture (`oilslk64`)** were wrong. Two regions, mirrored about the screen's centre line: the original's dark pool at x 219 to 301, y 417 to 479 (mean colour 15) where the port showed the plain road (84), and the port's pool in the other half (16 where the original has the road, 86). The decal's triangles and picture coordinates equal the original's (`decal-trace`), and so do the original's draws (`u`, `v` of the draw equal the decal's stored values). What differs is the **picture**: the original uploads the decal pictures `oilslk64` and `skid` exactly as stored (the surface equals the bitmap, top row first, checked with `matchTextures` against both row orders), while the viewer reversed the rows of every texture (finding 8 of [render-trace.md](render-trace.md): the textures the DLL loads for worlds and models hold the last row first). The pool's picture is not symmetric, so the blob landed on the wrong part of the decal's quad and the decal showed the road, as a few stray patches.

Fix: `createDecalMaterial` creates its texture with the rows kept (`createSceneMaterial(..., isRowOrderKept)`). Afterwards the picture's own pixels differ by less than 5 percent (the case asserts it) and frame 306 reads 0.64 percent.

**Hypothesis, not traced:** which texture-creation path leaves the rows as stored (the decals' pictures come from the power-up library `POWERUP.MDB` and the race's own materials through the exe, not through the DLL's world loader) has not been read from `LEGORacers.exe`; the evidence is the surface comparison above for the oil slick and the skid marks. The barrel scars and the crane's shadow use the same material code; their pixels stay inside their cases' thresholds, which is no proof of the row order.

## Baseline

Worst frame of each case at the tolerance of 32 levels (the specs' thresholds are these plus a margin):

| Case                           | Worst frame | What differs                                                                                                                                                                                                                                          |
| ------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Royal Knights, oil slick       | 0.84 %      | skid marks darker in the original (15 against 59; **hypothesis:** the original modulates the quads by a grey diffuse colour, as the oil's draws do with 127, and the viewer's vertex colours are white), a few textures with no matching port picture |
| Royal Knights (frames 100-320) | 3.4 %       | the same skid marks, `rkfence`, two pictures the matcher names by hash                                                                                                                                                                                |
| Royal Knights, introduction    | 51.5 %      | **open**: at frame 5 the whole scene is displaced (graphit4, rkroad4, rkgrass all differ): the introduction camera is not the original's                                                                                                              |
| Royal Knights, power slide     | 7.7 %       | the grass particles (`graspart`, 59 percent of their pixels) are far brighter in the viewer; skid marks                                                                                                                                               |
| Royal Knights, warp            | 99.6 %      | **open**: the warp tunnel (`847a8b93...`) is a different colour and shape from the original's (mean 0,0,99 against 9,6,41)                                                                                                                            |
| Royal Knights, barrel scars    | 0.97 %      | skid marks, the same unmatched picture                                                                                                                                                                                                                |
| RACEC0R1, crane shadow         | 6.5 %       | **open**: the netting texture (`netting`, 30 to 50 percent of its pixels)                                                                                                                                                                             |

Not covered yet: the front end (a 2D canvas driven by another stepping loop; a menu case needs `front_end_trace.py` and the front-end controller in the harness) and the HUD (page elements).
