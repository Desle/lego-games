import { BRICK_LEVEL_DISTANCE } from '@lego-games/lego-racers/race-presentation'
import { getIsWithinLevelDistance } from './level-distance.ts'

const EYE = { x: 0, y: 0, z: 0 }

describe('getIsWithinLevelDistance', () => {
  it.each([
    ['at 500 units', { x: 500, y: 0, z: 0 }, true],
    ['beyond 500 units', { x: 300, y: 400.1, z: 0 }, false],
    ['without a centre', null, true],
  ])('keeps a figure %s as the engine does', (_name, centre, isExpected) => {
    // Arrange / Act
    const isWithin = getIsWithinLevelDistance(centre, EYE)

    // Assert
    expect(isWithin).toBe(isExpected)
  })

  it('cuts a brick beyond 400 units', () => {
    // Arrange / Act
    const isNear = getIsWithinLevelDistance({ x: 399, y: 0, z: 0 }, EYE, BRICK_LEVEL_DISTANCE)
    const isFar = getIsWithinLevelDistance({ x: 401, y: 0, z: 0 }, EYE, BRICK_LEVEL_DISTANCE)

    // Assert
    expect([isNear, isFar]).toEqual([true, false])
  })
})
