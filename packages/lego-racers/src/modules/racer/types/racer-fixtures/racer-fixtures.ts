import { createBoxRigidBody } from '../../../racer-physics/index.ts'
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

export const createTestCarBody = (): CarBody =>
  createCarBody({
    rigidBody: createBoxRigidBody(SINGLE_ARITHMETIC, {
      frame: ORIGIN_FRAME,
      mass: 2,
      dimensions: { x: 1, y: 1, z: 1 },
    }),
    displayFrame: ORIGIN_FRAME,
    scaledMass: 3,
    gravity: 2,
    gripScale: 0.5,
    wheelRadius: 2,
    steeringScale: 1,
    throttleScale: 1,
  })

export const createTestContext = (): RacerSetContext =>
  Object.freeze({ arithmetic: SINGLE_ARITHMETIC, tables: IDENTITY_TABLES, checkpoints: [] })

export const createTestRacerSet = (count: number): RacerSet =>
  createRacerSet(
    Array.from({ length: count }, () => createRacer(createTestCarBody())),
    0,
    0
  )
