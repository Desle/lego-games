# Feature: race-audio

## Behaviour

Chooses the music track and the sound effects of a race, each traced to a call address.

## User flows

- **Music**: `getIntroductionMusic`, `getRacingMusic` (one random draw), `getFinishMusic`.
- **Effects**: `getRaceEventSounds(event)`, `getCountdownSound`, `getPowerSlideSound`; `getSoundLocation` finds the bank of an id.

## Invariants

- Ids are entries of the banks of `0x00443c30`.
- Nothing here decodes or plays audio.

## Out of scope

Looped engine sounds, positional audio, and voices (banks 1000 and up are located but not mapped to files).
