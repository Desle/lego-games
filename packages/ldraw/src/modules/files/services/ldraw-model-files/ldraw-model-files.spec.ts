import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readLDrawModelFiles, readLDrawModelFolders } from './ldraw-model-files.ts'

const createModelsFolder = (): string => {
  const root = mkdtempSync(join(tmpdir(), 'ldraw-model-files-'))
  mkdirSync(join(root, 'drafts', 'plates'), { recursive: true })
  for (const file of ['a.ldr', 'README.md', 'drafts/B.MPD', 'drafts/plates/c.ldr']) {
    writeFileSync(join(root, file), '')
  }
  return root
}

describe('readLDrawModelFiles', () => {
  it('lists model files of every subfolder and nothing else', () => {
    // Arrange
    const root = createModelsFolder()

    // Act
    const paths = readLDrawModelFiles(root).map((file) => file.path)

    // Assert
    expect(paths).toEqual(['a.ldr', 'drafts/B.MPD', 'drafts/plates/c.ldr'])
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

describe('readLDrawModelFolders', () => {
  it('groups the model files by folder, the root under the empty name', () => {
    // Arrange
    const root = createModelsFolder()

    // Act
    const folders = readLDrawModelFolders(root)

    // Assert
    expect(folders).toEqual({ '': ['a.ldr'], drafts: ['B.MPD'], 'drafts/plates': ['c.ldr'] })
  })
})
