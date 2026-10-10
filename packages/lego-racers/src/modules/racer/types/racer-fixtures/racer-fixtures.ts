import { createCarRigidBody } from '../../../racer-physics/index.ts'
import type { CarRigidBody } from '../../../racer-physics/index.ts'
import { createRandomTable } from '../../../random-table/index.ts'
import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import { createCarBody } from '../car-body/car-body.ts'
import { createRacer, createRacerSet } from '../racer-state/racer-state.ts'
import type { CarBody, RacerSet, RacerSetContext, RacerTables } from '../racer.types.ts'

// Test fixtures: tables whose entry n is n, and a car body at the origin with simple numbers.
export const SINGLE_ARITHMETIC = createFloatArithmetic(FpuPrecision.SINGLE)

export const IDENTITY_TABLES: RacerTables = Object.freeze({
  randomTable: createRandomTable(Array.from({ length: 1024 }, (_, index) => index)),
  cosineValues: Object.freeze(Array.from({ length: 1024 }, (_, index) => index)),
})

const ORIGIN_FRAME = Object.freeze({
  rotation: IDENTITY_MATRIX3,
  position: Object.freeze({ x: 0, y: 0, z: 0 }),
})

// The car rigid body's defaults with a few fields set to simple numbers.
export const createTestCarBody = (): CarBody =>
  createCarBody({
    rigidBody: Object.freeze({
      ...createCarRigidBody(SINGLE_ARITHMETIC, {
        displayFrame: ORIGIN_FRAME,
        displayBoundingRadius: 1,
        mass: 2,
        dimensions: { x: 1, y: 1, z: 1 },
      }),
      scaledMass: 3,
      gravity: 2,
      gripScale: 0.5,
      topSpeed: 2,
    }),
    steeringScale: 1,
    throttleScale: 1,
  })

// The test car body with some car rigid body fields changed.
export const createTestCarBodyWith = (change: Partial<CarRigidBody>): CarBody => {
  const body = createTestCarBody()
  return Object.freeze({ ...body, rigidBody: Object.freeze({ ...body.rigidBody, ...change }) })
}

export const createTestContext = (): RacerSetContext =>
  Object.freeze({
    arithmetic: SINGLE_ARITHMETIC,
    tables: IDENTITY_TABLES,
    checkpoints: [],
    collisionObjects: [],
  })

export const createTestRacerSet = (count: number): RacerSet =>
  createRacerSet(
    Array.from({ length: count }, () => createRacer(createTestCarBody())),
    0,
    0
  )
