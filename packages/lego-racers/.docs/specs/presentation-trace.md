# Feature: presentation-trace

## Behaviour

Records what the original game shows and plays during a race, so the port can be compared with it the way the golden trace compares the simulation. The original runs in the emulator (`reverse-engineering/emulator/presentation_trace.py`) with Direct3D 3 and DirectSound faked by recorders: every Direct3D draw of a recorded frame (the vertices GolDP.dll hands over, the texture's pixels, the render states), and every DirectSound call plus the race's sound and music requests. The audio comparison lists, per sound id and per tune, where the port differs.

## User flows

- **Run it**: `pnpm run audio-trace` and `pnpm run render-trace` at the repository root; both skip without the virtualenv or the original files and are not part of `pnpm run check`.
- **Read the original**: `readOriginalPresentation(scenario)` starts the emulator and returns the textures, the recorded render frames and the audio frames.
- **Read the front end**: `readOriginalFrontEnd(scenario)` runs the original's menus with tapped keys.
- **Compare pictures**: `getOriginalTriangles`, `getCandidateMatrices`, `projectWorldTriangle` and `compareRenderFrame` match the original's triangles with the port's by their place on the screen; `matchTextures` identifies surfaces by their pixels; `compareQuadPlacements` does the same for rectangles (HUD, menus). Method and findings: `.docs/reverse-engineering/render-trace.md`.
- **Compare audio**: `getOriginalAudioCalls` turns the audio frames into sound and music calls; `compareAudioCalls(original, port)` summarises them per sound id and lists the tune differences.

## Invariants

- The recorders only read emulator memory; the fake sound device answers like a working one (it is why the original draws for the racing tune).
- The port side is never fed the original's values except the introduction camera's length.

## Out of scope

Pixel-level rasterisation (the trace stops at the vertices Direct3D receives) and the camera's field of view, and the volume, pan and frequency curves of individual sounds (recorded in the original's trace, not compared).
