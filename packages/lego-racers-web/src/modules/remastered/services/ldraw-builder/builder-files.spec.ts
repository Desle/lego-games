import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readBuilderProgress, readLibraryParts, saveBuilderModel } from './builder-files.ts'

describe('saveBuilderModel', () => {
  it('backs up the file it replaces, writes the model and marks the item done', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-builder-'))
    mkdirSync(join(root, 'chassis'))
    writeFileSync(join(root, 'chassis', 'RRchas0.ldr'), '0 old\n')
    const text = '0 new\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n'

    // Act
    const result = saveBuilderModel(
      root,
      { itemId: 'chassis/rrchas0', text },
      new Date('2026-10-13T08:00:00Z')
    )

    // Assert
    expect(result).toEqual({
      path: 'chassis/RRchas0.ldr',
      backupPath: 'drafts/backups/RRchas0-2026-10-13T08-00-00-000Z.ldr',
      progress: { done: ['chassis/rrchas0'] },
    })
    expect(readFileSync(join(root, 'chassis', 'RRchas0.ldr'), 'utf8')).toBe(text)
    expect(readdirSync(join(root, 'drafts', 'backups'))).toHaveLength(1)
    expect(readBuilderProgress(root).done).toEqual(['chassis/rrchas0'])
  })

  it('refuses an unknown item and a text that is not LDraw', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-builder-'))

    // Act
    const unknown = saveBuilderModel(root, { itemId: '../x', text: '0 x' }, new Date())
    const notLDraw = saveBuilderModel(root, { itemId: 'RRCM', text: '<html>' }, new Date())

    // Assert
    expect(typeof unknown).toBe('string')
    expect(typeof notLDraw).toBe('string')
  })
})

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
})
