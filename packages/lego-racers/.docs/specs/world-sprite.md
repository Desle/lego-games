# Feature: world-sprite

## Behaviour

Builds the rectangles the engine draws for the sprites of a track world (world keyword `0x37`, `GolDP.dll` `0x10009a70`, the matrix `0x10014e50`): a rectangle of the sprite's width and height centred on its position that faces the camera, or turns around the sprite's axis, drawn only within the sprite's distance of the camera.

## User flows

- **Quads for a camera**: `getWorldSpriteQuads` takes the scene's sprites, the scene's material names, the camera (position, forward, up) and the race's mirror flag, and returns one quad per sprite that is within range, in the world's order, each with the name of its material and its four corners (position and texture coordinates).

## Invariants

- A sprite at distance 0 from the camera, or beyond its limit, has no quad; a sprite without a material has none.
- A sprite without an axis faces the camera whole (the corners of the effects' sprites, `getSpriteQuad`); one with an axis keeps that axis vertical and turns its width across the view direction.
- A mirrored race negates y of positions and axes.

## Out of scope

The material animation of a sprite (keyword `0x3e`), the colour of the vertices (white, the viewer's concern), the texture's row order, and drawing the quads.
