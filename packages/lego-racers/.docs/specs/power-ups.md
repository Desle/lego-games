# Feature: power-ups

## Behaviour

The power-up behaviour of a race: the coloured bricks racers pick up and the white enhancement ("plus") bricks that raise their level to 3, using a brick, and the eleven effects it can start (cannon, grapple, wand, rockets, oil slick, barrel, magnet, curse, shield, turbo, warp) with their timings and what they do to the racers they hit. `power-up` is the PWB file format; `power-ups` is this behaviour, which reads its placements from `power-up`'s parser. Details, addresses and the ported / not-ported list are in `.docs/reverse-engineering/power-ups.md`.

## User flows

- **Load**: `createPowerUpWorld` takes the parsed bricks and enhancement bricks, the race mode flags, the split-screen flag, each racer's voice set-up and the random table with its position; it builds the bricks and effect pools and makes the wands' load-time draws.
- **Each frame**: `updatePowerUps` advances bricks, the spin angle and every active effect, then recycles finished effects. It returns the new world and the events for the racer, sound and explosion code.
- **Pick up**: the collision code reports contacts to `touchPowerUpBricks` and `touchEnhancementBricks`.
- **Use**: a human's fire button calls `usePowerUp`; computer racers call `advanceComputerPowerUpUse` each sub-step (it runs `racer-ai`'s decision), `rollComputerStartTurbo` at the start and `keepPermanentTurbo` when they have that ability.
- **Hits**: the projectile and collision code (not ported) calls `hitRacerWithProjectile`, `touchHazardEffect` and `endProjectileFlight`.

## Invariants

- Every function is pure: frozen state in, frozen state and events out; nothing reads a clock, the DOM or `Math.random`.
- Every random draw reads the `random-table` at the world's position and returns the advanced position, in the original order.
- Floats follow the `simulation-math` precision policy and the stores of the disassembly.

## Out of scope

Projectile flight and collision geometry, explosions and their damage, debris objects, the grapple and magnet pulls, the warp's movement, the racer flags the events ask for (owned by the racer module), models, sounds and drawing; the PWB format (`power-up`) and the computer's decision (`racer-ai`).
