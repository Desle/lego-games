import type { MusicCue, SoundRequest } from '@lego-games/lego-racers/race-audio'
import type { RacerEngineLoops } from '@lego-games/lego-racers/race-presentation'
import type { Vector3 } from '@lego-games/lego-racers/simulation-math'

// Plays what the race-audio module chose. Every method is safe to call without audio support or a missing file.
export type RaceAudioPlayer = {
  // Browsers start audio only after a gesture; call this from one.
  readonly resume: () => void
  readonly playSound: (request: SoundRequest) => void
  readonly playMusic: (cue: MusicCue) => void
  // The racers' engine and skid loops of this frame (0x00437d40): the ones that play start, follow their volume and
  // pitch and fade with the distance to the listener; the others stop.
  readonly setEngineLoops: (racers: readonly RacerEngineLoops[], listener: Vector3) => void
  readonly dispose: () => void
}

// A sound that is playing and the gain that sets its volume.
export type PlayingSound = {
  readonly source: AudioBufferSourceNode
  readonly gain: GainNode
}
