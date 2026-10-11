import { createRandomTable } from '../../../random-table/index.ts'
import {
  createFixtureRacerDefinition,
  FIXTURE_ARITHMETIC,
} from '../../types/race-fixtures/race-fixtures.ts'
import type { RaceDefinition, RaceState } from '../../types/race.types.ts'
import { createRace } from '../create-race/create-race.ts'

// Test fixtures: a race of a player and a computer racer on no track, with tables whose entry n is n.
export const createFixtureDefinition = (): RaceDefinition => ({
  arithmetic: FIXTURE_ARITHMETIC,
  tables: {
    randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
    cosineValues: Array.from({ length: 1024 }, (_, index) => index),
  },
  raceModeFlags: 0,
  localPlayerCount: 1,
  multiplayerLapCount: 3,
  isCountdownSkipped: false,
  isMirrored: false,
  isPointsRecordPresent: false,
  ghost: null,
  racers: [createFixtureRacerDefinition(0), createFixtureRacerDefinition(2)],
  checkpoints: [],
  collisionObjects: [],
  startPositions: [],
  powerUps: { bricks: [], enhancementBricks: [], readByteCount: 0 },
  timers: null,
  mainTriggers: null,
  environmentTriggers: null,
  hazards: null,
  randomPosition: 0,
  getGroundPoint: null,
  trackTargets: [],
})

export const createFixtureRace = (): RaceState => createRace(createFixtureDefinition())
