# Feature: track-viewer

## Behaviour

Shows any LEGO Racers world from the player's own `LEGO.JAM` in the browser: textured, with the original material states, placed with the world's instance transforms, viewed from the world's cameras or freely with orbit and fly controls.

## User flows

- **Open the archive**: the player picks or drops `LEGO.JAM`; it is read in the browser and every non-empty `.WDB` is listed by directory. In development a button loads the developer's local copy from the dev server instead.
- **View a race**: the player picks _Whole race_ in a race directory and sees the race's worlds loaded in the game's order (global, track, collision, blended, local), starting from the track's first camera.
- **View one world**: the player picks a world; a world that belongs to a race is loaded after the race worlds the game loads before it, so it finds their textures and materials.
- **Look around**: drag to orbit, scroll to zoom to the cursor, WASD to fly, Q/E to sink and rise, and choose a world camera or the overview.
- **See what is missing**: the scene summary lists the loaded worlds, counts, and textures without an image; a world that cannot be linked shows the original's error message.

## Invariants

- The archive never leaves the browser.
- The development route and button exist only in `vite` development, never in a production build.
- Rendering decisions come from the scene module's render state; nothing is invented per material.

## Out of scope

Animation, skeleton instances, sprites, the sky, level-of-detail switching, the engine's lighting of models with normals (approximated with Lambert lighting), Targa textures, racer textures built at run time, and the menu code's world load order.
