import { createEnum } from '../../../../shared/types/enum.types.ts'

// The four banks the race's sound player holds (0x00443ac0): the general bank (GENERAL.SBK, ids below 1000), the
// driver voices (1000..1099), the race's voice folder (1100..2999) and the track's own bank (3000 and up).
export const SoundBankKind = createEnum({
  GENERAL: 'general',
  VOICE: 'voice',
  VOICE_FOLDER: 'voice_folder',
  TRACK: 'track',
})
