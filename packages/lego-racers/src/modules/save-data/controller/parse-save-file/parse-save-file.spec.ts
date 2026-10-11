import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { writeSaveBlocks } from '../save-blocks/save-blocks.ts'
import { createDefaultProfile } from '../profile-updates/profile-updates.ts'
import { serializeSaveFile } from '../serialize-save-file/serialize-save-file.ts'
import { SaveFileError, SaveFileFailure } from '../../types/save-errors/save-errors.ts'
import { parseSaveFile } from './parse-save-file.ts'

const DEFAULT_SAVE_PATH = 'MENUDATA\\DEFAULT.LRS'
const QUICK_BUILD_SAVE_PATH = 'MENUDATA\\QBUILD.LRS'

describe('parseSaveFile', () => {
  it('writes and reads back a profile and two racers', () => {
    // Arrange
    const profile = createDefaultProfile(2)
    const racer = {
      name: 'ASH KART',
      colorBytes: [1, 2, 3, 4, 0x85],
      chassisName: 'dachas0',
      designBytes: Array.from({ length: 0x202 }, (_, index) => index % 251),
      circuitRanks: 0x0123,
    }
    const saveFile = { profile, racers: [racer, { ...racer, name: 'B' }] }

    // Act
    const parsed = parseSaveFile(serializeSaveFile(saveFile))

    // Assert
    expect(parsed).toEqual(saveFile)
  })

  it('rejects a file that does not start with LR', () => {
    // Arrange
    const bytes = writeSaveBlocks(new Uint8Array(0x477))

    // Act
    const parse = () => parseSaveFile(bytes)

    // Assert
    expect(parse).toThrow(SaveFileError)
    expect(parse).toThrow(SaveFileFailure.BAD_SIGNATURE)
  })

  it('rejects a block whose sum does not match', () => {
    // Arrange
    const bytes = serializeSaveFile({ profile: createDefaultProfile(0), racers: [] })
    bytes[10] = (bytes[10] ?? 0) ^ 0xff

    // Act
    const parse = () => parseSaveFile(bytes)

    // Assert
    expect(parse).toThrow(SaveFileFailure.CORRUPT_BLOCK)
  })

  it('rejects a file that ends before its racers', () => {
    // Arrange
    const racer = {
      name: 'X',
      colorBytes: [0, 0, 0, 0, 0],
      chassisName: 'dachas0',
      designBytes: new Array<number>(0x202).fill(0),
      circuitRanks: 0,
    }
    const bytes = serializeSaveFile({ profile: createDefaultProfile(0), racers: [racer] })

    // Act
    const parse = () => parseSaveFile(bytes.subarray(0, bytes.byteLength - 0x280))

    // Assert
    expect(parse).toThrow(SaveFileFailure.TRUNCATED)
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'reads the default save file of LEGO.JAM and writes it back with identical bytes for the racers it counts',
    () => {
      // Arrange
      const bytes = openJamArchive(readOriginalJam()).readFile(DEFAULT_SAVE_PATH)

      // Act
      const parsed = parseSaveFile(bytes)
      const written = serializeSaveFile(parsed)

      // Assert
      expect(parsed.racers.map(({ name }) => name).slice(0, 3)).toEqual([
        'JOAN OF KART',
        'TURBO CHARGER',
        'SCOOTER',
      ])
      expect(parsed.racers.map(({ chassisName }) => chassisName)).toContain('dachas0')
      expect(written).toEqual(bytes.subarray(0, written.byteLength))
    }
  )

  it.skipIf(!getIsOriginalJamPresent())(
    'reads the quick-build cars of LEGO.JAM and writes them back with identical bytes',
    () => {
      // Arrange
      const bytes = openJamArchive(readOriginalJam()).readFile(QUICK_BUILD_SAVE_PATH)

      // Act
      const parsed = parseSaveFile(bytes)
      const written = serializeSaveFile(parsed)

      // Assert
      expect(parsed.racers).toHaveLength(24)
      expect(written).toEqual(bytes.subarray(0, written.byteLength))
    }
  )
})
