import type { Checkpoint } from '../../../checkpoint/index.ts'
import {
  createTestCarBodyWith,
  createTestContext,
} from '../../types/racer-fixtures/racer-fixtures.ts'
import { createRacer, createRacerSet, getRacer } from '../../types/racer-state/racer-state.ts'
import type { Racer } from '../../types/racer.types.ts'
import { updatePlayerGuidance } from './update-player-guidance.ts'

const WARNING = 0x2000
const WRONG_WAY = 0x4000
const GUIDED = 0x8000
const TARGET_LEFT = 0x10000
const TARGET_RIGHT = 0x20000
const NO_LINK = 0xff

// The plane's normal is (0, 1, 0): a car heading along it gives 1, above the limit of 0.2.
const createCheckpoint = (links: readonly number[]): Checkpoint => ({
  plane: [0, 1, 0, 0],
  point: [0, 0, 0],
  progress: 0,
  links,
})

const createGuidedRacer = (change: Partial<Racer>, heading = { x: 0, y: 1, z: 0 }): Racer => ({
  ...createRacer(createTestCarBodyWith({ heading })),
  checkpointIndex: 0,
  ...change,
})

const guide = (racer: Racer, links: readonly number[], stepMilliseconds = 16): Racer => {
  const racerSet = createRacerSet([racer], 0, 0)
  const context = { ...createTestContext(), checkpoints: [createCheckpoint(links)] }
  return getRacer(updatePlayerGuidance(context, racerSet, 0, stepMilliseconds), 0)
}

describe('updatePlayerGuidance, 0x00439cf0', () => {
  it('starts a 500 ms warning when no link exists and the heading is along the plane normal', () => {
    // Arrange
    const racer = createGuidedRacer({})

    // Act
    const guided = guide(racer, [NO_LINK, NO_LINK, NO_LINK, NO_LINK])

    // Assert
    expect(guided.flags & WARNING).toBe(WARNING)
    expect(guided.wrongWayMilliseconds).toBe(500)
  })

  it('clears the warning at once when a link exists and the heading is across the normal', () => {
    // Arrange
    const racer = createGuidedRacer(
      { flags: WARNING, wrongWayMilliseconds: 300 },
      { x: 1, y: 0, z: 0 }
    )

    // Act
    const guided = guide(racer, [1, NO_LINK, NO_LINK, NO_LINK])

    // Assert
    expect(guided.flags & WARNING).toBe(0)
    expect(guided.wrongWayMilliseconds).toBe(0)
  })

  it('turns the warning into the wrong-way state when the countdown has run out', () => {
    // Arrange
    const racer = createGuidedRacer({ flags: WARNING, wrongWayMilliseconds: 0 })

    // Act
    const guided = guide(racer, [NO_LINK, NO_LINK, NO_LINK, NO_LINK])

    // Assert
    expect(guided.flags & (WARNING | WRONG_WAY)).toBe(WRONG_WAY)
  })

  it('counts the countdown down by the step and leaves the warning while time is left', () => {
    // Arrange
    const racer = createGuidedRacer({ flags: WARNING, wrongWayMilliseconds: 100 })

    // Act
    const guided = guide(racer, [NO_LINK, NO_LINK, NO_LINK, NO_LINK], 40)

    // Assert
    expect(guided.wrongWayMilliseconds).toBe(60)
    expect(guided.flags & (WARNING | WRONG_WAY)).toBe(WARNING)
  })

  it('drops the wrong-way flag when the countdown is not larger than the step', () => {
    // Arrange
    const racer = createGuidedRacer(
      { flags: WRONG_WAY, wrongWayMilliseconds: 16 },
      { x: 1, y: 0, z: 0 }
    )

    // Act
    const guided = guide(racer, [1, NO_LINK, NO_LINK, NO_LINK], 16)

    // Assert
    expect(guided.flags & WRONG_WAY).toBe(0)
    expect(guided.wrongWayMilliseconds).toBe(0)
  })

  it('restarts the countdown while the racer stays wrong, and clears both flags for a disabled racer', () => {
    // Arrange
    const wrong = createGuidedRacer({ flags: WRONG_WAY, wrongWayMilliseconds: 0 })
    const disabled = createGuidedRacer({
      flags: 0x10 | WARNING | WRONG_WAY,
      wrongWayMilliseconds: 9,
    })

    // Act
    const restarted = guide(wrong, [NO_LINK, NO_LINK, NO_LINK, NO_LINK])
    const cleared = guide(disabled, [1, NO_LINK, NO_LINK, NO_LINK])

    // Assert
    expect(restarted.wrongWayMilliseconds).toBe(500)
    expect(cleared.flags & (WARNING | WRONG_WAY)).toBe(0)
    expect(cleared.wrongWayMilliseconds).toBe(0)
  })

  it('does nothing about the wrong way without a checkpoint', () => {
    // Arrange
    const racer = createGuidedRacer({
      checkpointIndex: -1,
      flags: WARNING,
      wrongWayMilliseconds: 7,
    })

    // Act
    const guided = guide(racer, [1, NO_LINK, NO_LINK, NO_LINK])

    // Assert
    expect(guided.flags).toBe(WARNING)
    expect(guided.wrongWayMilliseconds).toBe(7)
  })
})

describe('updatePlayerGuidance, 0x00439ea0', () => {
  it('flags the side of a target that is not within 0.5 of the heading', () => {
    // Arrange
    const left = createGuidedRacer(
      { flags: GUIDED, guidanceTarget: { x: 1, y: 0, z: 0 } },
      { x: 0, y: 1, z: 0 }
    )
    const right = createGuidedRacer(
      { flags: GUIDED, guidanceTarget: { x: -1, y: 0, z: 0 } },
      { x: 0, y: 1, z: 0 }
    )

    // Act
    const guidedLeft = guide(left, [1, NO_LINK, NO_LINK, NO_LINK])
    const guidedRight = guide(right, [1, NO_LINK, NO_LINK, NO_LINK])

    // Assert
    expect(guidedLeft.flags & (TARGET_LEFT | TARGET_RIGHT)).toBe(TARGET_LEFT)
    expect(guidedRight.flags & (TARGET_LEFT | TARGET_RIGHT)).toBe(TARGET_RIGHT)
  })

  it('flags nothing for a target straight ahead, and clears the flags of an unguided racer', () => {
    // Arrange
    const ahead = createGuidedRacer({ flags: GUIDED, guidanceTarget: { x: 0, y: 5, z: 0 } })
    const unguided = createGuidedRacer({ flags: TARGET_LEFT | TARGET_RIGHT })

    // Act
    const guidedAhead = guide(ahead, [1, NO_LINK, NO_LINK, NO_LINK])
    const guidedUnguided = guide(unguided, [1, NO_LINK, NO_LINK, NO_LINK])

    // Assert
    expect(guidedAhead.flags & (TARGET_LEFT | TARGET_RIGHT)).toBe(0)
    expect(guidedUnguided.flags & (TARGET_LEFT | TARGET_RIGHT)).toBe(0)
  })
})
