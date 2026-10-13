# Feature: cinema

## Behaviour

Parses a cinema database (`PST.CDB`) as `Cinema_Load` (`0x00406980`): the worlds it names and each cinema's objects, actions, dummies and lights, and says which actions are on the timeline at a time (30 frames per second, looping).

## User flows

- Parse cinemas: `parseCinemaDatabase(bytes)` returns the world names, the cinemas and `readByteCount`.
- Play a cinema: `getActiveCinemaActions(cinema, milliseconds)` lists the actions shown; `getCinemaFrame` and `getCinemaLoopMilliseconds` give the clock inside the loop.
- Play a full-screen cinema once: `stepCinemaClock` and `getCinemaClock` are the record's clock (`0x00406390`); `getIsCinemaFinished` says the update finds it finished (`0x00466d90`), `getIsCinemaSkipped` and `getIsCinemaSkippedByKey` whether a key press ends it (`0x00466ec0`: from frame `framesPerSecond` on, one second in).

## Invariants

- A cinema without its own length is as long as its longest object; keywords an entry does not know are skipped.
- The clock's frame is the summed rate times milliseconds over 1,000, so any steps of the same total land on the same frame; a frame at or past the length stops it.

## Out of scope

Lights, dummy objects, `PST.MAB` material animations, and of the `.CEB` events the sounds, fades and text. A file that plays all its cinemas in turn (`+0x2c4`) and looping full-screen cinemas.
