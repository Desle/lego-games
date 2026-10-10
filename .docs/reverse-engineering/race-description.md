# Race description (`.RAB`) and the exe's token reader

Source: `LEGORacers.exe` (English, 1999-07-22). Port: `packages/lego-racers/src/modules/race-description`.

## The exe's binary token reader is the DLL's

Every exe loader below reads through `LEGORacers.exe`'s own copy of the binary token reader (object `0x650` bytes, constructor `0x0044a7e0`, vtable `0x004b0e0c`). `BinaryToken_NextToken` (`0x0044aae0`), the macro definition (`0x0044b020`), the expansion (`0x0044b130`, array-header table `0x004b0df8` = `7 4 8 8`) and the byte reader (`0x0044b0b0`, a short read is error 0) decompile to the same algorithm as `GolDP.dll` `0x10030300`/`0x10030c30`/`0x10030da0`; the scale constants live at `0x004c7070` (1/4096), `0x004c7078` (1/32), `0x004c707c` (1/127). The helpers match too: `0x0044e800` int (error 4), `0x0044e820` float (3), `0x0044e840` string (2), `0x0044e860` string of at most N (14), `0x0044e8a0` expect keyword (19), `0x0044e8c0`/`0x0044e8e0`/`0x0044e900`/`0x0044e920` `[ ] { }` (7, 8, 5, 6), `0x0044e940` array header. Errors go through `0x0044e6c0` to `ShowFatalError` (`0x0042f8b0`). The port therefore reuses the `token-reader` module for every exe format.

When `settings +0x18` (the JAM) is null the loaders open the text twin with the text reader (`0x0044e580`, `0x1fc` bytes) instead; the port reads only the binary files.

## Mirrored tracks

`Race_LoadTrackContent` (`0x00433480`) takes one stack argument, the race's mirror flag, and passes it as the last argument to the checkpoint (`0x0041e770`), route (`0x00433190` → `0x004a4e30`), start-position (`0x0043bc10`), tagged-position (`0x0045c3d0`), power-up (`0x00458810`), trigger (`0x00463dc0`, `0x00464ff0`), event (structure `+0x30`) and hazard (structure `+0x40`) loaders, and to the track materials through `0x00435d20`. Each loader negates the y component of what it reads. Note: Ghidra loses this argument because the loaders reuse the JAM argument's stack slot for the reader pointer; the disassembly (`RET 0xc`, and the stack argument at `[ESP+0x180]` pushed before each call) shows it.

## Layout (`Race_LoadRaceDescription`, `0x00431e00`)

```
0x35 "display name" (≤ 63)  {
  keyword values ...          // until `}`; nothing after it is read
}
```

| Keyword        | Values                 | Race offset                                             | Port field                                                                                 |
| -------------- | ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `0x27`         | name ≤ 12              | `+0x69`                                                 | `backgroundWorld`                                                                          |
| `0x28`         | 6 floats               | `+0x204`..`+0x218`                                      | `cameraVectors` (passed to `0x004282a0`)                                                   |
| `0x29`         | 3 floats               | `+0x1f8`..`+0x200`                                      | `cameraPoint` (passed to `0x00428390`)                                                     |
| `0x2b`         | 3 names                | `+0x9d`, `+0xaa`, `+0xb7`                               | `collisionWorld`, `firstCollisionObject`, `secondCollisionObject`                          |
| `0x2c`         | name                   | `+0x105`                                                | `events`                                                                                   |
| `0x2d`         | name                   | `+0x17a`                                                | `fontDatabase`                                                                             |
| `0x2e`         | name                   | `+0x5c`                                                 | `trackWorld`                                                                               |
| `0x2f`         | name                   | `+0x187`                                                | `imageDatabase`                                                                            |
| `0x30`         | name                   | `+0x16d`                                                | `musicList`                                                                                |
| `0x31`, `0x32` | name                   | —                                                       | read and dropped                                                                           |
| `0x33`         | 3 names                | `+0xc4`, `+0xde`, `+0xd1`                               | `powerUpPlacements` (`.pwf`), `powerUpMaterialAnimation` (`.maf`), `powerUpWorld` (`.wdf`) |
| `0x34`         | name                   | `+0xeb`                                                 | `shadowWorld`                                                                              |
| `0x37`         | name                   | `+0x112`                                                | `environmentTriggers`                                                                      |
| `0x38`         | name                   | `+0x11f`                                                | `timers`                                                                                   |
| `0x39`         | name                   | `+0xf8`                                                 | `mainTriggers`                                                                             |
| `0x3a`         | 2 names                | `+0x12c`, `+0x139`                                      | `emitterDefinitions`, `trackEmitters`                                                      |
| `0x3b`         | name                   | `+0x76`                                                 | `blendedWorld`                                                                             |
| `0x3c`         | name                   | `+0x146`                                                | `soundBank`                                                                                |
| `0x3d`         | name                   | `+0x153`                                                | `voiceFolder`                                                                              |
| `0x3f`         | name                   | `+0x160`                                                | `trackSoundBank`                                                                           |
| `0x40`         | name                   | `+0x83`                                                 | `globalWorld`                                                                              |
| `0x41`         | name                   | `+0x194`                                                | `startPositions`                                                                           |
| `0x42`         | name                   | `+0x1a1`                                                | `sky`                                                                                      |
| `0x43`         | name                   | `+0x1ae`                                                | `trackMaterials`                                                                           |
| `0x44`         | name                   | `+0x1bb`                                                | `hazards`                                                                                  |
| `0x45`         | name                   | `+0x90`                                                 | `localWorld`                                                                               |
| `0x46`         | 4 floats               | `+0x2abc`, `+0x2ac4`, `+0x2ac0`, `+0x2ac8` (file order) | `displayBounds` (passed to `0x00426280`)                                                   |
| `0x48`         | 2 names                | `+0x1c8`, `+0x1d5`                                      | `checkpoints`, `checkpointObject`                                                          |
| `0x49`         | name ≤ 8 (`strncpy` 8) | `+0x1ef`                                                | `trackWorldObject`                                                                         |
| `0x4a`         | name                   | `+0x1e2`                                                | `taggedPositions`                                                                          |

Names are at most 12 characters (`0x0044e860(reader, 0xc)`), longer is "Invalid string". Any other keyword (`0x36`, `0x3e`, `0x47`, …) is error 0 ("Syntax error"). After `}` the loader negates `+0x1fc`, `+0x208` and `+0x214` (the y of the camera point and of both camera vectors) when its argument 3, the mirror flag, is set (`0x0043236d`..`0x00432391`).

Verified: all 14 `.RAB` files in `LEGO.JAM` parse to their last byte.
