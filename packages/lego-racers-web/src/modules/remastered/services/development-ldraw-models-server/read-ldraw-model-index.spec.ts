import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLDrawModelIndex } from './read-ldraw-model-index.ts'

describe('readLDrawModelIndex', () => {
  it('lists cars by upper-case code and chassis recipes by lower-case name, leaving out notes', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-models-'))
    mkdirSync(join(root, 'chassis'))
    for (const file of ['rrcm.ldr', 'KKCM.mpd', 'KKCM.ldr', '_convention-test.ldr', 'README.md']) {
      writeFileSync(join(root, file), '')
    }
    writeFileSync(join(root, 'chassis', 'JTCHAS0.ldr'), '')

    // Act
    const index = readLDrawModelIndex(root)

    // Assert
    expect(index).toEqual({
      cars: { RRCM: 'rrcm.ldr', KKCM: 'KKCM.ldr' },
      chassis: { jtchas0: 'chassis/JTCHAS0.ldr' },
    })
  })

  it('is empty for a folder that does not exist', () => {
    // Arrange
    const root = join(tmpdir(), 'ldraw-models-missing-folder')

    // Act
    const index = readLDrawModelIndex(root)

    // Assert
    expect(index).toEqual({ cars: {}, chassis: {} })
  })
})
