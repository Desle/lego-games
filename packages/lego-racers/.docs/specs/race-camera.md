# Feature: race-camera

## Behaviour

Ports the chase camera of `Camera_Update` (`0x00428540`): follow distance, height, eased eye, eased heading, look-behind, cockpit and finish modes.

## User flows

- **Attach and update**: `attachCamera`, then `updateCamera(camera, racerView, stepMilliseconds)` per physics sub-step returns the eye, forward and up.
- **Change view**: `setCameraPreset` selects a row of the preset table; `setCameraLookingBehind` follows binding 8.

## Invariants

- The camera is pure and free of DOM and Three.js.
- The engine's up argument points down; a renderer negates it.
- The first update after a snap request takes the target whole.

## Out of scope

The introduction fly-through, the field-of-view effects (they draw from the random table), the camera lock and the sound listener.
