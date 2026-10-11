# Feature: menu-file

## Behaviour

Reads the menu description (`.MIB`) and menu style (`.MSB`) files of `LEGO.JAM`, ported from the readers `0x00469a20`..`0x0046af50`, `0x0047f2b0` and `0x0046fe20`..`0x00470dc0`.

## User flows

- **Parse**: `parseMenuDescription(bytes)` and `parseMenuStyles(bytes)` return the sections and their entries with every property.

## Invariants

- A file parses to its last byte; an unknown keyword or a repeated entry name is an error, as in the original.
- Every MIB and MSB file of `LEGO.JAM` parses.
- Pure functions of the bytes.

## Out of scope

Drawing the menus, and the meaning of the properties beyond their grammar (see `front-end`).
