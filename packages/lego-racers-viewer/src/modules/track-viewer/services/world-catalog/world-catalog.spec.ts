import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '@lego-games/lego-racers/jam-archive'
import { getWorldGroups } from './world-catalog.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)
const isOriginalPresent = existsSync(ORIGINAL_JAM_PATH)

describe.runIf(isOriginalPresent)('getWorldGroups on the original LEGO.JAM', () => {
  const readArchive = () => openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))

  it('starts every race directory with the whole race in the game order', () => {
    // Arrange
    const archive = readArchive()

    // Act
    const groups = getWorldGroups(archive)

    // Assert
    const firstRace = groups.find((group) => group.directory === 'GAMEDATA\\RACEC0R0')
    expect(firstRace?.entries[0]?.worldPaths).toEqual([
      'GAMEDATA\\COMMON\\GLOBAL.WDB',
      'GAMEDATA\\RACEC0R0\\RRTRK.WDB',
      'GAMEDATA\\RACEC0R0\\COLLIDE.WDB',
      'GAMEDATA\\RACEC0R0\\BLENDED.WDB',
      'GAMEDATA\\RACEC0R0\\LOCAL.WDB',
    ])
    expect(firstRace?.entries[1]?.label).toBe('RRTRK.WDB (after 1 race world)')
    expect(groups.filter((group) => group.entries[0]?.label === 'Whole race')).toHaveLength(14)
    expect(groups.find((group) => group.directory === 'MENUDATA\\GARAGE')?.entries).toEqual([
      {
        id: 'MENUDATA\\GARAGE\\GARAGE.WDB',
        label: 'GARAGE.WDB',
        worldPaths: ['MENUDATA\\GARAGE\\GARAGE.WDB'],
      },
    ])
  })
})
