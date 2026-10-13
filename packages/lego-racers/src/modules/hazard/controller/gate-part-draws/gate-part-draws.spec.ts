import { createFloatArithmetic, RACE_FPU_PRECISION } from '../../../simulation-math/index.ts'
import { advanceWorldAnimation } from '../../../world-animation/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import type { HazardInstance } from '../../types/hazard-runtime.types.ts'
import { GATE } from '../gate/gate.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { getGatePartDraws } from './gate-part-draws.ts'

const arithmetic = createFloatArithmetic(RACE_FPU_PRECISION)
const FIRST_PART_DISTANCES = [100, 200, 300]

// Two parts playing the test clip (300 frames at half a frame per millisecond: it finishes after 598 ms).
const createGate = () => {
  const test = createTestSession({
    track: createTestWorld([
      createTestSkeletonInstance('left', { levelSquaredDistances: FIRST_PART_DISTANCES }),
      createTestSkeletonInstance('right', { levelSquaredDistances: [1, 2, 3] }),
    ]),
  })
  const loaded = GATE.create(
    { keyword: 0x34, integer: 7, objectName: 'shootme', names: ['left', 'right'] },
    { isMirrored: false, session: test.session }
  )
  const getDraws = (gate: HazardInstance) =>
    getGatePartDraws(
      arithmetic,
      { instances: [gate] },
      { track: test.getWorld('track'), blended: test.getWorld('blended') }
    )
  const advance = (gate: HazardInstance, milliseconds: number) => {
    test.session.setWorld('track', advanceWorldAnimation(test.getWorld('track'), milliseconds))
    return GATE.update(gate, test.session, milliseconds)
  }
  return { test, loaded, getDraws, advance }
}

describe('getGatePartDraws', () => {
  it('draws nothing of a gate that has not opened (the world draws its parts)', () => {
    // Arrange
    const { loaded, getDraws } = createGate()

    // Act
    const draws = getDraws(loaded)

    // Assert
    expect(draws).toEqual([])
  })

  it('draws every part of an opening gate opaque, with the first part’s distances as it loaded', () => {
    // Arrange
    const { test, loaded, getDraws } = createGate()

    // Act
    const draws = getDraws(GATE.begin(loaded, test.session, null))

    // Assert: the world's own drawing sees distances of 0, the gate's draw lends the saved ones
    expect(draws).toEqual([
      {
        world: 'track',
        instanceName: 'left',
        levelSquaredDistances: FIRST_PART_DISTANCES,
        alpha: 255,
      },
      {
        world: 'track',
        instanceName: 'right',
        levelSquaredDistances: FIRST_PART_DISTANCES,
        alpha: 255,
      },
    ])
    expect(
      test.getWorld('track').skeletonInstances.map((part) => part.levelSquaredDistances)
    ).toEqual([
      [0, 0, 0],
      [0, 0, 0],
    ])
  })

  it('fades the pieces out as their clip plays: ftol((frames - time) / frames * 255)', () => {
    // Arrange
    const { test, loaded, getDraws, advance } = createGate()
    const begun = GATE.begin(loaded, test.session, null)

    // Act: 300 ms is 150 of the 300 frames
    const halfway = advance(begun, 300)

    // Assert
    expect(halfway.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(getDraws(halfway).map((draw) => draw.alpha)).toEqual([127, 127])
  })

  it('stops drawing the pieces once their clips have played to the end', () => {
    // Arrange
    const { test, loaded, getDraws, advance } = createGate()
    const begun = GATE.begin(loaded, test.session, null)

    // Act
    const finished = advance(advance(begun, 300), 300)

    // Assert
    expect(finished.lifecycle).toBe(HazardLifecycle.IDLE)
    expect(getDraws(finished)).toEqual([])
  })
})
