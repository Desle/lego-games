# Feature: remastered

## Behaviour

An optional layer above the original port, for development only: with `?hd[=<texture pack>]` the race fills the whole window at the display's native resolution (wider than 4:3, with the original's 65 degree vertical field of view), the HUD sits on the window's corners, and textures are swapped for an upscaled pack. It plugs into the viewer's extension points (`src/shared/viewer-extensions/`); the original's drawing code does not know it. See `.docs/remastered.md` at the repository root.

## User flows

- **Turn it on**: open the page with `?hd` (or `?hd=<pack>`) in development, or pick a pack in the developer panel (backquote key, Textures), which reloads the page.
- **Turn it off**: open the page without `?hd`, or pick _Classic (original)_ in the developer panel.
- **Play widescreen**: start a race; the canvas follows the window, including resizing. The menus stay 4:3.
- **Judge LDraw work**: `pnpm run ldraw-fidelity [filter]` scores every LDraw replacement (bricks, chassis, track bricks, champion cars, wheels, drivers in four poses) against the original in the same scene; a replacement is done when its score passes (`.docs/remastered.md`, Judging LDraw work).

- **Build the cars by hand**: open `/ldraw-builder.html` on the dev server. The queue lists the 24 chassis recipes (the 12 garage chassis and the 12 the other champions drive) and the 20 champions' car bodies with the progress (done of 44); each item shows the original's model (side by side, ghost or off, same camera) next to the LDraw build, which starts from the models folder's file (a car on its chassis recipe, shown but not editable). Parts come from the library as picture tiles (search or shortlist tabs); a picked part is in hand and follows the cursor on the studs, a click places it, Esc puts it down, with an empty hand a click selects and a drag moves along the stud grid; Mac trackpad camera (scroll orbits, Shift scroll pans, pinch zooms) and shortcuts behind `?`; **Done** writes the `.ldr` into the models folder (the old file to `drafts/backups/` first), marks it done in `builder-progress.json` and opens the next one.
- **Side studs (SNOT) in the builder**: T and ⇧T tilt the part in hand or the selection 90° about the level axis across the view (snapped to an LDraw axis, so every turn stays ±1 and 0). Pointing at a side stud (found from the `stud*.dat` primitives a part's file and subfiles place, with their matrices) turns the part in hand so its bottom faces that stud's face and snaps its anti-studs onto the face's 20 LDU grid; upward studs keep the plain placement. ⌥ arrows nudge the selection a quarter stud (5 LDU), ⌥⌘↑↓ half a plate (4 LDU).

## Invariants

- With no extension registered the viewer draws exactly what the original draws; the pixel trace and render trace run without this module.
- A production build contains none of it: the module is imported only dynamically behind `import.meta.env.DEV`.
- The culling frustum uses the camera's real (wider) aspect, with the original's vertical field of view.
- A race with an extension registered is not recorded for replay.

## Out of scope

- Widescreen menus.
- Anything that changes the simulation.
