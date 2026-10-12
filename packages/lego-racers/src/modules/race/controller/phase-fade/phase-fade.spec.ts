import { createFixtureRace } from '../race-fixtures/race-fixtures.ts'
import { createScreenFader, getIsScreenFaderActive } from '../../types/screen-fader/screen-fader.ts'
import type { RaceState } from '../../types/race.types.ts'
import { getRaceWithFinishFade, getRaceWithResultsFade } from './phase-fade.ts'

const getRaceWithoutFades = (phaseMilliseconds: number): RaceState =>
  Object.freeze({
    ...createFixtureRace(),
    phaseMilliseconds,
    screenFader: createScreenFader(),
  })

describe('phase fades', () => {
  it('fades to black over 1,000 ms once the finishing state passes 9,000 ms (0x00434ee8)', () => {
    // Arrange
    const early = getRaceWithoutFades(9000)
    const late = getRaceWithoutFades(9001)

    // Act
    const beforeFade = getRaceWithFinishFade(early)
    const afterFade = getRaceWithFinishFade(late)

    // Assert
    expect(getIsScreenFaderActive(beforeFade.screenFader)).toBe(false)
    expect(afterFade.screenFader[0]).toMatchObject({
      isActive: true,
      isFadingOut: false,
      totalMilliseconds: 1000,
    })
  })

  it('starts no second fade while one runs (0x00494f30)', () => {
    // Arrange
    const running = Object.freeze({ ...createFixtureRace(), phaseMilliseconds: 9500 })

    // Act
    const result = getRaceWithFinishFade(running)

    // Assert
    expect(result.screenFader).toBe(running.screenFader)
  })

  it('fades the results to black over 1,000 ms after 4,000 ms (0x004351ab)', () => {
    // Arrange
    const early = getRaceWithoutFades(4000)
    const late = getRaceWithoutFades(4001)

    // Act
    const beforeFade = getRaceWithResultsFade(early)
    const afterFade = getRaceWithResultsFade(late)

    // Assert
    expect(getIsScreenFaderActive(beforeFade.screenFader)).toBe(false)
    expect(afterFade.screenFader[0]).toMatchObject({ isActive: true, totalMilliseconds: 1000 })
  })
})
