import { createRandomTable } from '../../../random-table/index.ts'
import { getShownClipIndex } from '../../../skeletal-animation/index.ts'
import type { SkeletalAnimation } from '../../../skeletal-animation/index.ts'
import type { SavedCar } from '../../../car-builder/index.ts'
import type { RacerShowcaseAnimation } from '../../types/racer-showcase/racer-showcase.types.ts'
import { createRacerShowcase, getRacerShowcaseView, stepRacerShowcase } from './racer-showcase.ts'

const FRAME_COUNT = 10
const getClip = () => ({
  name: 'clip',
  framesPerMillisecond: 0.03,
  velocity: [0, 0, 0] as const,
  firstTrackIndex: 0,
  frameCount: FRAME_COUNT,
  loopLength: FRAME_COUNT + 1,
})
const ANIMATION: SkeletalAnimation = {
  positions: [],
  rotations: [],
  times: [],
  tracks: [],
  clips: [getClip(), getClip(), getClip()],
}
// Three idle clips, clip 0 to 2 (the table's values mod 3 choose among them).
const SHOWCASE_ANIMATION: RacerShowcaseAnimation = {
  animation: ANIMATION,
  idleClipIndices: [0, 1, 2],
}
const CAR: SavedCar = {
  record: {
    name: 'TEST',
    colorBytes: [0, 0, 0, 0, 0],
    chassisName: 'chassis',
    designBytes: [],
    circuitRanks: 0,
  },
  design: null,
}
// Position 0 draws entry 1: 4 mod 3 = 1; the next draw entry 2: 5 mod 3 = 2, then 3 mod 3 = 0 and 6 mod 3 = 0.
const TABLE = createRandomTable([0, 4, 5, 3, 6, ...Array.from({ length: 1019 }, () => 1)])
const LAST_FRAME_MILLISECONDS = 400

describe('racer showcase', () => {
  it('starts a random idle clip at the first frame with the turntable running', () => {
    // Arrange / Act
    const { showcase, randomPosition } = createRacerShowcase(
      0,
      CAR,
      SHOWCASE_ANIMATION,
      TABLE,
      0,
      33
    )

    // Assert
    expect(getShownClipIndex(showcase.driverAnimation)).toBe(1)
    expect(showcase.driverAnimation.clip.timeInFrames).toBe(0)
    expect(showcase.turntableMilliseconds).toBe(33)
    expect(randomPosition).toBe(1)
  })

  it('draws another clip when the clip has ended, never the one just played', () => {
    // Arrange
    const first = createRacerShowcase(0, CAR, SHOWCASE_ANIMATION, TABLE, 0, 0)
    const ended = stepRacerShowcase(
      first.showcase,
      SHOWCASE_ANIMATION,
      TABLE,
      first.randomPosition,
      LAST_FRAME_MILLISECONDS
    )

    // Act
    const next = stepRacerShowcase(
      ended.showcase,
      SHOWCASE_ANIMATION,
      TABLE,
      ended.randomPosition,
      33
    )

    // Assert
    expect(getShownClipIndex(next.showcase.driverAnimation)).toBe(2)
    expect(next.randomPosition).toBe(2)
    expect(next.showcase.turntableMilliseconds).toBe(LAST_FRAME_MILLISECONDS + 33)
  })

  it("shows the racer's car and driver where the original puts them", () => {
    // Arrange
    const { showcase } = createRacerShowcase(0, CAR, SHOWCASE_ANIMATION, TABLE, 0, 0)

    // Act
    const view = getRacerShowcaseView(showcase)

    // Assert
    expect(view?.chassisName).toBe('chassis')
    expect(view?.driver.animationName).toBe('RSANIM')
    expect(view?.driver.position).toEqual([-0.9375, -0.8981, 1.4867])
    expect(getRacerShowcaseView(null)).toBeNull()
  })
})
