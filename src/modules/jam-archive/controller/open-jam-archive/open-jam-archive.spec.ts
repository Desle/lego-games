import { existsSync, readFileSync } from 'node:fs'
import {
  JamArchiveReadError,
  JamLookupError,
} from '../../types/jam-archive-errors/jam-archive-errors.ts'
import { JamLookupFailure } from '../../types/jam-lookup-failure/jam-lookup-failure.ts'
import { openJamArchive } from './open-jam-archive.ts'

const ORIGINAL_JAM_PATH = 'original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'

const writeName = (view: DataView, offset: number, name: string) => {
  for (let index = 0; index < name.length; index++) {
    view.setUint8(offset + index, name.charCodeAt(index))
  }
}

// Layout: LJAM | root { 0 files, 1 directory "GAMEDATA" } | GAMEDATA { 1 file "GO.PCM" } | contents
const createTestArchive = (): Uint8Array => {
  const bytes = new Uint8Array(68)
  const view = new DataView(bytes.buffer)
  writeName(view, 0, 'LJAM')
  view.setUint32(4, 0, true)
  view.setUint32(8, 1, true)
  writeName(view, 12, 'GAMEDATA')
  view.setUint32(24, 28, true)
  view.setUint32(28, 1, true)
  writeName(view, 32, 'GO.PCM')
  view.setUint32(44, 56, true)
  view.setUint32(48, 4, true)
  view.setUint32(52, 0, true)
  view.setUint32(56, 0xdeadbeef, true)
  return bytes
}

describe('openJamArchive', () => {
  it('rejects data without the LJAM signature', () => {
    // Arrange
    const bytes = new Uint8Array([0x4c, 0x4a, 0x41, 0x58, 0, 0, 0, 0])

    // Act
    const open = () => openJamArchive(bytes)

    // Assert
    expect(open).toThrow(JamArchiveReadError)
  })

  it('finds a file through a backslash-separated path', () => {
    // Arrange
    const archive = openJamArchive(createTestArchive())

    // Act
    const location = archive.findFile('GAMEDATA\\GO.PCM')

    // Assert
    expect(location).toEqual({ offset: 56, size: 4 })
  })

  it('reads the bytes of a file', () => {
    // Arrange
    const archive = openJamArchive(createTestArchive())

    // Act
    const contents = archive.readFile('GAMEDATA\\GO.PCM')

    // Assert
    expect([...contents]).toEqual([0xef, 0xbe, 0xad, 0xde])
  })

  it('matches names case-sensitively, as strncmp does', () => {
    // Arrange
    const archive = openJamArchive(createTestArchive())

    // Act
    const find = () => archive.findFile('gamedata\\GO.PCM')

    // Assert
    expect(find).toThrow(new JamLookupError(JamLookupFailure.NOT_FOUND, 'gamedata\\GO.PCM'))
  })

  it('rejects a path segment longer than twelve characters', () => {
    // Arrange
    const archive = openJamArchive(createTestArchive())

    // Act
    const find = () => archive.findFile('GAMEDATA\\THIRTEENCHARS')

    // Assert
    expect(find).toThrow(
      new JamLookupError(JamLookupFailure.NAME_TOO_LONG, 'GAMEDATA\\THIRTEENCHARS')
    )
  })

  it('reports a missing directory before checking later segments', () => {
    // Arrange
    const archive = openJamArchive(createTestArchive())

    // Act
    const find = () => archive.findFile('MISSING\\THIRTEENCHARS')

    // Assert
    expect(find).toThrow(new JamLookupError(JamLookupFailure.NOT_FOUND, 'MISSING\\THIRTEENCHARS'))
  })

  it('rejects a directory claiming more than 100000 entries', () => {
    // Arrange
    const bytes = createTestArchive()
    new DataView(bytes.buffer).setUint32(4, 100_001, true)
    const archive = openJamArchive(bytes)

    // Act
    const find = () => archive.findFile('GAMEDATA\\GO.PCM')

    // Assert
    expect(find).toThrow(JamArchiveReadError)
  })

  it('lists every file path', () => {
    // Arrange
    const archive = openJamArchive(createTestArchive())

    // Act
    const paths = archive.getFilePaths()

    // Assert
    expect(paths).toEqual(['GAMEDATA\\GO.PCM'])
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'indexes the original LEGO.JAM so its files cover the archive exactly',
    () => {
      // Arrange
      const bytes = new Uint8Array(readFileSync(ORIGINAL_JAM_PATH))
      const archive = openJamArchive(bytes)

      // Act
      const locations = archive.getFilePaths().map((path) => archive.findFile(path))

      // Assert
      expect(locations).toHaveLength(5444)
      expect(Math.max(...locations.map((location) => location.offset + location.size))).toBe(
        bytes.byteLength
      )
    }
  )
})
