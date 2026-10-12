import {
  createCarBody,
  createFigure,
  createRacer,
  createRacerSet,
  playFigureAnimation,
} from '../../../racer/index.ts'
import type { FigureAnimation, Racer, RacerSet } from '../../../racer/index.ts'
import type { RacerAppearance, RacerFigures } from '../../../racer-appearance/index.ts'
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

const FIXTURE_ANIMATION_COUNT = 18
const FIXTURE_ANIMATION: FigureAnimation = Object.freeze({
  rate: 0.03,
  vector: ZERO_VECTOR3,
  boundsCentre: ZERO_VECTOR3,
  boundsRadius: 100,
  frameCount: 10,
  period: 11,
})
const FIXTURE_RESOURCES = Object.freeze({
  textureDatabaseName: '',
  materialLibraryName: '',
  modelName: '',
  skeletonName: '',
  animationName: '',
})

// A figure with every animation of a driver (18) so the driver's choices have something to play.
const createFixtureFigure = () =>
  Object.freeze({
    ...playFigureAnimation(
      createFigure(
        Array.from({ length: FIXTURE_ANIMATION_COUNT }, () => FIXTURE_ANIMATION),
        { centre: ZERO_VECTOR3, radius: 0, radiusScale: 1 }
      ),
      0
    ),
    flags: 0x10000 | 0x40000,
  })

export const FIXTURE_RACER_APPEARANCE: RacerAppearance = Object.freeze({
  bodyModel: null,
  wheelModel: FIXTURE_RESOURCES,
  secondWheelModel: null,
  driverModel: null,
  seatPoint: ZERO_VECTOR3,
  wheelMarks: { points: [], widths: [0, 0] as const },
  sharedResourceName: '',
  shadowImageName: '',
})

export const createFixtureRacerFigures = (): RacerFigures =>
  Object.freeze({
    bodyBounds: null,
    wheels: createFixtureFigure(),
    secondWheels: null,
    driver: createFixtureFigure(),
  })

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
  engineSoundValue: 0,
  appearance: FIXTURE_RACER_APPEARANCE,
  figures: createFixtureRacerFigures(),
  savedCar: null,
})

export const createFixtureRacer = (): Racer =>
  createRacer(createCarBody(createFixtureRacerDefinition(0).carBody))

export const createFixtureRacerSet = (count: number): RacerSet =>
  createRacerSet(
    Array.from({ length: count }, () => createFixtureRacer()),
    0,
    0
  )
