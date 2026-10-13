import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { getFileUnder, getSafeRelativePath } from './ldraw-file-paths.ts'

describe('getSafeRelativePath', () => {
  it('keeps a path inside the root, with forward slashes', () => {
    // Arrange
    const requested = ['parts/3001.dat', './p\\stud.dat', 'drafts//a.ldr']

    // Act
    const paths = requested.map(getSafeRelativePath)

    // Assert
    expect(paths).toEqual(['parts/3001.dat', 'p/stud.dat', 'drafts/a.ldr'])
  })

  it('refuses absolute paths, parent folders and empty paths', () => {
    // Arrange
    const requested = [
      '/etc/passwd',
      '../secret.ldr',
      'a/../../b.ldr',
      'a/..',
      'C:\\x.ldr',
      '\\x.ldr',
      '',
      'a\0.ldr',
    ]

    // Act
    const paths = requested.map(getSafeRelativePath)

    // Assert
    expect(paths.every((path) => path === null)).toBe(true)
  })
})

describe('getFileUnder', () => {
  it('finds a file under the root and nothing outside it or that is a folder', () => {
    // Arrange
    const parent = mkdtempSync(join(tmpdir(), 'ldraw-file-paths-'))
    const root = join(parent, 'root')
    mkdirSync(join(root, 'parts'), { recursive: true })
    writeFileSync(join(root, 'parts', '3001.dat'), '0 Brick')
    writeFileSync(join(parent, 'outside.ldr'), '0 outside')

    // Act
    const found = getFileUnder(root, 'parts/3001.dat')
    const outside = getFileUnder(root, '../outside.ldr')
    const folder = getFileUnder(root, 'parts')

    // Assert
    expect(found).toBe(join(root, 'parts', '3001.dat'))
    expect(outside).toBeNull()
    expect(folder).toBeNull()
  })
})
