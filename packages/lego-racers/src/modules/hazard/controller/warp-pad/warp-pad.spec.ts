import { getFloatFromBits } from '../../../simulation-math/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import { createTestRacer, createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { WARP_PAD } from './warp-pad.ts'

const create = (isMirrored: boolean) => {
  const test = createTestSession()
  return { test, loaded: WARP_PAD.create({ keyword: 0x49 }, { isMirrored, session: test.session }) }
}

describe('the warp pad', () => {
  it('warps a racer that touches it to the destination and stays busy', () => {
    // Arrange
    const { test, loaded } = create(false)

    // Act
    const begun = WARP_PAD.begin(loaded, test.session, createTestRacer(3))

    // Assert
    expect(begun.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(test.effects).toEqual([
      {
        type: 'hazard.power_up_activated',
        keyword: 0x49,
        activation: 'warp',
        effectKind: 3,
        racerIndex: 3,
        launcher: {
          position: [
            getFloatFromBits(0x4304ac4a),
            getFloatFromBits(0x42ac9ba6),
            getFloatFromBits(0x416b8d50),
          ],
          direction: [1, -0.5, 0],
          target: null,
          speed: null,
        },
      },
    ])
  })

  it('negates the y of the destination and of the facing on a mirrored track', () => {
    // Arrange
    const { test, loaded } = create(true)

    // Act
    WARP_PAD.begin(loaded, test.session, createTestRacer(0))

    // Assert
    expect(test.effects[0]).toMatchObject({
      launcher: {
        position: [expect.any(Number), -getFloatFromBits(0x42ac9ba6), expect.any(Number)],
        direction: [1, 0.5, 0],
      },
    })
  })

  it('ignores a racer that is already warping, a busy pad and a begin without a racer', () => {
    // Arrange
    const { test, loaded } = create(false)

    // Act
    const warping = WARP_PAD.begin(loaded, test.session, createTestRacer(0, 0x10))
    const nobody = WARP_PAD.begin(loaded, test.session, null)
    const busy = WARP_PAD.begin(
      WARP_PAD.begin(loaded, test.session, createTestRacer(1)),
      test.session,
      createTestRacer(2)
    )

    // Assert
    expect(warping).toBe(loaded)
    expect(nobody).toBe(loaded)
    expect(busy.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(test.effects).toHaveLength(1)
  })

  it('goes idle only when a racer releases it', () => {
    // Arrange
    const { test, loaded } = create(false)
    const begun = WARP_PAD.begin(loaded, test.session, createTestRacer(0))

    // Act
    const unattended = WARP_PAD.end(begun, test.session, null)
    const released = WARP_PAD.end(begun, test.session, createTestRacer(0))

    // Assert
    expect(unattended.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(released.lifecycle).toBe(HazardLifecycle.IDLE)
  })
})
