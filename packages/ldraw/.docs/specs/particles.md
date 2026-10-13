# Feature: particles

## Behaviour

Draws one part of the library in one colour (or a small model of a few parts) as many small particles at once (smoke, sparks, dust, splashes of a game): the part is prepared once through the shared prepare path (the active look's plastic, merged) and drawn as one instanced mesh per material of the part, so a frame's particles cost the draw calls of one part however many there are. Each particle has its own matrix and opacity.

## User flows

- **Make a kind of particle**: `createPartParticles({ modelText, maxCount, nearFadeDistance })` holds the prepared model (`getParticlePartText('4073', 71)` for one part in one colour, or a model file's text) and gives an `object` to add to the scene, `shown`, which resolves once the model is drawable, and `getModelBounds()`, the model's bounds in its LDraw frame once shown (an app sizes its particles by them).
- **Near the camera**: a fragment closer to the camera than `nearFadeDistance` (the drawing's units) fades out, from full at the distance to nothing at half of it, and a fragment that has faded out is dropped (no depth written), so a particle at the lens never fills the screen. 0 never fades.
- **Draw a frame**: `setParticles(count, writeParticle)` draws `count` particles (at most `maxCount`); `writeParticle(index, slot)` sets each one's matrix (from the part's LDraw frame into the object's) with `slot.setMatrix` and its opacity with `slot.setOpacity` (1 when not set). A count of 0 hides the meshes, so a kind with no particles costs no draw call. Particles written before the part is ready are not drawn.
- **Let it go**: `dispose` frees the instanced meshes' own geometry and materials and releases the prepared part.

## Invariants

- The prepared part's geometry and materials are never changed: each instanced mesh has its own copy of the geometry (with the opacity attribute) and of the plastic.
- The fade is the look's own plastic with the instance's opacity applied last (after the look's and the lighting's shader changes), as a program of its own.
- Particles never cast shadows and are never culled by the part's own bounds (they move every frame).
- No game code: which part, colour, size and opacity a game's particle has comes from the app.

## Out of scope

The edge lines of the part (a draw call each for a few pixels at a particle's size), sorting the particles by distance, and simulating them: the app owns where the particles are.
