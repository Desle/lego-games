# Golden trace: power-ups, bricks and projectiles

Companion of [golden-trace.md](golden-trace.md). `power-ups.golden.spec.ts` grants the player (and, with `POWER_UP_COMPUTERS=1`, every racer) a brick of each kind 1 to 4 at each enhancement level 0 to 3 at frame 162, presses the use key at frame 165 and prints the first divergences per scenario:

```
POWER_UP_KINDS=1,4 POWER_UP_LEVELS=0 POWER_UP_REPORT=/tmp/p.txt \
  pnpm --filter @lego-games/lego-racers exec vitest run --config vitest.golden-trace.config.ts power-ups.golden
```

`POWER_UP_DUMP=<dir>` writes the scenarios as JSON (for probes). The grant writes racer `+0xccc` and `+0xd58` in the original (`golden_trace.py`, `powerUpGrants`) and the held brick and level in the port.

Fields (`power_up_trace.py`, `power-up-trace.ts`): `powerUps.bricks` (state `+0x3c`, `+0x40`, timer `+0x4c`, flags `+0x50`, kinds `+0x5c`, `+0x60`, `+0x64`), `powerUps.enhancementBricks`, `powerUps.effects` (active list head first: pool, state, timer, level), `powerUps.explosions`, `racerN.powerUps.level`.

## Fixed

| Where | Original | Bug |
| --- | --- | --- |
| Effect emitters | `0x00451f50`, `0x00454360` (`cannsmk`), `0x00453240` (`dynsprk`), `0x00455440` (`lghthit`), `0x004573a0` (`oilbub`), `0x0045ce20` (`trbsmke`) | The port spawned none. They now take handles and instances in the common pool (power-up system `+0x40`), released as the originals do (`0x00489f30` deferred or `0x00489f00` at once on reset; the born-count test at the tail of `0x00451b50` and `0x00453ef0`). |
| Explosion burst | `0x00421520`, `0x00459b80` | Its pool pointer (`+0x228`) is 0 in the original: the explosion starts **no** emitter. |
| Oil slick landing | `0x004573a0` | Flips the owner's car body (`0x00429cf0`, 0.0015, 150 ms). |
| Racer reactions | `0x004575b0`, `0x00456fa0` (spin `0x00429c40`), `0x00421c00`, `0x00455440` (slot 14 `0x00429c00`, velocity cleared, slot 7 `0x00429a70`), `0x004397b0`, `0x00454690`, tow and pull events | Projectile and power-up events were never applied to car bodies. |
| Registry sweep | `0x0043d270`, `0x0043aaf0` | The extents of a racer in the registry walk are those of its **volume**, not the display sphere: a brick was touched a frame late (touched-this-frame flag, `racec0r0` frame 289). |

## Open

- Projectile and explosion collision with racers is not wired in the race: only triggers and bricks are registry objects. The original registers the cannon ball (sphere radius 3.536, listener `0x004b0778`), grapple hook (2.413), barrel (3.153), rocket (figure, 2.353), oil slick (3, at the landing point +1), magnet and curse (10) and the explosions (growing sphere, listener `0x004b0164`), all type 4, flags 1. Cannon, grapple, barrel, rocket and explosion hits therefore do not happen in play. The model radii come from the JAM models.
- `loadRaceDefinition` passes `EMPTY_PROJECTILE_MODEL_DATA`: rockets launch at once (original state 2 lasts for the launch animation), warps have no route, debris animations are zero.
- Brick colours per kind and size and the projectile render data were not checked.
