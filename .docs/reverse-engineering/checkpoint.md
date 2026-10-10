# Checkpoints (`.CPB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/checkpoint`.

## Layout (`Checkpoints_Load`, `0x0041e770`, arguments name, JAM, mirror)

```
0x27 [ count ] {                 // count > 0xfe: "Too many CheckPoints" (0x004be820), fatal (0x0041e856)
  (0x27 { keywords }) * count    // 0x0041e640
}
```

| Keyword | Values                      | Checkpoint offset (`0x24` bytes) | Mirror     |
| ------- | --------------------------- | -------------------------------- | ---------- |
| `0x28`  | 4 floats (plane)            | `+0x00`..`+0x0c`                 | negate 2nd |
| `0x29`  | 4 integers, stored as bytes | `+0x20`..`+0x23`                 | —          |
| `0x2a`  | 3 floats (point)            | `+0x10`..`+0x18`                 | negate 2nd |

Any other keyword is error 0. `Checkpoint_Reset` (`0x0041e600`): zeros, `+0x1c` = -1.0, links `0xffffffff`. Byte 0 of the links is the next checkpoint, bytes 1..3 start branches, `0xff` is none.

## Progress (`Checkpoints_AssignProgress`, `0x0041e950`)

1. `0x0041ea60`: count the steps along next links from checkpoint 0 until back at 0 or the count is reached.
2. `step = (float)(1.0f / length)` (`FILD`, `FDIVR [0x004af388]`, `FSTP float`). The sum starts at 0.0 (`0x004af300`) in an x87 register; for each checkpoint along next links from 0: store `(float)sum` at `+0x1c`, `sum += step`, follow the next link, stop at checkpoint 0 or when `sum < 1.0` fails.
3. Walking the loop from 0 again, for each branch link `k = 1..3` that is not `0xff`: `0x0041ea90` follows next links from the branch start while the progress is -1.0 (`0x004afaec`) and fewer than count steps were taken, returning the first assigned checkpoint (merge) and the step count `n`. Then `delta = (merge.progress - here.progress) / (n + 1)` and `sum = here.progress + delta` stay in registers; along the branch from its start until the merge: store `(float)sum`, `sum += delta`.

The port keeps the register values as doubles (53-bit precision under the CRT control word, see game-map.md) and rounds at each store. An empty array, a link at or past the count, or a walk that never ends throw `UnportableCheckpointsError`.

Verified: all 13 `.CPB` files parse to their last byte and every checkpoint gets a progress.
