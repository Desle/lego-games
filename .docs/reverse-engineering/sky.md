# Sky (`.SKB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/sky`.

`Sky_Load` (`0x0041c550`, race `+0x2f90`):

```
0x2c [ settingCount ] {                       // brackets via 0x0044e8c0/0x0044e8e0
  (0x27 [ keyframeCount ] "name" {            // name ≤ 8, registered with 0x00411870
     (0x27 { keywords }) * keyframeCount
  }) * settingCount
}
token: if 0x2d, name ≤ 8 → index of that setting at +0xb8 (0 when absent or unknown)
token: if 0x2e, float → +0xac
```

Settings are `0x10` bytes at sky `+0xa8` (count `+0xb0`): keyframes at `+8`, count at `+0xc`. Keyframes are `0x10` bytes, reset to `+0` = 1000 and every byte `0xff`:

| Keyword | Values         | Keyframe offset  |
| ------- | -------------- | ---------------- |
| `0x28`  | int            | `+0x00`          |
| `0x29`  | 3 ints → bytes | `+0x04`..`+0x06` |
| `0x2a`  | 3 ints → bytes | `+0x08`..`+0x0a` |
| `0x2b`  | 3 ints → bytes | `+0x0c`..`+0x0e` |

Anything else is error 0. The two trailing tokens are read unconditionally and dropped when they do not match. Port names are neutral (`integer`, `firstBytes`..`thirdBytes`, `float`); the byte triples look like colours in the data but that is not confirmed in code.

Verified: all 14 `.SKB` files parse to their last byte.
