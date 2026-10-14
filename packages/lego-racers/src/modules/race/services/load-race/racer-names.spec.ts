import { openJamArchive } from '../../../jam-archive/index.ts'
import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { getCircuitRacerCodes, readRacerDatabases } from './load-racers.ts'
import { getRacerNames } from './racer-names.ts'

describe('racer names', () => {
  it.skipIf(!getIsOriginalJamPresent())(
    'names a car built from bricks by its slot and a champion by its driver',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const racerCodes = getCircuitRacerCodes(archive.readFile, 'RACEC0R0')

      // Act
      const names = getRacerNames(archive.readFile, readRacerDatabases(archive.readFile), {
        racerCount: 6,
        localPlayerCount: 1,
        isPlayerChampionCar: false,
        racerCodes,
        playerNames: ['ALICE'],
      })

      // Assert
      expect(names[0]).toBe('ALICE')
      expect(names.slice(1).every((name) => name.length > 0)).toBe(true)
    }
  )
})
