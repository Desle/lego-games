# lego-games

Exact TypeScript ports of classic LEGO PC games. The ports are reverse-engineered from the original binaries and run on the player's own game files. LEGO Racers (1999) comes first.

## Setup

```sh
pnpm install   # also points git at .git-hooks/
pnpm run ci
```

Needs Node 24 (`.nvmrc`) and pnpm (`corepack enable`).

Put your own copy of the game in `original-files/` (gitignored), for example `original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM`. Tests that need it skip when it's missing.

## Play

You need your own copy of LEGO Racers (1999); nothing of it ships here.

```sh
pnpm install
pnpm --filter @lego-games/lego-racers-web build
pnpm --filter @lego-games/lego-racers-web exec vite preview
```

Open the printed address in Chrome or Edge, click **Choose your LEGO Racers game folder** and pick the folder holding `LEGO.JAM`, `LEGORacers.exe` and the `.tun` music (the `Game Files` folder of the install). The files are read in the browser and never uploaded; the game opens on the main menu. Other browsers get a folder input instead of the directory picker. Menus: arrow keys, Enter, Escape; the race controls are listed on the start screen. Saves are kept in the browser (IndexedDB). `pnpm run dev` opens the same game and, when the dev server serves the original files, goes straight to the main menu; the backquote key (`~`) opens the developer tools (track viewer, power-up keys), which a production build leaves out.

## Exporting assets

For a remaster (upscaling, remodelling) every original asset can be exported from your own game files into a folder outside the repository. Exported data is copyrighted: keep it out of git.

```sh
pnpm run export-assets -- --game "<path to the Game Files folder>" --out ~/lego-racers-export
```

| Folder                                | Contents                                                                                                                                                                                                                          |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `textures/`                           | Every BMP and TGA of `LEGO.JAM` as PNG at its archive path (TGA alpha kept); the loose game-folder BMPs under `textures/GAMEFOLDER/`; `textures/COLORKEYED/` holds the transparent copies models use for colour-keyed materials.  |
| `audio/`                              | Every PCM sound effect as WAV at its archive path; every `.tun` music track under `audio/MUSIC/`.                                                                                                                                 |
| `video/<name>/`                       | Per AVI: `frames/00001.png…`, `<name>.wav` and a lossless FFV1 `<name>.mkv`. Needs `ffmpeg` on the PATH; without it the videos are skipped with a message.                                                                        |
| `models/<archive path>.gltf` + `.bin` | Every GDB model as glTF 2.0 with UVs, vertex colours and normals where present, materials referencing the PNGs by relative path. A model with an SDB skeleton of the same name is skinned to it and carries the clips of its ADB. |
| `models/<archive path>.world.gltf`    | Every world (WDB) as one scene with its instances placed (skeleton instances are posed at their starting clip's first frame). Empty worlds (collision, emitters) are reported, not written.                                       |
| `manifest.json`                       | Every exported file with its type and source archive path, counts per type, and the assets that could not be exported.                                                                                                            |

`--only textures,audio,video,models,worlds` runs only some exporters (models and worlds reference the textures by relative path). Models stay in the engine's Z-up frame under one root node that turns them to glTF's Y-up, scaled by the model's own scale.

## Reverse engineering

Ghidra 12 (`brew install ghidra`) analyses `LEGORacers.exe` and `GolDP.dll` into `reverse-engineering/ghidra/`. The scripts in `reverse-engineering/scripts/` decompile functions headlessly, for example:

```sh
"$(brew --prefix ghidra)/libexec/support/analyzeHeadless" "$PWD/reverse-engineering/ghidra" LegoRacers \
  -process LEGORacers.exe -noanalysis -readOnly -scriptPath "$PWD/reverse-engineering/scripts" \
  -postScript DecompileAddressRange.java 0044d700 0044e400
```

For quick lookups, start the query servers once and ask them directly:

```sh
reverse-engineering/ghidra-server.sh start
reverse-engineering/ghidra-query.sh exe decompile 0044d900
reverse-engineering/ghidra-query.sh dll disassemble 10032840 100328b1
```

Findings are written up in `.docs/reverse-engineering/`.

## Daily use

| Command                             | What it does                                   |
| ----------------------------------- | ---------------------------------------------- |
| `pnpm run check`                    | Typecheck, lint, architecture checks, tests    |
| `pnpm run ci`                       | The full gate CI runs; also runs on `git push` |
| `pnpm --filter <package> run check` | One package only                               |
| `pnpm run format`                   | ESLint auto-fix, then Prettier                 |
