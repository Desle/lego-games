import { SoundBankKind } from '../../types/sound-bank-kind/sound-bank-kind.ts'
import type { SoundLocation } from '../../types/race-audio.types.ts'

const VOICE_BASE = 1000
const VOICE_FOLDER_BASE = 0x44c
const TRACK_BASE = 3000

// 0x00443c30: which bank a sound id belongs to and its entry there.
export const getSoundLocation = (soundId: number): SoundLocation => {
  if (soundId < VOICE_BASE) return Object.freeze({ bank: SoundBankKind.GENERAL, index: soundId })
  if (soundId < VOICE_FOLDER_BASE) {
    return Object.freeze({ bank: SoundBankKind.VOICE, index: soundId - VOICE_BASE })
  }
  if (soundId < TRACK_BASE) {
    return Object.freeze({ bank: SoundBankKind.VOICE_FOLDER, index: soundId - VOICE_FOLDER_BASE })
  }
  return Object.freeze({ bank: SoundBankKind.TRACK, index: soundId - TRACK_BASE })
}
