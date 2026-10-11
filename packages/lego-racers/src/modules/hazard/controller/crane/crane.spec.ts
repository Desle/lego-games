import { getSkeletonInstanceWithTime } from '../../../world-animation/index.ts'
import {
  createTestSession,
  createTestSkeletonInstance,
  createTestWorld,
} from '../hazard-fixtures/hazard-fixtures.ts'
import { CRANE, CRANE_SIGNAL } from './crane.ts'

const createAt = (time: number) => {
  const test = createTestSession({
    track: createTestWorld([
      getSkeletonInstanceWithTime(createTestSkeletonInstance('crane'), time),
    ]),
  })
  const loaded = CRANE.create({ keyword: 0x32 }, { isMirrored: false, session: test.session })
  return { test, begun: CRANE.begin(loaded, test.session, null) }
}

describe('the crane', () => {
  it('announces its signal once when it is armed and the arm swings through a window', () => {
    // Arrange
    const { test, begun } = createAt(160)

    // Act
    const struck = CRANE.update(begun, test.session, 33)
    const again = CRANE.update(struck, test.session, 33)

    // Assert
    expect(test.calls).toEqual([`startStop ${String(CRANE_SIGNAL)} ${String(CRANE_SIGNAL)}`])
    expect(again.data).toEqual(struck.data)
    expect(struck.data).toMatchObject({ flags: 0 })
  })

  it('arms again in the arming windows', () => {
    // Arrange
    const struck = createAt(10)
    const afterStrike = CRANE.update(struck.begun, struck.test.session, 33)
    const arming = createTestSession({
      track: createTestWorld([
        getSkeletonInstanceWithTime(createTestSkeletonInstance('crane'), 100),
      ]),
    })

    // Act
    const armed = CRANE.update(afterStrike, arming.session, 33)

    // Assert
    expect(afterStrike.data).toMatchObject({ flags: 0 })
    expect(armed.data).toMatchObject({ flags: 2 })
  })

  it('stays quiet outside the windows', () => {
    // Arrange
    const { test, begun } = createAt(40)

    // Act
    const updated = CRANE.update(begun, test.session, 33)

    // Assert
    expect(test.calls).toEqual([])
    expect(updated.data).toMatchObject({ flags: 2 })
  })
})
