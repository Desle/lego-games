import {
  getIsOriginalJamPresent,
  readOriginalJam,
} from '../../../../shared/testing/original-files.ts'
import { LEFT_CURLY, RIGHT_CURLY } from '../../../../shared/testing/token-bytes.ts'
import {
  encodeArrayHeader,
  encodeInteger,
  encodeString,
} from '../../../../shared/token-encoding/token-encoding.ts'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderError } from '../../../token-reader/index.ts'
import { parseMenuDescription, parseMenuStyles } from '../read-menu-files/read-menu-files.ts'

const FILE = 0x27

const getDescription = (...sections: readonly (readonly number[])[]): Uint8Array =>
  new Uint8Array([FILE, ...encodeInteger(4), ...sections.flat()])

const getImageSection = (...entries: readonly (readonly number[])[]): readonly number[] => [
  0x38,
  ...encodeArrayHeader(entries.length),
  ...entries.flat(),
  RIGHT_CURLY,
]

const getImageEntry = (name: string, body: readonly number[]): readonly number[] => [
  0x38,
  ...encodeString(name),
  LEFT_CURLY,
  ...body,
  RIGHT_CURLY,
]

const getPosition = (...rectangle: readonly number[]): readonly number[] => [
  0x36,
  LEFT_CURLY,
  0x2f,
  ...rectangle.flatMap((value) => encodeInteger(value)),
  0x31,
  ...encodeString('backdrp'),
  RIGHT_CURLY,
]

describe('parseMenuDescription', () => {
  it('reads the sections, the entries and the position block of an image', () => {
    // Arrange
    const bytes = getDescription(
      getImageSection(
        getImageEntry('racers', [...getPosition(35, 4, 0, 0), 0x28, ...encodeString('racers')])
      )
    )

    // Act
    const file = parseMenuDescription(bytes)

    // Assert
    expect(file.total).toBe(4)
    expect(file.readByteCount).toBe(bytes.byteLength)
    expect(file.sections).toEqual([
      {
        keyword: 0x38,
        entries: [
          {
            keyword: 0x38,
            name: 'racers',
            properties: [
              {
                keyword: 0x36,
                values: [],
                block: [
                  { keyword: 0x2f, values: [35, 4, 0, 0], block: null },
                  { keyword: 0x31, values: ['backdrp'], block: null },
                ],
              },
              { keyword: 0x28, values: ['racers'], block: null },
            ],
          },
        ],
      },
    ])
  })

  it('rejects a keyword the section does not know, as the original does', () => {
    // Arrange
    const bytes = getDescription(getImageSection(getImageEntry('racers', [0x55])))

    // Act
    const act = () => parseMenuDescription(bytes)

    // Assert
    expect(act).toThrow(TokenReaderError)
  })

  it('rejects a name used twice', () => {
    // Arrange
    const bytes = getDescription(
      getImageSection(getImageEntry('same', []), getImageEntry('same', []))
    )

    // Act
    const act = () => parseMenuDescription(bytes)

    // Assert
    expect(act).toThrow('Duplicate name')
  })

  it.skipIf(!getIsOriginalJamPresent())(
    'parses every menu description and every menu styles file of the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(readOriginalJam())
      const paths = archive.getFilePaths()
      const descriptionPaths = paths.filter((path) => path.toUpperCase().endsWith('.MIB'))
      const stylePaths = paths.filter((path) => path.toUpperCase().endsWith('.MSB'))

      // Act
      const results = [
        ...descriptionPaths.map((path) => ({
          path,
          bytes: archive.readFile(path),
          isStyle: false,
        })),
        ...stylePaths.map((path) => ({ path, bytes: archive.readFile(path), isStyle: true })),
      ].map(({ path, bytes, isStyle }) => {
        const file = isStyle ? parseMenuStyles(bytes) : parseMenuDescription(bytes)
        const entryCount = file.sections.reduce((sum, section) => sum + section.entries.length, 0)
        return { path, byteLength: bytes.byteLength, file, entryCount }
      })

      // Assert
      expect(descriptionPaths).toHaveLength(31)
      expect(stylePaths).toHaveLength(9)
      for (const { path, byteLength, file, entryCount } of results) {
        expect({ path, readByteCount: file.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
        expect(entryCount).toBeLessThanOrEqual(file.total)
      }
    }
  )

  it.skipIf(!getIsOriginalJamPresent())('holds the main menu as the files show it', () => {
    // Arrange
    const archive = openJamArchive(readOriginalJam())

    // Act
    const file = parseMenuDescription(archive.readFile('MENUDATA\\MAINMENU.MIB'))

    // Assert
    expect(file.sections.map((section) => section.keyword)).toEqual([0x38, 0x46, 0x42])
    expect(file.sections[1]?.entries.map((entry) => entry.name)).toEqual([
      'garage',
      'circuit',
      'single',
      'vs',
      'time',
      'options',
      'quit',
      'dialog',
    ])
  })
})
