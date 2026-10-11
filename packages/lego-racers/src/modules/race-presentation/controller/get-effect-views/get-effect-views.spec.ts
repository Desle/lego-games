import { createRace, loadRaceDefinition } from '../../../race/index.ts'
import {
  getIsOriginalExecutablePresent,
  getIsOriginalJamPresent,
  readOriginalExecutable,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getEffectViews } from './get-effect-views.ts'

const isPresent = getIsOriginalJamPresent() && getIsOriginalExecutablePresent()

describe('getEffectViews', () => {
  it.skipIf(!isPresent)('has nothing to draw before anything has been launched', () => {
    // Arrange
    const raceState = createRace(loadRaceDefinition(readOriginalJam(), readOriginalExecutable()))

    // Act
    const views = getEffectViews(raceState)

    // Assert
    expect(views.effects).toEqual([])
    expect(views.explosions).toEqual([])
  })
})
