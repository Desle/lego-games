import { createEmitterPool } from '../../../emitter/index.ts'
import type { Emitter } from '../../../emitter/index.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
  TEST_SKELETON,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { SMOKE_VENT } from './smoke-vent.ts'

const smoke: Emitter = {
  name: 'smoke',
  firstTruncatedValue: 100,
  secondTruncatedValue: 0,
  vector: [0, 0, 0],
  points: [[0, 0, 1]],
  firstFloat: 1,
  secondFloat: 1,
  thirdFloat: 0,
  fourthFloat: 0,
  fifthFloat: 1,
  entryIndex: null,
  firstInteger: 500,
  secondInteger: -1,
  thirdInteger: 1,
  linkedName: null,
}

const createActive = (isMirrored: boolean) => {
  const test = createTestSession({
    draws: [1],
    track: createTestWorld([
      createTestSkeletonInstance('dp_def', {
        skeleton: TEST_SKELETON,
        position: [100, 0, 0],
        scale: 2,
      }),
    ]),
    emitters: createEmitterPool({
      list: { emitters: [smoke], readByteCount: 0 },
      instanceCount: 1,
      animation: null,
    }),
  })
  const loaded = SMOKE_VENT.create({ keyword: 0x30 }, { isMirrored, session: test.session })
  return { test, active: SMOKE_VENT.begin(loaded, test.session, null) }
}

describe('the smoke vent', () => {
  it("starts the smoke at the place its draw picks, through bone 0 and the vent's frame (0x0048e7f0)", () => {
    // Arrange
    const { test, active } = createActive(false)

    // Act
    SMOKE_VENT.update(active, test.session, 33)

    // Assert
    const position = test.getEmitters()?.instances[0]?.position
    expect(position?.x).toBeCloseTo(100 + 2 * (-35.72 / 2 + 3), 3)
    expect(position?.y).toBeCloseTo(2 * (9.41 / 2 + 4), 3)
    expect(position?.z).toBeCloseTo(2 * (-18.41 / 2 + 5), 3)
  })

  it('mirrors the place across y in a mirrored race', () => {
    // Arrange
    const { test, active } = createActive(true)

    // Act
    SMOKE_VENT.update(active, test.session, 33)

    // Assert
    expect(test.getEmitters()?.instances[0]?.position.y).toBeCloseTo(2 * (-9.41 / 2 + 4), 3)
  })
})
