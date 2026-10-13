import type {
  LoopedSoundRequest,
  MusicCue,
  NearestRacerSound,
  SoundListener,
  SoundRequest,
} from '@lego-games/lego-racers/race-audio'
import type { RacerEngineLoops } from '@lego-games/lego-racers/race-presentation'

// Plays what the race-audio module chose. Every method is safe to call without audio support or a missing file.
export type RaceAudioPlayer = {
  // Browsers start audio only after a gesture; call this from one.
  readonly resume: () => void
  // Who hears the frame's sounds (the player's racer); every other call of the frame is measured from it.
  readonly setListener: (listener: SoundListener) => void
  readonly playSound: (request: SoundRequest) => void
  readonly playMusic: (cue: MusicCue) => void
  // The looped sounds the frame's events start or stop (the shield's hum, the oil slick, track events and hazards);
  // the ones with a source fade and pan with the listener every frame.
  readonly setLoopedSounds: (requests: readonly LoopedSoundRequest[]) => void
  // The racers' engine and skid loops of this frame (0x00437d40): the ones that play start, follow their volume and
  // pitch and fade with the distance to the listener; the others stop.
  readonly setEngineLoops: (racers: readonly RacerEngineLoops[]) => void
  // The sound of the racer nearest to the player's (0x0043c1b0), or null when none is within range.
  readonly setNearestRacerSound: (sound: NearestRacerSound | null) => void
  readonly dispose: () => void
}

// A sound that is playing: the source, the gain that sets its volume and the gains that pan it.
export type PlayingSound = {
  readonly source: AudioBufferSourceNode
  readonly volume: GainNode
  readonly left: GainNode
  readonly right: GainNode
}

// A looped sound that was started with a source, so that the listener's move changes its mix.
export type PositionedLoop = {
  readonly sound: PlayingSound
  readonly request: LoopedSoundRequest
}
