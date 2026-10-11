import { HazardLifecycle } from '../../types/hazard-lifecycle/hazard-lifecycle.ts'
import { createTestSession } from '../hazard-fixtures/hazard-fixtures.ts'
import { CODE_LOCK } from './code-lock.ts'

// Draws with a clear low bit give the pairs in their first order: code 0xc9, 0xcb, 0xcd and decoys 200, 0xca, 0xcc.
const createLoaded = (draws: readonly number[]) => {
  const test = createTestSession({ draws })
  const loaded = CODE_LOCK.create({ keyword: 0x2d }, { isMirrored: false, session: test.session })
  return { test, loaded }
}

describe('the code lock', () => {
  it("draws the code when it loads: each pair's order comes from the low bit of a draw", () => {
    // Arrange
    // Act
    const { test, loaded } = createLoaded([0, 1, 0])

    // Assert
    expect(test.getDrawCount()).toBe(3)
    expect(loaded.lifecycle).toBe(HazardLifecycle.ACTIVE)
    expect(loaded.data).toMatchObject({ code: [0xc9, 0xca, 0xcd], decoys: [200, 0xcb, 0xcc] })
  })

  it('opens when the code buttons are pressed in order, drawing a new code', () => {
    // Arrange
    const { test, loaded } = createLoaded([0, 0, 0, 0, 0, 0])

    // Act
    const first = CODE_LOCK.onSignalStarted(loaded, test.session, 0xc9, null)
    const second = CODE_LOCK.onSignalStarted(first, test.session, 0xcb, null)
    const third = CODE_LOCK.onSignalStarted(second, test.session, 0xcd, null)

    // Assert
    expect(second.data).toMatchObject({ progress: 3 })
    expect(third.data).toMatchObject({ progress: 0, openMilliseconds: 2500 })
    expect(test.calls).toContain('startStop 18 18')
    expect(test.calls).toContain('start 28')
    expect(test.getDrawCount()).toBe(6)
  })

  it('starts again after a decoy', () => {
    // Arrange
    const { test, loaded } = createLoaded([0, 0, 0])
    const first = CODE_LOCK.onSignalStarted(loaded, test.session, 0xc9, null)

    // Act
    const spoiled = CODE_LOCK.onSignalStarted(first, test.session, 200, null)
    const second = CODE_LOCK.onSignalStarted(spoiled, test.session, 0xcb, null)

    // Assert
    expect(first.data).toMatchObject({ progress: 1 })
    expect(spoiled.data).toMatchObject({ progress: 0 })
    expect(second.data).toMatchObject({ progress: 0 })
  })

  it('announces the odd or even signal of the button and the right or wrong one of the code buttons', () => {
    // Arrange
    const { test, loaded } = createLoaded([0, 0, 0])

    // Act
    CODE_LOCK.onSignalStarted(loaded, test.session, 200, null)
    CODE_LOCK.onSignalStarted(loaded, test.session, 0xc9, null)
    CODE_LOCK.onSignalStarted(loaded, test.session, 0xcf, null)

    // Assert
    expect(test.calls.filter((call) => call.startsWith('startStop'))).toEqual([
      'startStop 21 21',
      'startStop 30 30',
      'startStop 20 20',
    ])
  })

  it('closes after its open time: the signal stops once', () => {
    // Arrange
    const { test, loaded } = createLoaded([0, 0, 0])

    // Act
    const closed = CODE_LOCK.update(loaded, test.session, 33)
    const again = CODE_LOCK.update(closed, test.session, 33)

    // Assert
    expect(test.calls).toEqual(['stop 28'])
    expect(closed.data).toMatchObject({ openMilliseconds: 0 })
    expect(again).toBe(closed)
  })
})
