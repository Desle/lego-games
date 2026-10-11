import type { MusicCue, SoundRequest } from '@lego-games/lego-racers/race-audio'

// Plays what the race-audio module chose. Every method is safe to call without audio support or a missing file.
export type RaceAudioPlayer = {
  // Browsers start audio only after a gesture; call this from one.
  readonly resume: () => void
  readonly playSound: (request: SoundRequest) => void
  readonly playMusic: (cue: MusicCue) => void
  readonly dispose: () => void
}
