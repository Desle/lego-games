# Track materials (`.TMB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/track-material`.

`TrackMaterials_Load` (`0x00444030`, race `+0x27e0`, called by `0x00435d20` when RAB keyword `0x43` named a file; arguments name, JAM, mirror, `RET 0xc`):

```
0x27 [ count ] {
  (0x27 "name" { keywords }) * count    // 0x00443cf0; name ≤ 8, registered with 0x00411870
}
```

Entries are `0x5c` bytes, reset to zero by `0x00443ca0`. Each keyword sets a bit of the flags at `+8`; bit 1 is set when the block ends.

| Keyword                           | Values                             | Offset                                | Bit                               |
| --------------------------------- | ---------------------------------- | ------------------------------------- | --------------------------------- |
| `0x28` / `0x29` / `0x2a` / `0x2b` | int                                | `+0x0c` / `+0x10` / `+0x14` / `+0x18` | `0x2` / `0x4` / `0x8` / `0x10`    |
| `0x2c`                            | 3 floats (y negated when mirrored) | `+0x1c`                               | `0x20`                            |
| `0x2d`                            | 3 floats (y negated when mirrored) | `+0x28`                               | `0x40`                            |
| `0x2e` / `0x2f` / `0x30`          | int                                | `+0x34` / `+0x38` / `+0x3c`           | `0x80` / `0x100` / `0x200`        |
| `0x31`                            | name ≤ 8                           | `+0x40`                               | `0x400`                           |
| `0x32`..`0x36`                    | float                              | `+0x48`..`+0x58`                      | `0x800`..`0x8000`                 |
| `0x37` / `0x38` / `0x39`          | —                                  | —                                     | `0x10000` / `0x20000` / `0x40000` |

Anything else is error 0. All names in the port are neutral. In the data, `0x31` holds emitter names (`grassemt`) and the entry names are collision surfaces (`grass`, `go_thru`), but the code that uses them is not recovered.

Verified: all 14 `.TMB` files parse to their last byte.
