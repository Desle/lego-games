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

## Running the sky (`LEGORacers.exe`)

Port: `createSkyDome`, `createSkyState`, `advanceSky`, `switchSkySetting`, `getSkyRingColors`, `getSkyVertexColors`, `getSkyPlacement`.

`Sky_Load` goes on after the file (`0x0041ca4c..0x0041cbbf`): it creates a model (`GolRoot` slot `+0x14`) at sky `+0xa0`, calls the sphere builder `0x004907d0` → `0x004907f0` with the parameter block `{ device, model, centre (0, 0, 0), radius 100.0, 11 segments, hemisphere 1, top cap 0, bottom cap 0, vertex format 1 (colour), no extra }`, puts the model into the instance at sky `+0xc` (`+0x50`), sets that instance's flag `+0x68 |= 2` and the identity orientation, assigns the material named `skymat` (from `GAMEDATA\COMMON\RACERFX.MDB`: Gouraud, diffuse only, no blending, no alpha test) with `0x00410750`, and loads the race's background world (`race +0x69`, `.wdb`) into a world at sky `+0x9c` with `World_Load` (slot `+0x14`, arguments the device, the name, the binary flag, 1.0). Race `+0x14` is the Gol renderer (`0x100565b8`), not the Gol device.

### Dome (`0x004907f0`)

`step = 2π / segments` (`0x004b02f8`), rings = `1 − trunc((−π/2) / step)` (`0x004b4764`) = 3. Ring `i` is at latitude `step · (i + 1)` from the pole, the last at the literal π/2 (`0x3fc90fdb`): height `cos(latitude) · 100`, horizontal radius `sin(latitude) · 100`; vertex `j` of a ring at longitude `step · j`: `(cos · r, sin · r, height)`; ring `i` holds vertices `11 i .. 11 i + 10`. There is no top or bottom vertex. For ring `r ≥ 1` and segment `j` (vertex `v = 11 (r − 1) + j`, `next` = `v + 1`, wrapping to the ring start) the faces are `(v, next + 11, v + 11)` and `(v, next, next + 11)`: 44 triangles.

### Keyframes (`Sky_Update` `0x0041ccb0`)

Settings are `0x10` bytes: elapsed time `+0`, keyframe index `+4`, keyframes `+8`, count `+0xc`. Every update each setting's time grows by `dt` (uint32); when it is greater than the keyframe's duration (`+0`) the index advances (wrapping to 0) and the time restarts at 0. A transition (`+0xbc` duration, `+0xc0` elapsed, current `+0xb8`, previous `+0xb4`) grows by `dt` and ends (both reset to 0) once the elapsed time is greater than the duration. Colours (`0x0041ce60`): one keyframe → its three byte triples; otherwise the current keyframe's triples blended with the next one's (`(index + 1) % count`) by `elapsed / duration` through `0x0041cf20`: each byte `ftol(a · (1 − t) + b · t)` with `t` a float32. During a transition the previous setting's colours (computed the same way) are blended into the current ones by `transition elapsed / duration`, previous first. `0x0041cfc0` writes the result to the dome's vertices through the vertex colour setter (`0x10006250`, bytes R, G, B, A into a D3DCOLOR): vertices 0..10 the keyframe's `+0x0c` triple, 11..21 `+0x08`, 22..32 `+0x04`. The alpha byte of a blended colour is left unset by the code; `skymat` ignores it. `0x0041d150` switches setting: previous = current, current = the named one's index, and unless it is the same setting the transition restarts with the given duration.

### Placement and drawing (`0x0041d040`, `0x0041d0f0`, `Race_Render` `0x004354d0`, `0x004357b0`)

`Race_Render` reads the camera frame's position (`0x10002fe0`) and calls `0x0041d040`: z becomes `z − (10.0 − h)` (`0x004afde0`, `h` = the SKB float, 0 when absent, sky `+0xac`), the dome instance is set to that position (instance slot `+8`), then z becomes `(40.0 − h) + z` (`0x004afddc`) and every mesh instance (stride `0x90`) and skeleton instance (stride `0xf4`) of the background world is set to it: they follow the camera in x and y and sit 30 above its height. Nothing rotates. `0x004357b0` draws the sky (`0x0041d0f0`) before the track: unless the sky flags (`+0xc4`) bit 0 is set it calls renderer `+0xe8` (`0x100098d0`: `ZENABLE` 0, `ZWRITEENABLE` 0), draws the dome instance (renderer `+0x94`, `0x10008910`), and unless flag bit 1 is set draws the background world (`0x00416040`: sprites, skeleton instances, mesh instances, BSP volumes), then calls renderer `+0xe4` (`0x10009860`: `ZENABLE` 1, `ZWRITEENABLE` 1, `ZFUNC` LESSEQUAL). `BACKGRD.WDB` is empty in 10 of the 14 races; the others hold a `skyring` model with no instance (RACEC0R1, C1R1, C2R1) or one instance of `planet` (RACEC3R0, with keywords `0x3f` and `0x42` not yet understood).

Not ported: the clear colour below the horizon (the original dome has no lower half), the camera's clip planes.
