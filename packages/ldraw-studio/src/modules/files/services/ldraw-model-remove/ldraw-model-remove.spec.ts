import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { removeLDrawModel } from './ldraw-model-remove.ts'

const NOW = new Date('2026-10-14T08:00:00Z')

describe('removeLDrawModel', () => {
  it('moves the model into the backup folder instead of deleting it', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-model-remove-'))
    mkdirSync(join(root, 'boats'))
    writeFileSync(join(root, 'boats', 'Ferry.ldr'), '0 ferry\n')

    // Act
    const result = removeLDrawModel(root, 'boats/Ferry.ldr', 'drafts/backups', NOW)

    // Assert
    expect(result).toEqual({
      path: 'boats/Ferry.ldr',
      backupPath: 'drafts/backups/Ferry-2026-10-14T08-00-00-000Z.ldr',
    })
    expect(existsSync(join(root, 'boats', 'Ferry.ldr'))).toBe(false)
    expect(
      readFileSync(join(root, 'drafts', 'backups', 'Ferry-2026-10-14T08-00-00-000Z.ldr'), 'utf8')
    ).toBe('0 ferry\n')
  })

  it('refuses paths outside the folder, files that are not .ldr and missing files', () => {
    // Arrange
    const parent = mkdtempSync(join(tmpdir(), 'ldraw-model-remove-'))
    const root = join(parent, 'models')
    mkdirSync(root)
    writeFileSync(join(parent, 'secret.ldr'), '0 secret\n')
    writeFileSync(join(root, 'tug.mpd'), '0 tug\n')
    writeFileSync(join(root, 'notes.txt'), 'notes')
    const requests = [
      '../secret.ldr',
      join(parent, 'secret.ldr'),
      'tug.mpd',
      'notes.txt',
      'none.ldr',
    ]

    // Act
    const results = requests.map((request) => removeLDrawModel(root, request, 'backups', NOW))

    // Assert
    expect(results.every((result) => typeof result === 'string')).toBe(true)
    expect(readdirSync(parent).sort()).toEqual(['models', 'secret.ldr'])
    expect(readdirSync(root).sort()).toEqual(['notes.txt', 'tug.mpd'])
  })
})
