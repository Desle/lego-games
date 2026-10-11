import type { Checkpoint } from '../../../checkpoint/index.ts'
import { createFixtureRacer, FIXTURE_ARITHMETIC } from '../race-fixtures/race-fixtures.ts'
import { getRacerAfterCheckpointContact } from './checkpoint-touch.ts'

const CHECKPOINTS: readonly Checkpoint[] = [
  { plane: [0, -1, 0, 224], point: [0, 224, 0], links: [1, 255, 255, 255], progress: 0 },
  { plane: [0, -1, 0, 516], point: [0, 516, 0], links: [0, 255, 255, 255], progress: 0.5 },
] as unknown as readonly Checkpoint[]

describe('checkpoint touch', () => {
  it('takes the side from the contact vector against the plane normal (0x00439fc0)', () => {
    // Arrange
    const racer = createFixtureRacer()
    const forward = { x: 0, y: -1, z: 0 }
    const backward = { x: 0, y: 1, z: 0 }

    // Act
    const touchedForward = getRacerAfterCheckpointContact(
      FIXTURE_ARITHMETIC,
      CHECKPOINTS,
      racer,
      1,
      forward
    )
    const touchedBackward = getRacerAfterCheckpointContact(
      FIXTURE_ARITHMETIC,
      CHECKPOINTS,
      racer,
      1,
      backward
    )

    // Assert
    expect(touchedForward.checkpointIndex).toBe(1)
    expect(touchedForward.checkpointSide).toBe(1)
    expect(touchedBackward.checkpointSide).toBe(0)
  })

  it('counts a lap at the start line (progress 0) when it is crossed forwards', () => {
    // Arrange
    const racer = Object.freeze({ ...createFixtureRacer(), lap: -1 })

    // Act
    const crossed = getRacerAfterCheckpointContact(FIXTURE_ARITHMETIC, CHECKPOINTS, racer, 0, {
      x: 0,
      y: -1,
      z: 0,
    })

    // Assert
    expect(crossed.lap).toBe(0)
    expect(crossed.checkpointIndex).toBe(0)
  })

  it('ignores a checkpoint the list does not hold', () => {
    // Arrange
    const racer = createFixtureRacer()

    // Act
    const touched = getRacerAfterCheckpointContact(FIXTURE_ARITHMETIC, CHECKPOINTS, racer, 9, {
      x: 0,
      y: 0,
      z: 0,
    })

    // Assert
    expect(touched).toBe(racer)
  })
})
