import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLibraryParts } from './ldraw-library-parts.ts'

describe('readLibraryParts', () => {
  it('lists parts by description and leaves out moved and sub parts', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-library-'))
    mkdirSync(join(root, 'parts'))
    writeFileSync(join(root, 'parts', '3001.dat'), '0 Brick  2 x  4\n')
    writeFileSync(join(root, 'parts', '3023.dat'), '0 ~Moved to 3023b\n')

    // Act
    const parts = readLibraryParts(root)

    // Assert
    expect(parts).toEqual([{ name: '3001.dat', description: 'Brick  2 x  4' }])
  })

  it('gives a renumbered part its old number, so a search for it finds the part', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-library-'))
    mkdirSync(join(root, 'parts'))
    writeFileSync(join(root, 'parts', '6141.dat'), '0 Plate  1 x  1 Round\n')
    writeFileSync(join(root, 'parts', '4073.dat'), '0 ~Moved to 6141\n')

    // Act
    const parts = readLibraryParts(root)

    // Assert
    expect(parts).toEqual([{ name: '6141.dat', description: 'Plate  1 x  1 Round (was 4073)' }])
  })

  it('is empty for a library without a parts folder', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-library-'))

    // Act
    const parts = readLibraryParts(root)

    // Assert
    expect(parts).toEqual([])
  })
})
