# Feature: front-end

## Behaviour

The menus of the game: a screen stack driven by input, producing draw commands and the settings of the race the player chose, from `FrontEnd_Run` `0x0042b1e0`, the screen factory `0x0047f4e0` and the screen handlers.

## User flows

- **Navigate**: `stepFrontEnd(state, resources, environment, input, milliseconds)` handles one input and the elapsed time.
- **Draw**: `getFrontEndFrame` returns the draw commands (images, fills, text glyph rectangles, 3D viewports) and the sounds of the frame.
- **Start a race**: `getFrontEndRaceRequest` and `getRaceLoadOptions` give the race folder and the racer and lap counts the menus produced.

## Invariants

- Deterministic and DOM-free: the viewer draws the commands and reads the input devices.
- The settings the menus write match the original's offsets (`+0x24` mode, `+0x100` racer count, `+0x2c` laps, `+0x32c` local players).
- Progression, the garage and the save files come in through `FrontEndEnvironment`.

## Out of scope

The car builder, save files, circuit progression, cinemas, 3D backdrops, the video and audio options and the split-screen versus race.
