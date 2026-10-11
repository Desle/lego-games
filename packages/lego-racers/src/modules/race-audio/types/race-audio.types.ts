import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { SoundBankKind as SoundBankKindValues } from './sound-bank-kind/sound-bank-kind.ts'

export type SoundBankKind = EnumValues<typeof SoundBankKindValues>

// A sound id as the race passes it to its sound player (0x00443b80, 0x00443b50): which of the four banks holds it
// and the entry in that bank (0x00443c30).
export type SoundLocation = {
  readonly bank: SoundBankKind
  readonly index: number
}

// One sound the race asks for, with the address of the call that asks for it.
export type SoundRequest = {
  readonly soundId: number
  readonly location: SoundLocation
  readonly address: string
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
