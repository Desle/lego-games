import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import type { Sky, SkyKeyframe } from '../../types/sky.types.ts'
import { SkyStateError } from '../../types/sky-errors/sky-errors.ts'
import { parseSky } from '../parse-sky/parse-sky.ts'
import { advanceSky, createSkyState, getSkyRingColors, switchSkySetting } from './sky-state.ts'

const getKeyframe = (integer: number, first: number, second: number, third: number): SkyKeyframe =>
  Object.freeze({
    integer,
    firstBytes: [first, first, first] as const,
    secondBytes: [second, second, second] as const,
    thirdBytes: [third, third, third] as const,
  })

const getSky = (selectedSettingName: string | null): Sky =>
  Object.freeze({
    settings: [
      { name: 'day', keyframes: [getKeyframe(1000, 10, 20, 30), getKeyframe(2000, 110, 120, 130)] },
      { name: 'night', keyframes: [getKeyframe(500, 1, 2, 3)] },
    ],
    selectedSettingName,
    float: null,
    readByteCount: 0,
  })

describe('createSkyState', () => {
  it('starts every setting at its first keyframe with the named setting current', () => {
    // Arrange
    const sky = getSky('night')

    // Act
    const state = createSkyState(sky)

    // Assert
    expect(state.currentSettingIndex).toBe(1)
    expect(state.progress).toEqual([
      { elapsedMilliseconds: 0, keyframeIndex: 0 },
      { elapsedMilliseconds: 0, keyframeIndex: 0 },
    ])
  })

  it('falls back to the first setting when the name is absent or unknown', () => {
    // Arrange
    const unknown = getSky('dusk')
    const absent = getSky(null)

    // Act
    const unknownState = createSkyState(unknown)
    const absentState = createSkyState(absent)

    // Assert
    expect(unknownState.currentSettingIndex).toBe(0)
    expect(absentState.currentSettingIndex).toBe(0)
  })

  it('refuses a sky without settings or with an empty setting', () => {
    // Arrange
    const empty: Sky = { settings: [], selectedSettingName: null, float: null, readByteCount: 0 }
    const hollow: Sky = {
      settings: [{ name: 'day', keyframes: [] }],
      selectedSettingName: null,
      float: null,
      readByteCount: 0,
    }

    // Act
    // Assert
    expect(() => createSkyState(empty)).toThrow(SkyStateError)
    expect(() => createSkyState(hollow)).toThrow(SkyStateError)
  })
})

describe('getSkyRingColors', () => {
  it('returns the keyframe bytes +0x0c, +0x08, +0x04 of a one-keyframe setting', () => {
    // Arrange
    const state = createSkyState(getSky('night'))

    // Act
    const colors = getSkyRingColors(state)

    // Assert
    expect(colors).toEqual([
      [3, 3, 3],
      [2, 2, 2],
      [1, 1, 1],
    ])
  })

  it('blends towards the next keyframe by the time spent in the current one, truncating', () => {
    // Arrange
    const state = advanceSky(createSkyState(getSky('day')), 250)

    // Act
    const colors = getSkyRingColors(state)

    // Assert
    // 30 + (130 - 30) / 4 = 55, 20 + (120 - 20) / 4 = 45, 10 + (110 - 10) / 4 = 35
    expect(colors).toEqual([
      [55, 55, 55],
      [45, 45, 45],
      [35, 35, 35],
    ])
  })

  it('blends from the previous setting while a transition runs', () => {
    // Arrange
    const night = switchSkySetting(createSkyState(getSky('day')), 'night', 1000)
    const state = advanceSky(night, 500)

    // Act
    const colors = getSkyRingColors(state)

    // Assert
    // The day setting has moved on by 500 ms too: ring 0 is 30 + 100 / 2 = 80, then half way to night's 3.
    expect(colors[0]).toEqual([41, 41, 41])
  })
})

describe('advanceSky', () => {
  it('moves to the next keyframe once the elapsed time passes its duration and drops the overshoot', () => {
    // Arrange
    const state = createSkyState(getSky('day'))

    // Act
    const atDuration = advanceSky(state, 1000)
    const pastDuration = advanceSky(state, 1001)

    // Assert
    expect(atDuration.progress[0]).toEqual({ elapsedMilliseconds: 1000, keyframeIndex: 0 })
    expect(pastDuration.progress[0]).toEqual({ elapsedMilliseconds: 0, keyframeIndex: 1 })
  })

  it('wraps from the last keyframe to the first', () => {
    // Arrange
    const state = advanceSky(createSkyState(getSky('day')), 1001)

    // Act
    const wrapped = advanceSky(state, 2001)

    // Assert
    expect(wrapped.progress[0]).toEqual({ elapsedMilliseconds: 0, keyframeIndex: 0 })
  })

  it('ends a transition once its elapsed time passes its duration', () => {
    // Arrange
    const state = switchSkySetting(createSkyState(getSky('day')), 'night', 100)

    // Act
    const during = advanceSky(state, 100)
    const after = advanceSky(state, 101)

    // Assert
    expect(during.blendDurationMilliseconds).toBe(100)
    expect(after.blendDurationMilliseconds).toBe(0)
    expect(after.blendElapsedMilliseconds).toBe(0)
  })
})

describe('switchSkySetting', () => {
  it('remembers the replaced setting and starts a transition', () => {
    // Arrange
    const state = createSkyState(getSky('day'))

    // Act
    const switched = switchSkySetting(state, 'night', 750)

    // Assert
    expect(switched.currentSettingIndex).toBe(1)
    expect(switched.previousSettingIndex).toBe(0)
    expect(switched.blendDurationMilliseconds).toBe(750)
    expect(switched.blendElapsedMilliseconds).toBe(0)
  })

  it('ignores an unknown name and keeps a running transition when the setting does not change', () => {
    // Arrange
    const state = switchSkySetting(createSkyState(getSky('day')), 'night', 750)

    // Act
    const unknown = switchSkySetting(state, 'dusk', 10)
    const same = switchSkySetting(advanceSky(state, 100), 'night', 10)

    // Assert
    expect(unknown).toBe(state)
    expect(same.blendDurationMilliseconds).toBe(750)
    expect(same.blendElapsedMilliseconds).toBe(100)
  })
})

describe('the original skies', () => {
  it.skipIf(!getIsOriginalJamPresent())(
    'start from a valid state and give three colours for every .SKB',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths().filter((path) => path.endsWith('.SKB'))

      // Act
      const results = paths.map((path) =>
        getSkyRingColors(createSkyState(parseSky(archive.readFile(path))))
      )

      // Assert
      expect(results).toHaveLength(14)
      for (const colors of results) expect(colors).toHaveLength(3)
    }
  )
})
