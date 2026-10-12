export { getNearestRacerSound } from './controller/nearest-racer-sound/nearest-racer-sound.ts'
export type {
  NearestRacerCandidate,
  NearestRacerSound,
} from './controller/nearest-racer-sound/nearest-racer-sound.types.ts'
export { getSoundMix } from './controller/sound-mix/sound-mix.ts'
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
  getRaceEventLoops,
  getRaceEventSounds,
  getSkidStartSound,
  NO_RACE_SOUND_CONTEXT,
  POWER_UP_SOUND_SITES,
} from './controller/race-sounds/race-sounds.ts'
export {
  INITIAL_ENGINE_SOUND_STATE,
  stepEngineSounds,
} from './controller/engine-sounds/engine-sounds.ts'
export type { RaceSoundContext } from './controller/race-sounds/race-sounds.ts'
export type {
  EngineLoop,
  EngineLoopKind,
  EngineSoundInput,
  EngineSoundState,
  EngineSoundStep,
} from './controller/engine-sounds/engine-sounds.types.ts'
export { SoundBankKind } from './types/sound-bank-kind/sound-bank-kind.ts'
export type {
  LoopedSoundRequest,
  MusicCue,
  SoundBankKind as SoundBankKindValue,
  SoundListener,
  SoundLocation,
  SoundMix,
  SoundRequest,
  SoundSource,
} from './types/race-audio.types.ts'
