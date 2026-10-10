# Feature: jam-archive

## Behaviour

Opens LEGO Racers' `LEGO.JAM` archive and finds and reads the files inside it by path. It behaves exactly like the original `LEGORacers.exe` JAM class: same signature check, same entry limits, same lazy directory loading and the same path matching.

## User flows

- **Open an archive**: the game passes the bytes of `LEGO.JAM` and gets an archive back. Bytes that don't start with `LJAM` fail with "Error reading JAM file."
- **Find a file**: the game passes a backslash-separated path such as `GAMEDATA\COMMON\GO.PCM` and gets the file's offset and size back.
- **Read a file**: the game passes a path and gets a copy of that file's bytes.
- **List files**: tooling gets every file path in the archive.

## Invariants

- Names are matched case-sensitively on at most 12 characters, like `strncmp(name, segment, 12)` in the original.
- A path segment longer than 12 characters fails with `name_too_long` (original code 6), and a missing directory or file fails with `not_found` (original code 8).
- A directory listing more than 100000 files or subdirectories is a read error, as in the original.
- A directory is parsed when it is first searched, never before, so errors surface in the same order as in the original.

## Out of scope

Decoding the files inside the archive (models, textures, sounds) and the original's line-by-line text reader (`0x0044da70`). Those belong to their own modules.
