# Ghost (`.GHB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/ghost`.

`Ghost_Load` (`0x00423160`, ghost at race session `+0x3400`) builds the name from 8 characters plus the reader's extension and returns early (ghost data `+0x2598` = 0) when `Jam_FindFile` (`0x0044c9c0`) reports 8 (not found). Binary or text depends on ghost flags `+0x3b4` bit 4; mirroring on bit `0x20`.

```
0x2c {
  keywords        // until "}", nothing after it is read
}
```

| Keyword | Values                   | Ghost data offset                                    | Mirror             |
| ------- | ------------------------ | ---------------------------------------------------- | ------------------ |
| `0x27`  | `[ n ] {` n × 7 ints `}` | count `+0x2598`, samples from `+0x0c`, 10 bytes each | per sample         |
| `0x28`  | 3 floats                 | `+0x25a0`..`+0x25a8`                                 | negate 2nd         |
| `0x29`  | 4 floats                 | `+0x25ac`..`+0x25b8`                                 | negate 2nd and 4th |
| `0x2a`  | 3 ints                   | `+0x00`..`+0x08`                                     | —                  |
| `0x2b`  | int                      | `+0x259c`                                            | —                  |

Anything else is error 0; `+0x25bc` is cleared afterwards. A sample is three `int16` and four bytes. `GhostRecorder_RecordSample` (`0x00422710`) writes the same layout every 250 ms (`+0xfa`) while the count is below `0x3c1`: the car body's position truncated to `int16`, and four truncated values from `0x00449460` (an orientation); the first sample also stores the float position and quaternion at `+0x25a0`/`+0x25ac`. Mirrored samples negate the y `int16` and bytes 1 and 3. More than 961 samples would overrun the buffer; the port throws.

Unknown: the three integers of `0x2a` and the integer of `0x2b`, and the scale of the orientation bytes.

Verified: all 12 `.GHB` files parse to their last byte.

The ghost object that holds three such runs (the champion's, the session's best and the one being recorded), its clocks, the recorder's timer, the playback interpolation and the hold at the menu after a ghost race are in [game-progression.md](game-progression.md). The three leading integers are the lap times in milliseconds; the playback and recording are ported in `ghost` (`recordGhostSample`, `stepGhostPlayback`, `finishGhostRun`); `encodeGhost` writes a run as a `.GHB` (not in the original, which keeps the best run in memory only).
