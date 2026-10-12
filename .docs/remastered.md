# The remastered layer

An optional layer above the exact port: things the original never did (upscaled textures, widescreen) live here and nowhere else.

## The rule

**Classic code changes only for fidelity.** Code that draws, simulates or lays out what the original does (everything outside `packages/lego-racers-web/src/modules/remastered/`) changes only to match `LEGORacers.exe` or `GolDP.dll` better. A remastered feature never edits it, except to add a neutral extension point (a hook or an option that says nothing about any feature, and with no extension registered changes nothing). The pixel trace, render trace and golden cases run Classic and must stay green unchanged.

## Where it lives

`packages/lego-racers-web/src/modules/remastered/` (module-first, public `index.ts`). It is a module and not a package: it implements interfaces the web package defines (`src/shared/viewer-extensions/`), uses Three.js and the DOM, and a package would have to depend on the web package that loads it, a cycle. The simulation packages stay free of it.

- `src/shared/viewer-extensions/`: the extension points and the registry (`registerViewerExtension`). Today: `onTextureCreated` (a texture was made from an original bitmap), `getRaceDisplay` (how the race is laid out: stage size, pixel ratio, HUD design size, HUD command mapping) and the optional `getBuiltCarDrawing` (something to draw in place of the mesh the original builds for a built car).
- `modules/remastered/services/`: `high-definition-texture` (texture packs), `widescreen-display`, `development-texture-server` (the Vite dev route), `remastered-registration` (what `?hd` registers, and the developer panel's choices).

## How it is loaded

`main.tsx` imports the module dynamically only when `import.meta.env.DEV` and the URL has `?hd`; a production build has no such import, so none of it is bundled. The developer panel (also development only) offers the Textures choice, which reloads the page with `?hd=<pack>`. Races are not recorded for replay while an extension is registered.

## What it does today

- **Textures**: `?hd=<pack>` swaps each texture for `<LEGO_HD_TEXTURES_ROOT>/<pack>/<archive path>.png` (default root `~/textures/lego-racers`, default pack `ultrasharp`) once loaded, keeping the original's alpha.
- **Widescreen**: the race canvas fills the window at `devicePixelRatio`. The camera keeps the original's 65 degree vertical field of view, so the horizontal one widens (Hor+), and the culling frustum uses the real aspect. The HUD is laid out for the biggest 4:3 area at window height (at native resolution) and each command is then anchored: right third to the right edge, middle third to the centre, left third stays; bottom half to the bottom edge; the pause dimmer stretches over the window. Whether a centred text counts as centred is decided from its start position (**hypothesis**: good enough for the HUD's texts, not exact). Menus stay 800 x 600 (4:3).
- **LDraw cars**: with `?hd`, cars built from bricks are drawn from the official LDraw parts library (`~/ldraw`, served by the dev server) through the optional extension point `getBuiltCarDrawing`; the developer panel's **Bricks** choice switches back to the original's mesh. See [remastered-ldraw-cars.md](remastered-ldraw-cars.md).

## Adding a remastered feature

1. If Classic needs a way to ask, add a neutral extension point to `ViewerExtension` (name it for what happens, not for the feature), call it from Classic where it happens, and make it a no-op with no extension registered.
2. Implement the feature in `modules/remastered/services/`, with a co-located spec, and register it in `remastered-registration.ts`.
3. Run `pnpm run ci`: the Classic traces prove Classic did not move.
4. Check `pnpm --filter @lego-games/lego-racers-web run build` and that the build output has no remastered code.
