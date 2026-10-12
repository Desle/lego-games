# Feature: skid-trail

## Behaviour

The skid marks of the cars: a pool of four trails shared by all racers (`LegoRacers.exe` `0x00492680`), each following a wheel and putting its path onto the track as decals (`0x00491fa0`, `0x00491e20`, `0x00492220`, `0x00492470`).

## User flows

- **Start and let go**: `allocateSkidTrail` takes the first free trail for a kind of 1000 ms (250 ms for a spinning car, whose duration is 248); `releaseSkidTrail` lets it fade over the given milliseconds (0 ends it at the next step).
- **Follow a wheel**: `addSkidTrailPoint` takes the wheel's point and the milliseconds; the first only starts the stretch, later ones that moved 0.1 or more put the decal's box between the last point and this one.
- **Step and draw**: `stepSkidTrailPool` projects the changed stretches onto the track (`projectDecal`, 12 triangles), joins them to the last finished one, finishes a stretch that has lasted a quarter of the duration into a ring of three, and fades released trails; `getSkidTrailMeshes` gives what is drawn.

## Invariants

- A trail in use draws its finished stretches (all three once the ring is full), and the stretch in progress only in a step in which it changed.
- A corner of the new stretch within a quarter of the width (squared distance) of a corner of the last finished one moves onto it.
- The alpha of a fading trail is `trunc((1 - elapsed / duration) * 255 * baseAlpha)`; below 255 it replaces the image's own.

## Out of scope

Which wheels ask for marks (the `racer` module's vehicle skids, `0x0043f1e0`) and the material of the image (the viewer).
