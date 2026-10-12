export { getProjectileRegistrySphere } from './controller/projectile-registry/projectile-registry.ts'
export { getRaceStateWithGrants } from './controller/get-race-state-with-grants/get-race-state-with-grants.ts'
export type { RaceGrant } from './controller/get-race-state-with-grants/get-race-state-with-grants.types.ts'
export { createRace } from './controller/create-race/create-race.ts'
export { RACE_STEP_DEPENDENCIES } from './controller/race-dependencies/race-dependencies.ts'
export { IDLE_RACER_CONTROLS, NO_RACE_CONTACTS } from './controller/race-world/race-world.ts'
export { endRaceFromMenu, stepRace } from './controller/step-race/step-race.ts'
export { updateRace } from './controller/update-race/update-race.ts'
export { loadRaceDefinition } from './services/load-race/load-race.ts'
export { getCircuitRacerCodes, readRacerDatabases } from './services/load-race/load-racers.ts'
export { runHeadlessRace } from './controller/run-headless-race/run-headless-race.ts'
export { getLapGapMilliseconds } from './types/lap-gap/lap-gap.ts'
export { getPlaceholderCarBodyDefinition } from './types/placeholder-car/placeholder-car.ts'
export {
  getRacerAfterTargetGuidance,
  getRacerAfterWrongWayCheck,
} from './types/player-guidance/player-guidance.ts'
export {
  COUNTDOWN_MILLISECONDS,
  FINISHING_MILLISECONDS,
  GHOST_MENU_MILLISECONDS,
  INTRODUCTION_MILLISECONDS,
  RACE_PHASE_STATE_NUMBERS,
  RacePhase,
  RESULTS_MILLISECONDS,
} from './types/race-phase/race-phase.ts'
export {
  convertRacerToComputer,
  enterZoneOne,
  enterZoneTwo,
  enterZoneZero,
  getRacerAfterCheckpointTouch,
  releaseRacerAtStart,
  resetRacerForRace,
} from './types/racer-transitions/racer-transitions.ts'
export {
  placeCarBodyOnRoute,
  stepScriptedCarBody,
} from './types/scripted-car-body/scripted-car-body.ts'
export { PauseMenuMode } from './types/pause-menu/pause-menu.ts'
export { INITIAL_FOV as INITIAL_FIELD_OF_VIEW_DEGREES } from './controller/camera-fov-effect/camera-fov-effect.ts'
export { getScreenFadeAlpha } from './types/screen-fader/screen-fader.ts'
export type { ScreenFade, ScreenFader } from './types/screen-fader/screen-fader.types.ts'
export { RaceExit } from './types/race-exit/race-exit.ts'
export { getStartFrame } from './types/start-frame/start-frame.ts'
export type {
  CheckpointTouch,
  RaceContacts,
  RaceDefinition,
  RaceEvent,
  RaceInputs,
  RacePhase as RacePhaseValue,
  RaceRacerDefinition,
  RaceState,
  RaceStepResult,
  ZoneCrossing,
} from './types/race.types.ts'
export { NO_MENU_INPUT } from './controller/pause-menu/pause-menu.ts'
export type { RaceMenuInput } from './types/pause-menu/pause-menu.types.ts'
export type {
  HeadlessRaceOptions,
  HeadlessRaceReport,
  HeadlessRacerReport,
} from './controller/run-headless-race/run-headless-race.types.ts'
export type { LoadRaceOptions } from './services/load-race/load-race.types.ts'
