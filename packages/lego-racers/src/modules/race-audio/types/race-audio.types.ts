import type { Vector3 } from '../../simulation-math/index.ts'
import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { SoundBankKind as SoundBankKindValues } from './sound-bank-kind/sound-bank-kind.ts'

export type SoundBankKind = EnumValues<typeof SoundBankKindValues>

// A sound id as the race passes it to its sound player (0x00443b80, 0x00443b50): which of the four banks holds it
// and the entry in that bank (0x00443c30).
export type SoundLocation = {
  readonly bank: SoundBankKind
  readonly index: number
}

// Where a sound plays from and how far it carries (the arguments of RaceSounds_PlayAt 0x00443b80 after the id: the
// position, the squared-distance limits of the sound object (+0x30, +0x34), its volume factor and pitch (+0x08)).
export type SoundSource = {
  readonly position: Vector3
  readonly minimumDistance: number
  readonly maximumDistance: number
  readonly volume: number
  readonly pitch: number
}

// Whom the sounds are heard by (the sound system's listener): the human racer's position, and the horizontal axis to its
// left (the heading rotated a quarter turn) that the pan is measured on.
export type SoundListener = {
  readonly position: Vector3
  readonly left: Vector3
}

// What a source sounds like to a listener: the volume factor and pan as the sound object computes them, and the values
// DirectSound is given (hundredths of a decibel).
export type SoundMix = {
  readonly volume: number
  readonly directSoundVolume: number
  readonly pan: number
  readonly directSoundPan: number
  readonly pitch: number
}

// One sound the race asks for, with the address of the call that asks for it. A sound without a source plays at full
// volume in the middle (RaceSounds_Play 0x00443b50, and the calls whose position the port does not track yet).
export type SoundRequest = {
  readonly soundId: number
  readonly location: SoundLocation
  readonly address: string
  readonly source: SoundSource | null
}

// A looped sound object the race starts (RaceSounds_Get 0x00443bd0, then slot +4 with 1) or stops. `key` names the thing
// that owns the loop (a racer's shield, a track event, a hazard), so a restart replaces the earlier sound.
export type LoopedSoundRequest = {
  readonly isStart: boolean
  readonly key: string
  readonly soundId: number
  readonly location: SoundLocation
  readonly address: string
  readonly source: SoundSource | null
  // The racer the sound object keeps moving to (the shield's, the turbo's and the warp's hum), or null.
  readonly followedRacer: number | null
}

// A music track of the race's music list (race +0x16d, `LEGOMSC`) and how it plays.
export type MusicCue = {
  // Index into the music list (0x0041a700's entries, played by the music object's slot +0x10).
  readonly listIndex: number
  // The argument of the play call (slot +0x04): 1 loops the track.
  readonly isLooping: boolean
  // The address of the call that starts it.
  readonly address: string
}
