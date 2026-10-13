# Feature: material

## Behaviour

Gives LDraw models the look of LEGO plastic: physical materials per LDraw colour and material category (plastic, rubber, transparent, chrome, metallic), a choice of look presets (manual, photo, instructions, toon, game, retro) with their shadings and edge styles, an occlusion volume baked from the model, a studio light rig, and shader precompilation so a model's first frame does not stall.

## User flows

- **Pick a look**: the app sets the active preset with `setActiveLookPreset` (from `?look=`, read by `getLookPreset`, or `useLookFromAddress` on a page); every model made afterwards takes it.
- **Make a model plastic**: `applyPlasticLook(model, volume, isWheel)` replaces the loader's materials with plastic of the active look, sharing one material per source material; a wheel's plastic takes less of the reflected studio.
- **Bake occlusion**: `bakeOcclusionGrid` (in the worker) and `createOcclusionVolume` (on the page) give the looks that want it their ambient occlusion.
- **Extend the lighting**: the app registers one `PlasticLightingExtension` with `setPlasticLightingExtension` before its first plastic is compiled: its uniforms, vertex and fragment GLSL, and a float expression for the share of the direct lights (0 to 1) that reaches a fragment (a shadow map's verdict). Every plastic material, every drawing's copy and both details take it; the direct diffuse, specular, clear-coat and sheen terms (and the stylised looks' shade and highlight) are scaled by it, the ambient, hemisphere and reflected studio are not. With none registered the shader is unchanged.
- **Precompile shaders**: the app passes `setShaderPrecompiler` a function that compiles a model's programs for its own scene; `precompileShaders` uses it and resolves at once without one.

## Invariants

- Every look preset, shading and edge style stays available; none is dropped as unused.
- A source material gets one plastic material per model, however many meshes use it.
- No game code and no scene of any game: the precompiler, the lighting extension and the active look are set by the app.
- One lighting extension slot; a program keeps the extension it was compiled with (it is part of the program cache key).

## Out of scope

Lights and cameras of an app's own scene, textures of any game, and parsing (the `library` and `geometry` modules).
