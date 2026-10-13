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
import { saveLDrawModel } from './ldraw-model-save.ts'

const MODEL_TEXT = '0 new\n1 4 0 -24 0 1 0 0 0 1 0 0 0 1 3001.dat\n'
const NOW = new Date('2026-10-13T08:00:00Z')

describe('saveLDrawModel', () => {
  it('backs up the file it replaces and writes the model', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-model-save-'))
    mkdirSync(join(root, 'boats'))
    writeFileSync(join(root, 'boats', 'Ferry.ldr'), '0 old\n')

    // Act
    const result = saveLDrawModel(
      root,
      { path: 'boats/Ferry.ldr', text: MODEL_TEXT },
      'drafts/backups',
      NOW
    )

    // Assert
    expect(result).toEqual({
      path: 'boats/Ferry.ldr',
      backupPath: 'drafts/backups/Ferry-2026-10-13T08-00-00-000Z.ldr',
    })
    expect(readFileSync(join(root, 'boats', 'Ferry.ldr'), 'utf8')).toBe(MODEL_TEXT)
    expect(
      readFileSync(
        join(root, 'drafts', 'backups', readdirSync(join(root, 'drafts', 'backups'))[0] ?? ''),
        'utf8'
      )
    ).toBe('0 old\n')
  })

  it('makes a new file without a backup', () => {
    // Arrange
    const root = mkdtempSync(join(tmpdir(), 'ldraw-model-save-'))

    // Act
    const result = saveLDrawModel(root, { path: 'new/a.mpd', text: MODEL_TEXT }, 'backups', NOW)

    // Assert
    expect(result).toEqual({ path: 'new/a.mpd', backupPath: null })
    expect(existsSync(join(root, 'backups'))).toBe(false)
  })

  it('refuses paths outside the folder, files that are not models and text that is not LDraw', () => {
    // Arrange
    const parent = mkdtempSync(join(tmpdir(), 'ldraw-model-save-'))
    const root = join(parent, 'models')
    const saves = [
      { path: '../escape.ldr', text: MODEL_TEXT },
      { path: join(parent, 'absolute.ldr'), text: MODEL_TEXT },
      { path: 'notes.txt', text: MODEL_TEXT },
      { path: 'a.ldr', text: '<html>' },
    ]

    // Act
    const results = saves.map((save) => saveLDrawModel(root, save, 'backups', NOW))

    // Assert
    expect(results.every((result) => typeof result === 'string')).toBe(true)
    expect(readdirSync(parent)).toEqual([])
  })
})
