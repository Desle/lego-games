# Loading screen (`.LSB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/load-screen`.

`LoadScreen_Load` (`0x0042f480`, race `+0x280c`, called from `0x00431e00`) opens `loadscrn` (`0x004bed40`) with `.lsb`:

```
0x27 {
  0x28 "name"                    // ≤ 8, copied (9 bytes), passed to 0x004016d0 (image)
  0x29 [ n ] { (x y) * n }        // floats
  0x2a int                        // caption: StringTable_GetString(table, value) at 0x0042f6e4
  other tokens are skipped
}
```

Points: `0x0042f62b`..`0x0042f65e` multiply x by the surface width and y by its height (both `uint16` at surface `+0x2a`/`+0x2c`, converted to float at `0x0042f4f5`) and truncate with `_ftol` (`0x004a84b0`). `getLoadScreenPixelPoints` reproduces this; float32 0.9 × 480 gives 431.

Verified: all 14 `.LSB` files parse to their last byte.
