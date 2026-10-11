# Golden trace: the computer racers

Companion of [golden-trace.md](golden-trace.md). `computer-racers.golden.spec.ts` (in `golden-trace/controller/run-golden-trace`) runs the original and the port on every race of `LEGORACE.RCB` (25 entries: 12 forward, 12 mirrored second passes, the final race and its mirror) and prints, per race, the first frame each computer racer field differs. It is a report, not a gate:

```
COMPUTER_FRAMES=1000 COMPUTER_RACES=rkr,igp2 COMPUTER_KIND=idle COMPUTER_REPORT=/tmp/report.txt \
  pnpm --filter @lego-games/lego-racers exec vitest run --config vitest.golden-trace.config.ts computer-racers
```

`COMPUTER_KIND=weave` has the player drive; `COMPUTER_DUMP=<dir>` writes each scenario as JSON for `golden_trace.py`.

Fields (`computer_trace.py`, `computer-trace.ts`): the route follower (`follower.pose`: position, rotation, contact state, lateral limits; `follower.playback`: speed factor, time, indices, previous and next samples, previous time), the personality bytes (`ai.personality`), the proximity timer (`ai.timers`, racer `+0xd34`), the voice base and timer (`ai.voice`), and the rubber band (`race.rubberBand`: countdown and bias). The scripted body's bounce, flip, spin and target speed factors, the held flag and the lap fields were already compared.

## Fixed

| Where                | Original                                               | Bug                                                                                                                                                                                                                                                                                           |
| -------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Follower constructor | `0x004a5190` (called by `0x00429020`)                  | The three rotations start at the identity (w = 1.0), not zero.                                                                                                                                                                                                                                |
| Car body `+0x77c`    | `0x00429d40`, `0x004a5320`                             | It is the follower's **time** (`+0x74c + 0x30`), and `+0x778` its speed factor (`+0x2c`): the ramp after the start boost read a field the port never wrote (0). Slot 8 `0x00429770`, slot 9 `0x00429c40`, `0x004292e0` and `0x00429380` change the speed factor and now change both copies.   |
| Introduction         | `Race_UpdateState1` `0x004349a0`                       | The state does not end while the camera object still holds its animation (`+0x28`, released when the animation finished). Tracks whose animation is longer than 2 s (Race `racec1r1`) were released 2.6 s early.                                                                              |
| Mirrored races       | `BspVolumeInstance_Mirror` `0x00403f80` → `0x00411040` | The instance frame is mirrored too: y of the forward axis, the up axis and the position are negated, the rotation is rebuilt. Without it the lap-line object (`startfin`) of every mirrored race sat on the wrong side and the computers never crossed the line (`racer.crossings`, `zones`). |

## Open (outside the computer code)

- Power-up effects: from about frame 211 the computers pick up and use power-ups. Oil slick (`0x004573a0` flips its owner with `0x00429cf0`), explosions (`0x00421c00` → slot 14 `0x00429c00`, bounce 50 and speed factor 0.1) and the rest change the computers' bodies in the original; the port's projectile objects are another branch (`fix/trace-power-ups`). Most first divergences after frame 211 in `idle` runs are these.
- `racec2r0` frame 560: racer 3 touches a power-up brick in the original at 7.46 units while the volume radius is 6.9; the port does not (borderline of the registry's sphere test, probably the sub-step the volume is read in). The racing-tune/voice draws of the other computers follow (`race.randomPosition` is one draw ahead from frame 569).
