import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLDrawModelFolders } from '@lego-games/ldraw/files'
import { createLDrawModelIndex } from './ldraw-model-index.ts'

describe('createLDrawModelIndex', () => {
  it('lists cars by upper-case code and chassis recipes by lower-case name, drivers and power-up objects by upper-case name, leaving out notes', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-models-'))
    mkdirSync(join(root, 'chassis'))
    mkdirSync(join(root, 'drivers'))
    mkdirSync(join(root, 'powerups'))
    mkdirSync(join(root, 'drafts'))
    for (const file of ['rrcm.ldr', 'KKCM.mpd', 'KKCM.ldr', '_convention-test.ldr', 'README.md']) {
      writeFileSync(join(root, file), '')
    }
    writeFileSync(join(root, 'chassis', 'JTCHAS0.ldr'), '')
    writeFileSync(join(root, 'drivers', 'bvb.ldr'), '')
    writeFileSync(join(root, 'powerups', 'dmissile.ldr'), '')
    writeFileSync(join(root, 'powerups', '_test.ldr'), '')
    writeFileSync(join(root, 'drafts', 'RRCM.ldr'), '')

    // Act
    const index = createLDrawModelIndex(readLDrawModelFolders(root))

    // Assert
    expect(index).toEqual({
      cars: { RRCM: 'rrcm.ldr', KKCM: 'KKCM.ldr' },
      chassis: { jtchas0: 'chassis/JTCHAS0.ldr' },
      drivers: { BVB: 'drivers/bvb.ldr' },
      powerUps: { DMISSILE: 'powerups/dmissile.ldr' },
    })
  })

  it('is empty for a folder that does not exist', () => {
    // Arrange
    const root = join(tmpdir(), 'ldraw-models-missing-folder')

    // Act
    const index = createLDrawModelIndex(readLDrawModelFolders(root))

    // Assert
    expect(index).toEqual({ cars: {}, chassis: {}, drivers: {}, powerUps: {} })
  })
})
