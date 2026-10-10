# Feature: sky

## Behaviour

Parses a race's `.SKB` sky file exactly as `Sky_Load` (`LEGORacers.exe` `0x0041c550`) does: named settings, each a list of keyframes with an integer and three byte triples, then the optional name of the setting to start with and an optional float. It then runs the sky as the race does: builds the dome (`0x004907f0`), advances the keyframes and blends the ring colours (`Sky_Update` `0x0041ccb0`), and places the dome and the background world for a camera (`0x0041d040`). It uses no DOM or rendering library.

## User flows

- **Parse a sky**: the race passes the bytes of `BACKGRND.SKB` to `parseSky` and gets `settings`, `selectedSettingName`, `float` and `readByteCount`.
- **Build the dome**: `createSkyDome` builds the hemisphere `Sky_Load` makes with the sphere builder: three rings of eleven vertices at radius 100 and the 44 triangles between them.
- **Run the sky**: `createSkyState` starts every setting at its first keyframe with the named setting (index 0 when absent or unknown) current; `advanceSky` moves time as `Sky_Update` does; `switchSkySetting` starts a transition to another setting (`0x0041d150`); `getSkyRingColors` gives the three ring colours, blended from the previous setting during a transition; `getSkyVertexColors` expands them to the dome's vertices.
- **Place it**: `getSkyPlacement` gives where the dome and the background world's instances sit for a camera position.

## Invariants

- The file is `0x2c [ count ] {` and count settings `0x27 [ keyframes ] "name" { (0x27 { keywords }) * keyframes }`, then `}`.
- Keyframes start from the reset values of the loader (integer 1000, every byte 0xff); `0x28` reads the integer and `0x29`, `0x2a`, `0x2b` three integers each, kept as bytes. Any other keyword is a syntax error.
- After the settings the loader reads one token and, when it is `0x2d`, a name; then one more token and, when it is `0x2e`, a float. Tokens that do not match are dropped, as in the original.
- Every setting's time advances on every update; a keyframe is left once its elapsed time is greater than its duration, and the next starts from zero.
- Ring 0 (the pole end) takes keyframe bytes `+0x0c`, ring 1 `+0x08`, ring 2 (the horizon) `+0x04`; with several keyframes the bytes blend towards the next keyframe's by elapsed time over duration, truncated to bytes.
- The dome follows the camera in x and y, sits 10 below it (less the SKB float) and the background world's instances 30 above it, and never rotates.

## Out of scope

The sky's draw order and depth state belong to the renderer (depth test off while the dome and then the background world are drawn, before the track); starting a transition is up to game code; a sky without settings or a setting without keyframes fails with `SkyStateError` where the original would crash.
