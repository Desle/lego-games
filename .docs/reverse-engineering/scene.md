# Scene linking and material state

Source: `GolDP.dll` (image base `0x10000000`) and `LEGORacers.exe` (`0x00400000`), English release. How the engine turns a world (`world.md`) into renderable objects: which files it opens, how names resolve, how instances are linked, and which Direct3D state each material sets. Ported as the `scene` module of `@lego-games/lego-racers`.

## Finding files

| Address                         | Role                                                                                                                                                                                                                                                                                                  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0x10017ac0`                    | For each name list: copies the 8-byte name, appends `.tdf`/`.mdf`/`.adf`/`.gdf`/`.sdf`/`.bdf`/`.maf` (`0x1005cbd4`…`0x1005cba4`) and calls the object's load slot with (container, name, binary flag)                                                                                                 |
| `0x10030070`                    | Token reader open: a name containing `.` gets everything from its last `.` replaced by the reader's default extension (`.tdb` `0x1005cf10`, `.mdb` `0x1005ceac`, `.gdb` `0x1005ce38`, `.wdb` `0x1005cf18`); a name without one gets it appended                                                       |
| `0x10031580`                    | File open: builds the path (`0x10031c90`) and asks each registered file system (table `0x10065e78`, count `0x10065e7c`: the JAM archive the exe passes in `GolEntry`) first; only on "not found" (8) does it try the disk with the search paths                                                       |
| `0x10031c90` / exe `0x0044d190` | Path builder. With the archive registered, a relative name becomes `<archive current directory>\<name>` (separator `\` at `0x1005f048`); a leading `\` means the archive root. The whole path is uppercased (`toupper`, at most 255 characters, else "Unable to build pathname, too many characters") |
| exe `0x0044c810`                | Finds (or adds) a directory node in the archive's hash table; callers store it at archive `+0x1c`, the current directory `0x10031480` reads                                                                                                                                                           |
| `0x10018ca0`, `0x1002a500`      | Bitmap and Targa loaders' open: append `.bmp` (`0x1005cbe4`) / `.tga` (`0x1005cf00`) unless the name already ends with it                                                                                                                                                                             |

Every file a world names is therefore `<current directory>\<NAME>.<EXT>`. Every name in every non-empty `.WDB` of the English `LEGO.JAM` resolves in the world's own directory.

### Which directory, and which worlds load together

`0x10017ac0` passes the same container (`ESI+0x14` in the race) to every loader, and the texture and material lists are chains in that container, so worlds loaded into one container see each other's textures and materials. `LEGORacers.exe` `0x00432e20` loads a race's worlds in this order:

1. `+0x39c`: the race description's global world (`0x40`, `global.wdf`) with the current directory set by `0x004328f0` to game settings `+0xee`, which `0x0041ed10` and `0x0042c4e0` fill with `GAMEDATA\COMMON`;
2. after `0x0044c810(settings +0xdc)` (the race directory, `GAMEDATA\` + race folder): `+0x390` track (`0x2e`), `+0x3a0` collision (`0x2b`, first string), `+0x398` blended (`0x3b`), `+0x3a4` local (`0x45`).

`BLENDED.WDB` and `LOCAL.WDB` of the races fail on their own (their materials and textures live in the track and global worlds); in race order all 13 races and the `TEST` folder link. The menu code's own load order is not traced, so menu `BLENDED.WDB` files still fail alone.

## Name lookup

| Address      | Role                                                                                                                                      |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `0x10028b30` | A texture database links itself at the head of the container's texture chain (`+0x38`, next at `+0x10`) before reading                    |
| `0x10028b90` | Texture lookup: walks the chain from its head, `0x100283e0` in each (hash over ≤ 8 characters, `strncmp` 8)                               |
| `0x10028bc0` | A material library links itself at the head of the material chain (`+0x3c`)                                                               |
| `0x10028c20` | Material lookup, the same walk over `+0x3c`                                                                                               |
| `0x1002b5a0` | TDB loader: a name the chain already holds is not registered (its stored name is blanked), so the first database to define a texture wins |
| `0x10025f90` | Model material names: each `strncpy(…, 8)` then `0x10028c20`; not found → `<name>: Material assignment failed` (fatal)                    |
| `0x10025e60` | Material assignment (`.gdf` names in the world's `0x2b` list): opens the `.GDB`, reads only `0x27` and the names with `0x10025f90`        |
| `0x10026270` | MDB loader: the material's texture name through `0x10028b90`; not found → `Mat def file references unknown texture: <name>`               |

Because a library links at the head, a material name defined by two libraries resolves to the later one.

## Textures and bitmaps

The texture's flags choose the image loader: flag `0x10` (TDB keyword `0x2b`) the Targa loader `0x10063ca0`, else the bitmap loader `0x10064280` (`0x1001f330` texture upload, `0x1002b890` load at database time). Flag `0x20` (TDB keyword `0x2c`) is a colour key: the three bytes are R, G, B. `0x100200f0` compares them with the 2^bpp palette entries (R at `+0xa8`, G `+0xa9`, B `+0xaa`) and gives the first match alpha 0; `0x100204d0` sets up the same key for true-colour images. Targa decoding is not ported (one texture, `GAMEDATA\COMMON\LITFLASH`, uses it in the races). 55 menu textures (racer parts such as `leg_brwn`) have no bitmap in their world's directory; the game builds them at run time.

`0x100257e0` copies a material definition into the material and, for a colour-keyed texture, overrides it by device: with device flag `0x80` (blending fallback, unless the material has a constant opacity) source blend 6 and destination blend 8 with flags `& ~0x224 | 0x112`; with device flag `0x100` alpha function 2 (GREATER), reference 0, flags `& ~0x80 | 0x40`. `0x10007e20` sets `0x100` when the device's alpha-compare caps (`+0x1c4 & 0x10`) exist and it has no hardware colour key (`+0x1cc & 8`), else `0x80`. The port follows the `0x100` path, which every alpha-compare-capable device takes.

## Material state (`0x1000a2c0`)

Render states through `IDirect3DDevice3::SetRenderState` (vtable `+0x58`) and stage-0 texture states (`+0xa0`):

| Flags                      | State                                                                                                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `0x4`                      | `SHADEMODE` 2 (Gouraud), else 1 (flat)                                                                                                                                                     |
| `0x8` clear                | `COLOROP` and `ALPHAOP` 3 (SELECTARG2: diffuse)                                                                                                                                            |
| `0x8`, `0x20` clear        | `COLOROP` 2 (SELECTARG1: texture), diffuse replaced by the constant `opacity << 24 \| 0xffffff`                                                                                            |
| `0x8`, `0x20`              | `COLOROP` 4 (MODULATE)                                                                                                                                                                     |
| `0x8`                      | `ALPHAOP` 4 (MODULATE) when `flags & 0x1020`, else 2 (texture alpha)                                                                                                                       |
| `0x40`                     | `ALPHATESTENABLE` 1, `ALPHAFUNC` = table `0x10056540`[function] (ALWAYS, EQUAL, GREATER, GREATEREQUAL, LESS, LESSEQUAL, NEVER, NOTEQUAL), `ALPHAREF` = reference `<< 16`                   |
| `0x100` (without `0x1000`) | `SRCBLEND` / `DESTBLEND` from per-device tables `+0xc8708` / `+0xc8734`, `ALPHABLENDENABLE` 1                                                                                              |
| `0x1000`                   | constant opacity: `SRCBLEND` 5 (SRCALPHA), `DESTBLEND` 6 (INVSRCALPHA), `ALPHABLENDENABLE` 1, colour op forced to modulate (`& ~0x10 \| 0x20`), the opacity byte becomes the diffuse alpha |
| `0x800`                    | `MAGFILTER`/`MINFILTER` 1 (point), else 2 (linear) when the device supports it                                                                                                             |
| `0x10000`                  | `ADDRESS` 3 (clamp), else 1 (wrap)                                                                                                                                                         |

The blend tables are filled by `0x10007e20` from the D3DBLEND values at `0x1005658c` (`ZERO, ONE, SRCCOLOR, DESTCOLOR, INVSRCCOLOR, INVDESTCOLOR, SRCALPHA, DESTALPHA, INVSRCALPHA, INVDESTALPHA, SRCALPHASAT`), falling back to SRCALPHA / INVSRCALPHA where the caps bit at `0x10056560` is missing. Device flag `0x4000` (forces `& ~0x2100 | 0x1200`) is not modelled. No retail material sets alpha testing itself; the materials in use blend with (6, 1), (6, 8) or a constant opacity.

`0x10012f50` picks the transform routine that writes the diffuse colour: the vertex colour of a `0x2a` vertex buffer as is, or the constant above. Models with normals are lit by the engine (`+0xc8568`, light colours scaled per material in `0x1000a2c0`); that lighting is not ported.

## Drawing a model (`0x10006c50`)

| Command              | Callback                                                                                                                                                                                                                    |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| select material `m`  | material `m` of the instance level's material assignment if it has one (`0x1002e640` stores it per level), else of the model; applies it (`0x1000a2c0`)                                                                     |
| transform vertices   | `0x1000c630`: vertices `first … first + count - 1` through the selected matrix into cache slots `slot …` (32 bytes each at device `+0x348`)                                                                                 |
| draw faces           | `0x1000ebd0`: each face's three bytes are cache slots; it keeps a face only when `(C.x − B.x)(A.y − B.y) − (A.x − B.x)(C.y − B.y) < ε` in screen space (y down), i.e. counter-clockwise on screen, with `CULLMODE` 1 (none) |
| select transform `t` | `0x1000acf0`: entry `t` (0xd0 bytes) of the attached object's transform array                                                                                                                                               |

## Linking instances (`0x1002e640`)

- Mesh and BSP tree instances: level 0's mesh index must be below the mesh count (unsigned), else `Illegal mesh reference`; BSP trees also `Illegal bsp tree reference`. Levels stop at the first negative mesh index (at most three). A distance below FLT_MAX (`0x10057330`) is squared, else stays FLT_MAX.
- Each level's material assignment slot: negative → none; at or above the count → `Illegal alt mat assign ref val`. The pointer is stored per level slot (`+0x6c`).
- Level 0 goes through the instance's `+0x50`; later levels through `0x10027c50`, which inserts before the first stored level with a larger distance and shifts the models and distances (`+0x78`, `+0x84`) but not the material assignments.
- Position through slot `+0x08`; orientation through `+0x40` = `0x10026b50`: forward normalised (`0x1002f530`, a zero vector stays zero), `d = f.x·u.x + f.z·u.z + u.y·f.y`, `u' = normalise(u − d·f)`, rows forward, `u' × f`, `u'`. `0x1000c630` transforms row vectors (`x·m0 + y·m4 + z·m8 + m12`), so the rows are the images of the model's axes.

Skeleton instances, sprites, BSP volumes, animations and material animations are not ported.
