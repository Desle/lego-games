import { createCarBody, createRacer, createRacerSet } from '../../../racer/index.ts'
import type { Racer, RacerSet } from '../../../racer/index.ts'
import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
  ZERO_VECTOR3,
} from '../../../simulation-math/index.ts'
import { getPlaceholderCarBodyDefinition } from '../placeholder-car/placeholder-car.ts'
import type { RaceRacerDefinition } from '../race.types.ts'

// Test fixtures: racers with the placeholder car at the origin.
export const FIXTURE_ARITHMETIC = createFloatArithmetic(FpuPrecision.SINGLE)

export const createFixtureRacerDefinition = (controllerKind: number): RaceRacerDefinition => ({
  controllerKind,
  carBody: getPlaceholderCarBodyDefinition(
    FIXTURE_ARITHMETIC,
    Object.freeze({ rotation: IDENTITY_MATRIX3, position: ZERO_VECTOR3 })
  ),
  route: null,
  personalityBytes: [100, 100, 100, 100, 100, 100],
  preferredPowerUpKind: null,
  preferredPowerUpLevel: 0,
  voiceBase: 1000,
})

export const createFixtureRacer = (): Racer =>
  createRacer(createCarBody(createFixtureRacerDefinition(0).carBody))

export const createFixtureRacerSet = (count: number): RacerSet =>
  createRacerSet(
    Array.from({ length: count }, () => createFixtureRacer()),
    0,
    0
  )
