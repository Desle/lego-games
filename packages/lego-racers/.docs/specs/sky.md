# Feature: sky

## Behaviour

Parses a race's `.SKB` sky file exactly as `Sky_Load` (`LEGORacers.exe` `0x0041c550`) does: named settings, each a list of keyframes with an integer and three byte triples, then the optional name of the setting to start with and an optional float.

## User flows

- **Parse a sky**: the race passes the bytes of `BACKGRND.SKB` to `parseSky` and gets `settings`, `selectedSettingName`, `float` and `readByteCount`.

## Invariants

- The file is `0x2c [ count ] {` and count settings `0x27 [ keyframes ] "name" { (0x27 { keywords }) * keyframes }`, then `}`.
- Keyframes start from the reset values of the loader (integer 1000, every byte 0xff); `0x28` reads the integer and `0x29`, `0x2a`, `0x2b` three integers each, kept as bytes. Any other keyword is a syntax error.
- After the settings the loader reads one token and, when it is `0x2d`, a name; then one more token and, when it is `0x2e`, a float. Tokens that do not match are dropped, as in the original.

## Out of scope

Resolving the selected name to a setting index (0 when not found), and blending the keyframes over time (`0x0041ccb0`).
