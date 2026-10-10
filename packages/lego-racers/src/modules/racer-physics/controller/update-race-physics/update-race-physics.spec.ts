import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadCollisionObject } from '../../../collision/index.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import {
  createFloatArithmetic,
  FpuPrecision,
  IDENTITY_MATRIX3,
} from '../../../simulation-math/index.ts'
import {
  createCarRigidBody,
  setHullPoint,
  setWheelGeometry,
} from '../../types/car-rigid-body/car-rigid-body.ts'
import { stepCarRigidBody } from '../../types/rigid-body-step/rigid-body-step.ts'
import { stepRaceSubStepNotYetPorted, updateRacePhysics } from './update-race-physics.ts'

const SINGLE = createFloatArithmetic(FpuPrecision.SINGLE)

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

describe('updateRacePhysics', () => {
  it('runs one physics sub-step per piece of the scaled frame time, in order', () => {
    // Arrange
    const recordSubStep = (steps: readonly number[], step: number): readonly number[] => [
      ...steps,
      step,
    ]

    // Act
    const steps = updateRacePhysics(
      SINGLE,
      [],
      { frameDeltaMilliseconds: 100, isTimeScaled: true },
      recordSubStep
    )

    // Assert
    expect(steps).toEqual([40, 40, 40, 40, 15])
  })

  it('leaves the state unchanged with the not yet ported sub-step', () => {
    // Arrange
    const state = { racers: [] }

    // Act
    const result = updateRacePhysics(
      SINGLE,
      state,
      { frameDeltaMilliseconds: 30, isTimeScaled: false },
      stepRaceSubStepNotYetPorted
    )

    // Assert
    expect(result).toBe(state)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'runs RigidBody_Step per sub-step and lands a car on the road of the first race track',
    () => {
      // Arrange: (378, 584.33) is the centre of a flat road triangle at z = 19 in RACEC0R0's COLLIDE.BVB.
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const track = loadCollisionObject({
        bytes: archive.readFile('GAMEDATA\\RACEC0R0\\COLLIDE.BVB'),
        isMirrored: false,
        frame: undefined,
      })
      const body = setWheelGeometry(
        SINGLE,
        createCarRigidBody(SINGLE, {
          displayFrame: {
            rotation: IDENTITY_MATRIX3,
            position: { x: 378, y: Math.fround(584.333), z: 22 },
          },
          displayBoundingRadius: 5,
          mass: 1,
          dimensions: { x: 8, y: 5, z: 6.2 },
        }),
        { x: 3, y: 2, z: -1 },
        4,
        6
      )
      const car = [
        { x: 3, y: -2, z: 0 },
        { x: 3, y: 2, z: 0 },
        { x: -3, y: -2, z: 0 },
        { x: -3, y: 2, z: 0 },
      ].reduce((current, corner, index) => setHullPoint(SINGLE, current, index, corner), body)

      // Act: twelve frames of 50 ms, split into 40 + 10 ms sub-steps.
      const landed = Array.from({ length: 12 }).reduce<typeof car>(
        (current) =>
          updateRacePhysics(
            SINGLE,
            current,
            { frameDeltaMilliseconds: 50, isTimeScaled: false },
            (state, stepMilliseconds) =>
              stepCarRigidBody(SINGLE, state, { stepMilliseconds, collisionObjects: [track] })
          ),
        car
      )

      // Assert
      expect(landed.groundedWheelCount).toBe(4)
      expect(landed.frame.position.z).toBe(Math.fround(20.2))
      expect(landed.wheels.map((wheel) => wheel.material)).toEqual(['road', 'road', 'road', 'road'])
    }
  )
})
