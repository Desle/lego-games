# World sprites (`0x37`): the camera-facing rectangles of the track worlds

Source: `GolDP.dll` and `LEGORacers.exe` (English, 1999-07-22), read from the x87 disassembly and compared bit for bit with the original's Direct3D draws ([render-trace.md](render-trace.md), [pixel-trace.md](pixel-trace.md)). Port: `scene` (`link-sprites.ts`, `Scene.sprites`), `world-sprite` (`getWorldSpriteQuads`) and the viewer's `race-particles`. Anything not proven is marked **hypothesis**.

Nine tracks list sprites in their world (the `.WDB` record is in [world.md](world.md)): the trees of Royal Knights (`rktree`, 8), the torches of the sphinx and the pirate track (`adtorch`, 54 and 15), the planets, plane and radar dish of the moon track (`mmplanet`, `mmplane2`, `mmradish`, plus one by material assignment), the moon (`dfmoon`), the spiders (`aaaspidr`), the lamps (`ip_lmp`, `ip_llt02`), the skulls (`skulldh`, `skullhd2`) and the cable (`ktcsbl`), the bushes and the trading-card plates (`bshtre`, `mate2205`) and the asteroids, nebula and robots (`araastrd`, `aranbula`, `ararobot`). None is in a `BACKGRD.WDB`; all sit in the track world. The front end's race preview (`MENUDATA\CIRCUIT6\TEST.WDB`) lists four more, which the port does not draw (open).

## The object

`World_CreateResources` (`0x10017390`) allocates one object of `0x4c` bytes per sprite (the world's `+0x100`, count `+0x6c`), built by `0x10029df0` (an instance base with vtable `0x10056760`). The loop at `0x10017ecf` of `World_LoadNamedFiles` (`0x10017ac0`) fills it from the `0x38`-byte record of `World_Load` (`0x1002d950`):

| Object  | Meaning                                                                                                                                                                            |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `+0x28` | Material (found by name in the chain, `0x10028c20`: "... sprite material not found")                                                                                               |
| `+0x2c` | With flag 4: the world's material assignment list (`0x2b`, index checked: "Illegal mat assign reference"); `+0x4a` the entry; the draw takes `assignment[8][entry]` (`0x1002a020`) |
| `+0x30` | With flag 2: the axis (`0x38`)                                                                                                                                                     |
| `+0x3c` | Width (`0x3a`); `+0x40` height (`0x3b`)                                                                                                                                            |
| `+0x44` | Squared distance limit: the float store of `0x3c` squared, so FLT_MAX becomes infinity (`0x10017ef3`)                                                                              |
| `+0x48` | Flags: 1 sprite (`0x10029e30`), 2 axis, 4 material assignment                                                                                                                      |

`0x10029e30` also gives the object its bounding radius (`0x10026fa0` of `sqrt((0.5 w)^2 + (0.5 h)^2)`), the position goes through slot `+8`. `World_LinkSpriteMaterialAnimation` (`0x1002e250`, keyword `0x3e`) is the material animation, not ported here (see [material-animation.md](material-animation.md)).

## When it is drawn

`World_Draw` (`LEGORacers.exe 0x00416040`) draws a world's BSP trees (slot `+0x1c`), skeleton instances (`+0x24`), mesh instances (`+0x20`), then **its sprites** (`+0x28` = `World_DrawSprites` `0x10018270`: each object in the world's order through the renderer's slot `+0xb4`, `Renderer_DrawSprite` `0x10009a70`). The race draws the sky world first (`Sky_Draw` `0x0041d0f0`, no sprites there), then the track world (`Race_DrawEntities` `0x00435a00`) and then the cars and effects. There is no sorting.

## `Renderer_DrawSprite` (`0x10009a70`)

1. **Distance** (`0x10029fa0`): the camera position (renderer `+0x4c`) minus the sprite position, `dz^2 + dy^2 + dx^2` (unrounded x87), is drawn when it is neither 0 nor above `+0x44`.
2. **Matrix** (`Sprite_BuildBillboardMatrix` `0x10014e50`), from the camera's forward vector `f` and its stored "negated up" `-d` (the camera frame's slot `+0x1c`; `d` is the frame's second row, the direction the picture's bottom points to, `world.md` and [camera.md](camera.md)). Without an axis: facing `n = normalize(-f)`, up `u = -d`, right `r = u x n`. With an axis `a` (the usual case): `n` loses its component along `a` (`n - (n . a) a`) and is normalized again, `u = a` (not normalized), `r = a x n`. The rows are `n`, `r`, `u` and the origin `position - w/2 r - h/2 u`.
3. **Draw** (`Sprite_DrawQuad` `0x10014ff0`): the material is applied as for any model (`0x1000a2c0`, its texture selected), the four vertices are `origin + y r + z u` for `y` in `{0, w}` and `z` in `{0, h}`: `(0,0,h)`, `(0,0,0)`, `(0,w,h)`, `(0,w,0)` with the texture coordinates `(0,0)`, `(0,1)`, `(1,0)`, `(1,1)` (`0x10014e20` sets the ones), the colours are the DLL's static array of white (`0x1005ca4c`: **a sprite never takes its material's colour**) and the two triangles are `(1,2,0)` and `(3,2,1)` (`0x1005ca5c`, four bytes each): the diagonal runs from the bottom left to the top right of the picture. The cannon ball's sprite and the effects' sprites go through the same function ([power-up-visuals.md](power-up-visuals.md)), which is why the port draws them with the same `getSpriteQuad`.

With the camera of the race (`forward`, `up` = the down row) the corners of `getSpriteQuad` are exactly these (bottom left `(0,1)` first); `getWorldSpriteQuads` adds the distance test and the axis facing.

## Textures of sprites keep the file's row order (finding)

Sprite pictures are not upside down in the original although their top left vertex has `v = 0`, and the viewer's texture (the rows reversed, render-trace.md finding 8) showed every tree on its head (pixel trace: 69 percent of the original's `rndtree` pixels differed). The 76 textures of all `.WDB` files that have texture flag 4 **clear** (TDB keyword `0x28`; `0x828` against `0x90c` or `0x92c`) are the sprites', particles', decals' and ribbons' (`rndtree`, `tflame2`, `rope`, `lightng`, `cannon16`, `smoke1`, ...), and no model uses one of them: the surface of a texture with flag 4 holds the picture's last row first, one without it holds the rows as the viewer's bitmap has them. The viewer already keeps the order for the ribbons (`rope`, `lightning`); world sprites now do. **Hypothesis:** the rule holds for every texture, so the emitters' particles and the cannon ball (which use `cannon16` reversed today) are mirrored vertically; not verified here (the cannon's disc and most particles are symmetric).

## Measured

`pnpm run render-coverage` (races `rkr`, `rkr2`, `mmm`, `mmm2`, `dad`, `frk`, `aar2`, `dfd`; the demonstration lap, 17 to 44 frames each, all trusted). Before: the `rndtree` pictures of `rkr` had 113 of 175 original triangles without a partner (`rndtree` is the matcher's name for `rktree`), the sprites of every other race had none. After: **every sprite triangle of the original at a place the port draws has its partner** at the same corners (0.25 px), texture coordinates and colour, in forward and mirrored races, with and without an axis. What is left:

| What                                                                                                | Where                                | Cause                                                                                                                                                                                              |
| --------------------------------------------------------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `isAlphaTestEnabled false -> true` on every sprite                                                  | all                                  | The viewer's alpha test stands in for the colour key (render-trace.md finding 9), not a gap.                                                                                                       |
| `adtorch` 6 of 46 (`dad` frame 250), 13 of 121 (`frk`), `araastrd` and `ararobot` flat-shaded draws | torches, asteroids, robots           | The flame flipbook (MAB rows, `World_LinkSpriteMaterialAnimation`), and the draws with a stale texture (`select_diffuse`); **hypothesis**, [render-coverage.md](render-coverage.md) items 1 and 6. |
| One tiny `extra_in_port` triangle in a few frames                                                   | a sprite behind or beside the camera | The comparison projects it with the matrix of the best candidate; a sprite that is off the screen has none.                                                                                        |

The pixel trace case `Royal Knights, world sprites` (frames 250 and 340 of the demonstration; `rndtree` 2.0 percent of its pixels differ, the frame 1.8 percent) and `world-sprite.trace.spec.ts` (forward, mirrored, camera-facing) hold this.

## Open

- Material animation of sprites (keyword `0x3e`: the torches' flames, `RACEC2R0`'s skulls): with the MAB task.
- The race preview's sprites in the front end (`MENUDATA\CIRCUIT6`) and `track-viewer`'s scene viewport do not draw sprites (they have no race camera).
- Draw order against blended sprites: the engine draws in the world's order, three.js sorts blended meshes by distance (no blended sprite exists in the nine tracks: all `blend false`).
- The camera's `+0x1c` slot was not decompiled; its meaning (`f`, `-d`) follows from the cannon sprite's verified corners and the matched world sprites.
