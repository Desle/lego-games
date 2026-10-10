# Feature: collision

## Behaviour

Answers the race's collision questions against the world's BSP volumes (`.BVB`), exactly as `LEGORacers.exe` asks them: where a segment first passes through a triangle (`0x00403fa0`), whether a point lies inside a triangle (`0x004497f0`), and where a segment crosses a cached triangle (`0x00448b80`). Addresses and layouts are in `.docs/reverse-engineering/collision.md`.

## User flows

- **Load a collision object**: `loadCollisionObject` takes a `.BVB` file's bytes, whether the race is mirrored and an optional instance frame, and returns the `CollisionObject` a car rigid body's collision list holds (mirrored by `0x004045e0` for mirrored races).
- **Cast a segment**: `getSegmentQueryResult` takes a `CollisionVolume` and a start and end point and returns the first triangle the segment passes through (its vertices, unit normal, plane distance, material index and the fraction along the segment), preferring a triangle that faces the start, plus the last plane crossing it wrote even when nothing was hit.
- **Test a triangle**: `getIsPointInTriangle` and `getTriangleSegmentResult` test a point or a segment against one triangle record.
- **Name a material**: `getCollisionMaterialName` resolves a hit's material index through the instance's or the volume's material list.

## Invariants

- Every function is pure: frozen data in, frozen data out; no clock, DOM or random source.
- Float operations follow the disassembly's operand order and store points through `simulation-math`'s `FloatArithmetic`.
- Indices and counts are unsigned 16-bit values, as the race code reads them; child values 0xfffe and 0xffff are not nodes.

## Out of scope

The DLL's own BVB tree walk (`0x1001be50`, the query stack size), the BSP trees (`.BDB`), the mirror of an instance's frame (`0x00411040`), and the world's instancing of volumes.
