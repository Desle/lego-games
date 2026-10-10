# Feature: race-description

## Behaviour

Parses a race's `.RAB` race description exactly as `Race_LoadRaceDescription` (`LEGORacers.exe` `0x00431e00`) does: its display name, the name of every other file of the race (worlds, sky, start positions, checkpoints, routes' companions, power-ups, triggers, timers, emitters, hazards, track materials, sounds) and the camera point, camera vectors and display bounds.

## User flows

- **Parse a race description**: the race passes the bytes of `RACECxRy.RAB` and its mirror flag to `parseRaceDescription` and gets back every name (or `null` when the file leaves it out) and `readByteCount`.

## Invariants

- The file starts with keyword `0x35`, the display name (at most 63 characters) and `{`; keywords are read until `}` and nothing after it is read.
- File names are at most 12 characters and the track world object name at most 8; longer is an invalid string. An unknown keyword is a syntax error, as in the original.
- Keywords `0x31` and `0x32` read a name and drop it.
- A mirrored race negates the y component of the camera point and of both camera vectors, after reading, as the original does.

## Out of scope

Loading the named files, which belongs to each format's module, and the race set-up `0x00431e00` does after reading.
