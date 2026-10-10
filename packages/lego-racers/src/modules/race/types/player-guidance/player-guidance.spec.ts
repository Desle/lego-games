import type { Checkpoint } from '../../../checkpoint/index.ts'
import type { Racer } from '../../../racer/index.ts'
import { createFixtureRacer, FIXTURE_ARITHMETIC } from '../race-fixtures/race-fixtures.ts'
import { getRacerAfterTargetGuidance, getRacerAfterWrongWayCheck } from './player-guidance.ts'

const CHECKPOINT: Checkpoint = {
  plane: [1, 0, 0, 0],
  point: [0, 0, 0],
  progress: 0.5,
  links: [0, 0xff, 0xff, 0xff],
}

const getRacer = (heading: { x: number; y: number; z: number }, flags: number): Racer => {
  const racer = createFixtureRacer()
  return Object.freeze({
    ...racer,
    flags,
    checkpointIndex: 0,
    carBody: Object.freeze({
      ...racer.carBody,
      rigidBody: Object.freeze({ ...racer.carBody.rigidBody, heading }),
    }),
  })
}

const input = (stepMilliseconds: number) => ({
  arithmetic: FIXTURE_ARITHMETIC,
  checkpoints: [CHECKPOINT],
  stepMilliseconds,
})

describe('player guidance', () => {
  it('warns when the car points along the checkpoint normal, and shows it 500 ms later', () => {
    // Arrange
    const againstTheWay = getRacer({ x: 1, y: 0, z: 0 }, 0)

    // Act
    const pending = getRacerAfterWrongWayCheck(input(33), againstTheWay)
    const showing = getRacerAfterWrongWayCheck(input(500), pending)

    // Assert
    expect(pending).toMatchObject({ flags: 0x2000, wrongWayMilliseconds: 500 })
    expect(showing).toMatchObject({ flags: 0x4000, wrongWayMilliseconds: 0 })
  })

  it('clears the warning once the car points against the normal again', () => {
    // Arrange
    const warned = getRacer({ x: -1, y: 0, z: 0 }, 0x2000)

    // Act
    const checked = getRacerAfterWrongWayCheck(input(33), warned)

    // Assert
    expect(checked.flags).toBe(0)
  })

  it('shows no warning to a racer that is being warped, or has no checkpoint', () => {
    // Arrange
    const warping = getRacer({ x: 1, y: 0, z: 0 }, 0x2010)
    const lost = Object.freeze({ ...getRacer({ x: 1, y: 0, z: 0 }, 0), checkpointIndex: -1 })

    // Act
    const warpingChecked = getRacerAfterWrongWayCheck(input(33), warping)
    const lostChecked = getRacerAfterWrongWayCheck(input(33), lost)

    // Assert
    expect(warpingChecked.flags).toBe(0x10)
    expect(lostChecked).toBe(lost)
  })

  it('says on which side a target lies when it is not ahead (0x00439ea0)', () => {
    // Arrange
    const racer = getRacer({ x: 1, y: 0, z: 0 }, 0x8000)

    // Act
    const above = getRacerAfterTargetGuidance(FIXTURE_ARITHMETIC, racer, { x: 0, y: 10, z: 0 })
    const below = getRacerAfterTargetGuidance(FIXTURE_ARITHMETIC, racer, { x: 0, y: -10, z: 0 })
    const ahead = getRacerAfterTargetGuidance(FIXTURE_ARITHMETIC, racer, { x: 10, y: 0, z: 0 })

    // Assert
    expect(above.flags & 0x30000).toBe(0x20000)
    expect(below.flags & 0x30000).toBe(0x10000)
    expect(ahead.flags & 0x30000).toBe(0)
  })
})
