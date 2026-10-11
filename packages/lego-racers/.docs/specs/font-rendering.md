# Feature: font-rendering

## Behaviour

Builds a bitmap font from an FDB entry and its image, measures text and lays it out as glyph rectangles, ported from `GolDP.dll` `0x1001df80`..`0x1001e190` and `LEGORacers.exe` `0x004092b0`, `0x00408be0`, `0x00408d50`, `0x00408fe0`, `0x00409300`, `0x00409560` and `0x00409690`.

## User flows

- **Build**: `buildBitmapFont(definition, bitmap)` scans the image's glyph columns and sorts the glyph table by character code.
- **Measure**: `getTextWidth`, `getWrappedTextSize`.
- **Lay out**: `layoutText` returns the source and destination rectangles of every glyph, clipped, with line breaking and centring.

## Invariants

- Pure functions of their inputs: no DOM, no canvas; the caller draws the rectangles.
- Results match the original bit for bit in both x87 precisions (differential specs).
- A font image without a glyph for every listed character is an error, as in the original.

## Out of scope

The font object's surface interface, and text drawn by the cinema subsystem.
