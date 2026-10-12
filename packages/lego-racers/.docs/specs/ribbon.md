# Feature: ribbon

## Behaviour

Lays the strips the engine builds for the grapple's tether and the wand's beam (`LEGORacers.exe` class `0x00493c90`): a chain of segments, each a bone of a small figure, with rings of vertices on a quadratic curve along every segment, joined into triangles with the texture's v running along the strip.

## User flows

- **Build a strip**: `getRibbonSkin` takes a shape (rings to a segment, the ring's vertex offsets, texture u, wrap, colours) and a request (begin point, direction, segments with their end and sideways bulge, optional jitter) and returns the skin: the figure frame (`0x00493ea0`), a bone per segment (`0x00494030`), the rings (`0x00494870`, `0x00494290`) and the strips that join them (`0x00494480`).
- **Pose a strip**: `getRibbonCorners` returns the triangles in the world; a strip that faces the camera turns its bones first (`0x00494ca0`).

## Invariants

- A segment shorter than the square root of 0.02 adds nothing and takes no bone.
- The ring counter wraps after 3 and a ring is repeated at v 0 at the wrap, except after the last ring of a segment.
- A cell's triangles are written (previous, current + 1, current) and (previous, previous + 1, current + 1).

## Out of scope

Where the tether's and the beam's points come from (`race-presentation`: `0x00444540`, `0x00444690`, `0x00444820`, `0x00454bb0`) and how the viewer draws the corners.
