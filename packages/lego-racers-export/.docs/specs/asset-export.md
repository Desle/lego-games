# Feature: asset-export

## Behaviour

Exports every asset of the player's own LEGO Racers game folder as open formats a remaster can upscale and remodel: textures as PNG, sounds and music as WAV, videos as PNG frames, WAV and lossless mkv, models and worlds as glTF 2.0, plus a `manifest.json` of every file written. The output goes to a folder the player names, outside the repository.

## User flows

- **Export everything**: `pnpm run export-assets -- --game "<Game Files dir>" --out <dir>` reads `LEGO.JAM` and the game folder and writes `textures/`, `audio/`, `video/`, `models/` and `manifest.json`, then prints how many files of each kind it exported and what it could not.
- **Export some kinds**: `--only textures,audio,video,models,worlds` runs only those exporters (models and worlds reference the textures by relative path, so export the textures too).
- **Textures**: every BMP and TGA of the archive becomes a PNG at its archive path under `textures/` (TGA alpha kept); the loose BMPs of the game folder (standard Windows BMP) go under `textures/GAMEFOLDER/`.
- **Audio**: every PCM sound effect becomes a WAV at its archive path under `audio/`; every `.tun` track becomes a WAV under `audio/MUSIC/`.
- **Video**: every AVI of the game folder gets `video/<name>/frames/00001.png…`, `<name>.wav` and `<name>.mkv` (FFV1) through ffmpeg; without ffmpeg on the PATH the videos are skipped with a message.
- **Models**: every GDB becomes `models/<archive path>.gltf` and `.bin`; a model with an SDB skeleton of the same name is skinned to it and carries the clips of its ADB. Every WDB becomes `models/<archive path>.world.gltf` with its instances placed.

## Invariants

- The game's files are only read; nothing exported is ever written inside the repository.
- Pixels, samples and vertices are exactly what the port's decoders produce; the exporter converts and never re-derives game logic.
- Models keep the engine's Z-up frame under one root node that rotates it to glTF's Y-up; texture V is flipped because the engine's v = 0 is the picture's bottom edge.
- Palette pictures are exported opaque; a model whose material colour-keys a picture references a transparent copy under `textures/COLORKEYED/`.
- An asset that cannot be exported is reported with the reason and the others continue.

## Out of scope

Skeleton animation of world instances (they are posed at their starting clip's first frame), collision and BSP data, particle emitters, fonts, front-end layout files, and converting the mkv to anything else.
