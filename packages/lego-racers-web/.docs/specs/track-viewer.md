# Feature: track-viewer

## Behaviour

Shows any LEGO Racers world from the player's own `LEGO.JAM` in the browser: textured, with the original material states, placed with the world's instance transforms, viewed from the world's cameras or freely with orbit and fly controls. A race shows its sky and background world, and skeleton instances (props and characters) play their animation.

## User flows

- **Open the archive**: the player picks or drops `LEGO.JAM`; it is read in the browser and every non-empty `.WDB` is listed by directory. In development the track viewer (opened from the developer overlay, backquote key) has a button that loads the developer's local copy from the dev server.
- **View a race**: the player picks _Whole race_ in a race directory and sees the race's worlds loaded in the game's order (global, track, collision, blended, local), starting from the track's first camera.
- **View one world**: the player picks a world; a world that belongs to a race is loaded after the race worlds the game loads before it, so it finds their textures and materials.
- **Look around**: drag to orbit, scroll to zoom to the cursor, WASD to fly, Q/E to sink and rise, and choose a world camera or the overview.
- **Watch the animation**: a button plays or pauses the skeleton instances and the sky; time runs in whole milliseconds, at most 100 per frame like the engine.
- **See what is missing**: the scene summary lists the loaded worlds, counts, and textures without an image; a world that cannot be linked shows the original's error message.

- **Race**: the page is the game. In development it opens by itself (the dev server serves the local LEGO.JAM, LEGORacers.exe and the music) and the menus start Royal Knights Raceway live (the original's frame clock feeds `stepRace`; arrows, Enter, Right Ctrl, M, Space and Right Alt or a gamepad drive; the chase camera, HUD, music and sounds follow the race). In production the player chooses LEGO.JAM, LEGORacers.exe and the .tun files.

## Invariants

- The archive never leaves the browser.
- The development route, the overlay and its buttons exist only in `vite` development, never in a production build.
- Rendering decisions come from the scene module's render state; nothing is invented per material.
- The sky and the background world are drawn first without the depth test, centred on the camera and never rotating; the track follows.
- Skeleton instance vertices follow the bone matrices of the engine's pose sampling; the instance's root motion is not applied.
- A BSP tree instance (the race track) shows only the draw batches of the leaves the camera's visibility list names and the 65 degree, near 5, far 800 frustum does not reject (`GolDP.dll` `0x100092a0`); the race camera's field of view is the original's 65 degrees.
- A racer's wheels, car model and driver are left out when their sphere centre is farther than 500 units from the camera, and a power-up brick beyond 400 (the engine's level distances).
- The race HUD's overlay draws the minimap: the world's `igd_map` picture as textured triangles, the racers' dots as parts of the `igdcrdot` image and the player's arrow.
- The race's particles ask the viewer extensions for a drawing of every material of its scenes once (`getParticleDrawing`); the emitter quads and the effects' sprite quads (the cannon ball) of a material that has one go to it instead of the original's quads, and with no extension every quad is drawn as before.
- A skeleton instance the world gives no clip plays its first clip (a viewer choice; the game's own code picks it).

## Out of scope

Race mode: the chassis and driver databases (every racer uses a placeholder car and driver model pair, the driver at a placeholder seat), wheels, collision contacts (laps and bricks are not counted), the HUD's bitmap fonts (a browser font stands in), the intro fly-through, and the near plane of the Direct3D camera. Sprites, material animations, level-of-detail switching, the engine's lighting of models with normals (approximated with Lambert lighting), the clear colour below the sky's horizon, racer textures built at run time, and the menu code's world load order.
