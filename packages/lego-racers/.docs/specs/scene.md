# Feature: scene

## Behaviour

Resolves one or more `.WDB` worlds into a renderable, frozen scene description, exactly as `GolDP.dll` loads and links them: it finds every texture database, material library, model and material assignment the worlds name in `LEGO.JAM`, decodes the textures' bitmaps (with their colour key), turns every material's flags into the Direct3D render state the renderer sets, resolves each model's draw commands into triangle batches, and places the mesh and BSP tree instances with their transforms. It also lists the worlds' cameras and lights. It uses no DOM or rendering library.

## User flows

- **Load a world**: a viewer passes the archive and a list with one world path and gets a `Scene` with textures, materials, meshes, material assignments, instances, cameras and lights.
- **Load a race**: a viewer takes the world names from a race description and gets the paths in the order the game loads them (`getRaceWorldPaths`); loading them together lets later worlds use the textures and materials of earlier ones, as in the game.
- **List the worlds**: `getWorldPaths` lists every `.WDB` in the archive.
- **Load a broken scene**: a world that names a texture, material, mesh, assignment or BSP tree the engine cannot find fails with a `SceneLinkError` carrying the original's message (`Mat def file references unknown texture: …`, `…: Material assignment failed`, `Illegal mesh reference`, `Illegal alt mat assign ref val`, `Illegal bsp tree reference`); a missing file fails with the archive's `JamLookupError`.

## Invariants

- Every file is opened as the engine opens it: the listed name gets `.tdf`/`.mdf`/`.gdf` appended, the reader replaces that with its default extension, and the path is the world's directory joined to the name, uppercased.
- A texture name already registered by an earlier database is never registered again; a material name resolves to the most recently loaded library that defines it.
- Face corners are vertex-cache slots, read through the cache as the commands fill it.
- Material assignments stay with their level slot when levels are reordered by distance.
- The scene and everything in it is frozen.

## Out of scope

Skeleton instances, sprites, BSP volumes, animations and material animations (their files are not loaded), level-of-detail selection, the lighting computation for models with normals, Targa (`.TGA`) textures, and the menu code's world load order (menu worlds that depend on another world fail as in a lone load).
