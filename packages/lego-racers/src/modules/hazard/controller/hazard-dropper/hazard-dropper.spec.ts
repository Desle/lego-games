import { getFloatFromBits } from '../../../simulation-math/index.ts'
import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { HAZARD_DROPPER, HAZARD_DROPPER_IDENTIFIER } from './hazard-dropper.ts'

describe('the hazard dropper', () => {
  it('drops the hazard at the place a draw picks and becomes active', () => {
    // Arrange
    const test = createTestSession({ draws: [4] })
    const loaded = HAZARD_DROPPER.create(
      { keyword: 0x3f },
      { isMirrored: false, session: test.session }
    )

    // Act
    const begun = HAZARD_DROPPER.begin(loaded, test.session, null)

    // Assert
    expect(loaded.identifier).toBe(HAZARD_DROPPER_IDENTIFIER)
    expect(begun.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(test.getDrawCount()).toBe(1)
    expect(test.effects).toEqual([
      {
        type: 'hazard.power_up_activated',
        keyword: 0x3f,
        activation: 'hazard',
        effectKind: 3,
        racerIndex: null,
        launcher: {
          position: [
            getFloatFromBits(0xc3af9a00),
            getFloatFromBits(0x4401ada2),
            getFloatFromBits(0xc2bc6e6e),
          ],
          direction: [1, 0, 0],
        },
      },
    ])
  })

  it("negates the place's y on a mirrored track", () => {
    // Arrange
    const test = createTestSession({ draws: [0] })
    const loaded = HAZARD_DROPPER.create(
      { keyword: 0x3f },
      { isMirrored: true, session: test.session }
    )

    // Act
    HAZARD_DROPPER.begin(loaded, test.session, null)

    // Assert
    expect(test.effects[0]).toMatchObject({
      launcher: {
        position: [expect.any(Number), -getFloatFromBits(0x43e51041), expect.any(Number)],
      },
    })
  })

  it('goes idle when it ends', () => {
    // Arrange
    const test = createTestSession()
    const loaded = HAZARD_DROPPER.create(
      { keyword: 0x3f },
      { isMirrored: false, session: test.session }
    )
    const begun = HAZARD_DROPPER.begin(loaded, test.session, null)

    // Act
    const ended = HAZARD_DROPPER.end(begun, test.session, null)

    // Assert
    expect(ended.lifecycle).toBe(HazardLifecycle.IDLE)
  })
})
