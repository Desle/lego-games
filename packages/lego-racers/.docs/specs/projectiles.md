# Feature: projectiles

## Behaviour

Everything that moves in the power-up effects: the cannonball, the barrel, the rockets, the grapple hook and its tow, the wand's beam, the magnet and its pull, the warp's carry along the route and its landing, the turbo's early end, the explosions and their blast, and the brick debris. `power-ups` owns the bricks, the effects' start, timeline and hit outcomes; this module adds the movement and calls the entry points `power-ups` exposes (`hitRacerWithProjectile`, `endProjectileFlight`, `touchHazardEffect`). Details, addresses and the ported / not-ported list are in `.docs/reverse-engineering/projectiles.md`.

## User flows

- **Each frame**: `updatePowerUpsWithProjectiles` runs `power-ups`' `updatePowerUps` with its own effects updater: for each active effect, in list order, the effect's countdown and its movement, then the explosions and the debris. It returns the new `power-ups` step and the new `ProjectileWorld`, whose `events` are the racer-side requests of the frame.
- **Touches**: the collision registry (`getRegistryContacts`, which also sorts with `getSortedRegistryEntries`) pairs racers with projectiles, hazards and explosions; the caller passes the pairs to `touchProjectileFlights`, `touchProjectileHazards` and `touchProjectileExplosions` before the next update.
- **Probes**: the track's line probe is a `LineProbe`; `createTrackLineProbe` builds one from the `collision` module's BVB query.
- **Flights on their own**: `launchFlightAtRacer`, `launchFlightAtPoint`, `launchFlightWithOffset`, `advanceBallisticFlight`, `reflectBallisticFlight`, `advanceHomingFlight` and `advanceGrappleHook` can be used without the effects.

## Invariants

- Every function is pure: frozen state in, frozen state out; nothing reads a clock, the DOM or `Math.random`.
- Every random draw is `power-ups`' (voices, shields, debris, scatter); this module draws none.
- Floats follow the `simulation-math` precision policy and the stores of the disassembly.
- The moving effects' order inside one frame matches the original's slot 2: the cannon, grapple and rocket flights come after the countdown, the barrel's flight before it, the warp's carry before it, the wand's beam between the hold and the sparks.

## Out of scope

Model data the original reads from the JAM (the rockets' launch animations and heading, the debris animations, the bounding spheres), which the caller passes in; launcher-owned effects (the track hazards that fire cannons and warps, power-up system `+0x1998`); the car body and rigid body reactions the events ask for; drawing, sounds and emitters; the dynamic spheres of the world's line query (`0x0041f4d0`).
