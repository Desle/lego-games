export { createCarBodySetup } from './controller/create-car-body/create-car-body.ts'
export {
  describeBuiltRacer,
  describeChampionRacer,
  getRacerRecord,
} from './controller/describe-racer/describe-racer.ts'
export {
  BASE_TOP_SPEED,
  getRatingScale,
  getSteeringScale,
  setTopSpeedRating,
} from './types/car-scales/car-scales.ts'
export {
  getIsCarBodyFlagged,
  getRaceModeRacerFlags,
  getRacerPowerUpAbilities,
} from './types/race-mode-racer/race-mode-racer.ts'
export { UnknownRacerRecordError } from './types/racer-setup-errors/racer-setup-errors.ts'
export { getStartSlot } from './types/start-slot/start-slot.ts'
export type { GhostStartRule } from './types/start-slot/start-slot.types.ts'
export type {
  BuiltCar,
  CarBodyOptions,
  CarBodySetup,
  CarDescription,
  RacerDatabases,
  RacerDescription,
  TopSpeedRating,
} from './types/racer-setup.types.ts'
