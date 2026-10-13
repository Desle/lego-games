# Feature: material

## Behaviour

Gives LDraw models the look of LEGO plastic: physical materials per LDraw colour and material category (plastic, rubber, transparent, chrome, metallic), a choice of look presets (manual, photo, instructions, toon, game, retro) with their shadings and edge styles, an occlusion volume baked from the model, a studio light rig, and shader precompilation so a model's first frame does not stall.

## User flows

- **Pick a look**: the app sets the active preset with `setActiveLookPreset` (from `?look=`, read by `getLookPreset`, or `useLookFromAddress` on a page); every model made afterwards takes it.
- **Make a model plastic**: `applyPlasticLook(model, volume, isWheel)` replaces the loader's materials with plastic of the active look, sharing one material per source material; a wheel's plastic takes less of the reflected studio.
- **Bake occlusion**: `bakeOcclusionGrid` (in the worker) and `createOcclusionVolume` (on the page) give the looks that want it their ambient occlusion.
- **Precompile shaders**: the app passes `setShaderPrecompiler` a function that compiles a model's programs for its own scene; `precompileShaders` uses it and resolves at once without one.

## Invariants

- Every look preset, shading and edge style stays available; none is dropped as unused.
- A source material gets one plastic material per model, however many meshes use it.
- No game code and no scene of any game: the precompiler and the active look are set by the app.

## Out of scope

Lights and cameras of an app's own scene, textures of any game, and parsing (the `library` and `geometry` modules).
