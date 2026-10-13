import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { readLibraryParts } from '@lego-games/ldraw-studio/files'
import { COMMON_PART_GROUPS } from './common-parts.ts'

const libraryRoot = process.env['LEGO_LDRAW_ROOT'] ?? join(homedir(), 'ldraw')

// The library is the player's own download, so this runs only where it is.
describe.skipIf(!existsSync(join(libraryRoot, 'parts')))('COMMON_PART_GROUPS', () =>
  it('names only parts the library lists (none moved, none obsolete)', () => {
    // Arrange
    const listed = new Set(
      readLibraryParts(libraryRoot).map((part) => part.name.replace(/\.dat$/i, '').toLowerCase())
    )

    // Act
    const unlisted = COMMON_PART_GROUPS.flatMap((group) =>
      group.partNames.filter((partName) => !listed.has(partName))
    )

    // Assert
    expect(unlisted).toEqual([])
  })
)
