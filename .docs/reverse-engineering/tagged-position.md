# Tagged positions (`.TGB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/tagged-position`.

`Tgb_Load` (`0x0045c3d0`, race `+0x2804`, arguments name, JAM, mirror) is called by `0x00433480` only when race description keyword `0x4a` named a file.

```
0x27 [ count ]                  // count 0: the reader is closed, nothing more is read
{ (0x27 { keywords }) * count }
```

| Keyword | Values   | Entry offset (`0x14` bytes, `0x0045c380`) | Mirror     |
| ------- | -------- | ----------------------------------------- | ---------- |
| `0x28`  | 3 floats | `+0x00`..`+0x08`                          | negate 2nd |
| `0x29`  | int      | `+0x0c`                                   | —          |

Defaults: origin, identifier -1 (`0x0045c562`). `0x0045c380` also sets bits 3 at `+0x10`. Any other keyword is error 0. What the race does with them is not recovered.

Verified: all 5 `.TGB` files parse to their last byte.
