export { getSoundLocation } from './controller/get-sound-location/get-sound-location.ts'
export {
  getIntroductionMusic,
  getTuneMusic,
  RACE_MUSIC_VOLUME,
} from './controller/race-music/race-music.ts'
export {
  COUNTDOWN_SOUND_IDS,
  getCountdownSound,
  getPowerSlideSound,
  getRaceEventSounds,
  POWER_UP_SOUND_SITES,
} from './controller/race-sounds/race-sounds.ts'
export { SoundBankKind } from './types/sound-bank-kind/sound-bank-kind.ts'
export type {
  MusicCue,
  SoundBankKind as SoundBankKindValue,
  SoundLocation,
  SoundRequest,
} from './types/race-audio.types.ts'
