# Feature: projectile-trail

## Behaviour

The streak behind a cannonball and a rocket (`LegoRacers.exe` `0x00492ae0` to `0x004931a0`, `0x004939b0`, `0x00493a20`): a pool of six trails, each a ring buffer of rings of four points that the projectile pushes every update, built into a small mesh the race draws with the `canstrk` or `mslstrk` material.

## User flows

- **Start and push**: `takeTrail` takes the first free trail (null when all six are in use); `pushTrailRing` hands the projectile's ring of the update (`getBallTrailRing`: four points round the ball across the horizontal perpendicular of its velocity) with the milliseconds, which fill the newest slot and age the oldest.
- **Let go and age out**: `releaseTrail` marks the trail; `stepTrailPool` ages its rings by each update's milliseconds until none are left and the trail is free again.
- **Draw**: `getTrailDrawings` gives the mesh of every trail that was built (`getTrailMesh`: points relative to an origin, the u across a ring, the v along the trail, the alpha falling by a step per ring, the points pulled toward the ring's centre by the age).

## Invariants

- The first ring of a trail only fills a slot; the mesh exists from the second on.
- A trail that is not released does not age, and a released one that never got its first ring never ends (as in the original).
- The mesh holds at most 106 points and 53 triangles.

## Out of scope

When a projectile starts, feeds and lets go of its trail (the `projectiles` module) and the material (the viewer).
