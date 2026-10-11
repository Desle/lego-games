# Feature: racer-collision

## Behaviour

The geometry of car-against-car collisions (`RacerSet_Step` pass 4, `0x0043d180`): the 15-axis separating-axis test of two oriented boxes (`0x00441790`), the contact point that follows from it (`0x00441330`), and the bounding spheres the broad phase sorts and tests (`0x004113d0`, `0x00410f10`, `0x00411b90`). The sweep, the response and how it reaches the car bodies are in the `racer` module (`collideRacers`, `respondToRacerContact`); findings and addresses are in `.docs/reverse-engineering/racer.md`.

## User flows

- **Test two boxes**: `getBoxOverlap` takes two `OrientedBox` values (rotation, world centre of mass, dimensions, scale) and returns the smallest face-axis overlap, the normal (pointing from the second box to the first) and the two reaches `0x00441330` compares corners against, or `undefined` when any of the 15 axes separates them.
- **Find the contact point**: `getBoxContact` runs the same test and averages the corners of both boxes that reach into the other along the normal (`NaN` when none does, as the original's 0 / 0).
- **Bound a car**: `getBoundingSphere` carries the model's sphere centre through the display frame; `getBoundingInterval` gives its extent along x, the key of the sweep; `getSpheresOverlap` is the broad-phase test.

## Invariants

- Every function is pure and follows the x87 operand order of the disassembly through `FloatArithmetic`; a bit-for-bit differential test against the original code runs in both precisions.
- No clock, DOM or random source.

## Out of scope

The sweep over the racers, the collision response, the event manager (`0x0042f9f0` and its lists) and the sphere's recomputation cache (it is recomputed every time, which the original's stale marker `-1.0` guarantees after every frame update). The nine edge-pair axes can reject a pair but never choose the normal; cases 6 to 14 of the normal switch (`0x004422e1`) are unreachable.
