import type { SoundLocation } from '../../types/race-audio.types.ts'

// The engine's three looped sounds and the skid loop of one racer (racer +0xd9c, +0xda0, +0xda4 and +0xda8).
export type EngineLoopKind = 'idle' | 'middle' | 'high' | 'skid'

// What 0x00437d40 reads of a racer.
export type EngineSoundInput = {
  // Racer flag 0x400: the sounds run.
  readonly isRunning: boolean
  // Racer flag 0x1000: the engine is quieter (0.5 instead of 0.7).
  readonly isQuiet: boolean
  // Driver flag 0x1 (+0xc84): full throttle.
  readonly isDriverThrottling: boolean
  // Car body +0x628, +0x604 and +0x618.
  readonly throttle: number
  readonly speed: number
  readonly forwardSpeed: number
  // Racer +0xd50 and +0xd54.
  readonly airborneMilliseconds: number
  readonly engineSoundValue: number
}

// +0xd24 (which loop the engine is in), +0xd28, +0xd2c and +0xd30 (the loops' fades) and the loops that play.
export type EngineSoundState = {
  readonly mode: 0 | 1 | 2
  readonly fades: readonly [number, number, number]
  readonly isPlaying: readonly [boolean, boolean, boolean]
  readonly isSkidPlaying: boolean
}

// A loop as the sound object holds it: its volume factor (object +0x04 after 0x004180e0) and the value of +0x08.
export type EngineLoop = {
  readonly kind: EngineLoopKind
  readonly soundId: number
  readonly location: SoundLocation
  readonly isPlaying: boolean
  readonly volume: number
  readonly pitch: number
}

export type EngineSoundStep = {
  readonly state: EngineSoundState
  readonly loops: readonly EngineLoop[]
  // 0x00437d40 plays sound 2 once when the skid begins.
  readonly isSkidStarted: boolean
}

// The loop the racer's state asks for and which loops play after the choice.
export type EngineModeChoice = {
  readonly mode: 0 | 1 | 2
  readonly isPlaying: readonly [boolean, boolean, boolean]
}
