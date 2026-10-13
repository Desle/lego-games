# Feature: front-end

## Behaviour

The menus of the game: a screen stack driven by input, producing draw commands and the settings of the race the player chose, from `FrontEnd_Run` `0x0042b1e0`, the screen factory `0x0047f4e0` and the screen handlers.

## User flows

- **Navigate**: `stepFrontEnd(state, resources, environment, input, milliseconds)` handles one input and the elapsed time.
- **Draw**: `getFrontEndFrame` returns the draw commands (images, fills, text glyph rectangles, 3D viewports) and the sounds of the frame.
- **Start a race**: `getFrontEndRaceRequest` and `getRaceLoadOptions` give the race folder and the racer and lap counts the menus produced.
- **Start a circuit**: with one player the racer pick opens the circuit's introduction cinema (`0x004850a0`), under `saveall` for one frame (`0x004861b0`, `0x00487020`); the race starts when the cinema ends or a key ends it (`0x00479d10`, `0x00476a00`).

## Invariants

- Deterministic and DOM-free: the viewer draws the commands and reads the input devices.
- The settings the menus write match the original's offsets (`+0x24` mode, `+0x100` racer count, `+0x2c` laps, `+0x32c` local players).
- Progression, the garage and the save files come in through `FrontEndEnvironment`.
- A full-screen cinema ends in the frame after its clock reached its length, or on a key other than up and down once one second has played; the screen gets that as `accept`.

## Out of scope

The car builder, save files, circuit progression, the cinemas' sounds, fades and captions, what `saveall` saves and draws, the award screens' way out to the won cars and credits (`0x00476a00`), 3D backdrops, the video and audio options and the split-screen versus race.
