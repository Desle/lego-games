# Audio trace: what the original plays, against the port

The golden trace compares the simulation. The audio trace compares what the player **hears**: the sound effects the race asks for and the tunes its music stream plays. `pnpm run audio-trace` runs the original race in the emulator with a fake DirectSound device and the port beside it, over eight scenarios (about 80 s). It skips cleanly without the virtualenv or the original files and is not part of `pnpm run check` (the specs are named `*.trace.spec.ts`; `vitest.trace.config.ts` of the viewer package runs them).

## The fake sound device

`reverse-engineering/emulator/audio_trace.py` answers `DirectSoundCreate` (the import `Ordinal_1` of `DSOUND.dll`, called by `SoundSystem_Initialize` `0x004186f0`) with a device whose buffers have memory and a play cursor that follows the scripted clock. Without it the sound system never starts, the race has no music object, and `Race_UpdateState2` (`0x00434b00`) skips the racing tune's random draw (`+0x3320` is null): this is why the golden trace ran with `musicTuneCount: 0`. With the device the original behaves like a PC that has a sound card.

It records, per frame:

- the race's requests: `RaceSounds_PlayAt` `0x00443b80` and `RaceSounds_Play` `0x00443b50` (sound id, the six arguments, the caller's address);
- the music list entry the streamer opens (`0x0041a8a0`) and the stream object's play (`0x00419f20`, loop flag), stop (`0x00419fa0`) and volume (`0x0041a520`) slots, with the file name (stream `+0x4c`);
- every DirectSound buffer: creation (size, channels, rate, bits), duplicate, play (flags, volume, pan, frequency, a hash of the decoded samples), stop, `SetVolume`, `SetPan`, `SetFrequency`.

The load is frame `-1` (the introduction tune `start.tun` starts in `Race_LoadTrackContent`). The timer callback that refills the stream (`timeSetEvent` 100 ms) never fires in the emulator, so the stream buffers are not filled; effects are (they are decoded whole when played).

## What is compared

Per scenario: for every sound id the number of requests per frame (original against `RacePresentationFrame.sounds`), and the tune started in every frame (list index and loop flag, against `RacePresentationFrame.music` and the load's introduction music). Volume, pan and frequency are recorded, not compared.

## Findings

| #   | What                                                                                                                   | Where                                                                                                                                                                                                                                                                                          | Status                                                                                                                  |
| --- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 1   | **Wrong racing tune on four of eight races** (RACEC0R1 entry 1 for 6, RACEC0R2 and RACEC3R0 1 for 5, RACEC1R0 5 for 4) | The race already makes the one random draw of `0x00434b00` and raises `race.tune_changed`; `stepRacePresentation` drew a second value after the cursor had moved and played that. Now the cue comes from the event (`getTuneMusic`).                                                           | Fixed                                                                                                                   |
| 2   | **Music missing on every map but Royal Knights**                                                                       | The viewer's development loader fetched the tunes of Royal Knights Raceway only (`start`, `royal`, `lose`, `win`, `knight`, `moat`, `armor`); each track's `LEGOMSC`-style list (`0x0041a700`) names its own (alien, forest, ice, ...). Now the race fetches the tunes its list names.         | Fixed                                                                                                                   |
| 3   | **No music on the main menu**                                                                                          | The front end plays only sounds (`FrontEndAudioPlayer`); see the front-end section below.                                                                                                                                                                                                      | See below                                                                                                               |
| 4   | Sounds the original asks for and the port does not                                                                     | `0x0045d200` power-up brick (`0x28`, `0x4b`), `0x0045d2a3` (ids 40), `0x00457820` enhancement brick (49, 72, 14), `0x00439420` computers' start (11, 12), `0x004377f0` engine and skid (25, 56), `0x00452367`/`0x0045241a` cannon (6, 5), track-bank hazards `0x004642c0`/`0x004643e0` (3000+) | Simulation events the port does not raise yet (bricks collected by computers, hazards); listed in the spec per scenario |

## The front end

`reverse-engineering/emulator/front_end_trace.py` runs `GameApplication_RunFrontEnd` (`0x0042bdc0`) with the fake sound device and scripted keys (each key is tapped within one frame; `qsort` is stubbed in `front_end_stubs.py`). The original shows its logos (legal, `0x28`, and the splash) for 152 frames, then the main menu (screen 2) and starts **`theme.tun`** (entry 0 of `MENUDATA\LEGOMSC`, 18 entries) looped. Screen changes are recorded from the screen stack (`0x0047fa70` push, `0x0047faa0` pop).

`FrontEnd_SetMusic` is called when a screen opens: the award and win-car screens (`0x16`..`0x1c`, `0x25`, class `0x00475d30`) take entries 2, 3, 4, 0xb, 0xd, 0xe, 0xf and 0xc by id, the circuit introductions (`0x1f`..`0x24`, `0x00479b10`) entries 5 to 10, the splash, credits and introduction screens (`0x00488410`) entries 0x12, 0x11, 0x14 and 0x15. Traced: the main menu starts the theme, **the garage (3) the builder tune (entry 1)**, going back the theme again; the circuit race (5), single race (6), time trial (0x1d) and options (8) screens leave the tune alone. The port's `getFrontEndMusicIndex` and `stepFrontEnd` (`musicListIndex`) follow those rules; the other screens are a hypothesis (keep the tune). `front-end-audio-trace.trace.spec.ts` compares the sequence of tunes of six visits.

## Adding a scenario

Add an `AudioTraceCase` to `AUDIO_CASES` in `audio-trace.trace.spec.ts` with the sound ids the port still lacks (`gapSoundIds`); music must match exactly.
