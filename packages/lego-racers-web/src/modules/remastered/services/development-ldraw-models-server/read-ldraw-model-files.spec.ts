import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLDrawModelFiles } from './read-ldraw-model-files.ts'

describe('readLDrawModelFiles', () => {
  it('lists model files of every subfolder and nothing else', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-model-files-'))
    mkdirSync(join(root, 'drafts', 'chassis-plates'), { recursive: true })
    for (const file of ['a.ldr', 'README.md', 'drafts/B.MPD', 'drafts/chassis-plates/c.ldr']) {
      writeFileSync(join(root, file), '')
    }

    // Act
    const paths = readLDrawModelFiles(root).map((file) => file.path)

    // Assert
    expect(paths).toEqual(['a.ldr', 'drafts/B.MPD', 'drafts/chassis-plates/c.ldr'])
  })

  it('is empty for a folder that does not exist', () => {
    // Arrange
    const root = join(tmpdir(), 'ldraw-model-files-missing-folder')

    // Act
    const files = readLDrawModelFiles(root)

    // Assert
    expect(files).toEqual([])
  })
})
