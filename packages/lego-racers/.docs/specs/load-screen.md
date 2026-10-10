# Feature: load-screen

## Behaviour

Parses a race's `.LSB` loading screen exactly as `LoadScreen_Load` (`LEGORacers.exe` `0x0042f480`) does: the image name, the string index of its caption and the progress points as fractions of the screen, and turns the points into pixels as the loader does.

## User flows

- **Parse a load screen**: the race passes the bytes of `LOADSCRN.LSB` to `parseLoadScreen` and gets `imageName`, `points`, `stringIndex` and `readByteCount`.
- **Place the points**: `getLoadScreenPixelPoints(points, width, height)` multiplies each point by the surface size and truncates, as `0x0042f62b`..`0x0042f65e` do.

## Invariants

- The file is `0x27 { keywords }`; `0x28` reads a name of at most 8 characters, `0x29` reads `[ count ] {` count pairs of floats `}`, `0x2a` an integer; other keywords are skipped. Nothing after the closing curly is read.
- Pixel coordinates are `_ftol` truncations of the float32 point times the float32 surface size, so 0.9 of 480 is 431.

## Out of scope

Loading the image and drawing the screen.
