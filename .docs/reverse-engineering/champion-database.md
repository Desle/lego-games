# Champion database (`CHAMPS.CCB`)

Source: `LEGORacers.exe`. Port: `packages/lego-racers/src/modules/champion-database`. A champion is the car a driver of [driver-database.md](driver-database.md) races with; its chassis is in [chassis-database.md](chassis-database.md). How a race uses all three is in [racer-setup.md](racer-setup.md).

`Champions_Load` (`0x0041d370`, called by `RacerSet_Setup` and the menus) reads `champs.ccb`:

```
0x27 [ count ] {
  (0x27 name { keyword value ... }) * count     // name: string of at most 8 characters, the key
}
```

The record is 0x30 bytes, zeroed first; every keyword is optional and any other is error 0. Names are registered in a name table that stops the game on a duplicate (`0x00411870`).

| Keyword | Value        | Record               | Port field            | Meaning                                                                                                                              |
| ------- | ------------ | -------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `0x28`  | name ≤ 8     | `+0x00`              | `materialLibraryName` | Loaded with Gol root slot `+0x10` by `Champion_CreateInstance` (`0x0041d7a0`)                                                        |
| `0x29`  | name ≤ 8     | `+0x08`              | `textureDatabaseName` | Gol root slot `+0x0c`                                                                                                                |
| `0x2a`  | name ≤ 8     | `+0x10`              | `modelName`           | Gol root slot `+0x14`: the champion's car body model                                                                                 |
| `0x2b`  | name ≤ 8     | `+0x18`              | `chassisName`         | The key of the chassis (`0x0043b480` looks it up with `0x004119a0`)                                                                  |
| `0x2c`  | float        | `+0x20`              | `mass`                | `0x0043b480` stores it as the description's `+0x58`: the mass of the car rigid body (`0x00444d90`, `0x00441210`)                      |
| `0x2d`  | three floats | `+0x24`,`+0x28`,`+0x2c` | `centreOfMass`     | Description `+0x4c`: the local centre of mass (`CarRigidBody_SetCentreOfMass`, `0x00441190`). Not mirrored                              |

## The files in `LEGO.JAM`

Two copies, byte for byte identical (1,210 bytes, 20 champions): `GAMEDATA\COMMON\CHAMPS.CCB` (read by a race) and `MENUDATA\PIECEDB\CHAMPS.CCB`. The champions are `vv rr bk rk rh cc a ph gb bh sb tc nh ap kk cr bvb jt bb gm`. Every one has **mass 4,500 and centre of mass (−1, 0, −1)**; the resource names are the champion's letters plus `cm` (`kk` → `kkcm`), its chassis the letters plus `chas0` (`kkchas0`; exceptions `bvbcha0` and `gm_chas0`). All parse to their last byte.

Port: `parseChampionDatabase(bytes) → { champions, readByteCount }`.
