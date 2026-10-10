import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { TokenReaderError, TokenReaderFailure } from '../../../token-reader/index.ts'
import { UnportableModelError } from '../../types/model-errors/model-errors.ts'
import { ModelCommandKind } from '../../types/model-command-kind/model-command-kind.ts'
import { VertexFormat } from '../../types/vertex-format/vertex-format.ts'
import { parseModel } from './parse-model.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const encodeString = (value: string): readonly number[] => [
  0x02,
  ...Array.from({ length: value.length }, (_, index) => value.charCodeAt(index)),
  0x00,
]

const byteInteger = (value: number): readonly number[] => [0x0c, value]

const shortFloat = (value: number): readonly number[] => [0x11, value & 0xff, (value >> 8) & 0xff]

const arrayHeader = (count: number): readonly number[] => [0x07, ...byteInteger(count), 0x08, 0x05]

const commandList = (commands: readonly (readonly number[])[]): readonly number[] => [
  0x2e,
  ...arrayHeader(commands.length),
  ...commands.flat(),
  0x06,
]

const MATERIALS = [0x27, ...arrayHeader(1), ...encodeString('bb_tire_long'), 0x06]
const COLORED_VERTICES = [
  0x2a,
  ...arrayHeader(2),
  ...[1, 2, 3, 0, 1].flatMap(shortFloat),
  ...[0x10, 0x20, 0x30, 0x40].flatMap(byteInteger),
  ...[4, 5, 6, 1, 0].flatMap(shortFloat),
  ...[0xff, 0x00, 0x80, 0xff].flatMap(byteInteger),
  0x06,
]
const FACES = [0x2d, ...arrayHeader(1), ...[0, 1, 2].flatMap(byteInteger), 0x06]
const COMMANDS = commandList([
  [0x27, ...byteInteger(0)],
  [0x32, ...byteInteger(3)],
  [0x31, ...byteInteger(0), ...byteInteger(0), ...byteInteger(2)],
  [0x2d, ...byteInteger(0), ...byteInteger(1)],
])
const SCALE = [0x33, ...shortFloat(2)]

const parseCommands = (commands: readonly (readonly number[])[]) =>
  parseModel(new Uint8Array(commandList(commands))).commands

describe('parseModel', () => {
  it('reads materials, vertices, faces, commands and scale until the end of the file', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...MATERIALS,
      ...COLORED_VERTICES,
      ...FACES,
      ...COMMANDS,
      ...SCALE,
    ])

    // Act
    const model = parseModel(bytes)

    // Assert
    expect(model).toEqual({
      materialNames: ['bb_tire_'],
      vertexBuffer: {
        format: VertexFormat.POSITION_TEXTURE_COLOR,
        vertexCount: 2,
        positions: [1, 2, 3, 4, 5, 6],
        textureCoordinates: [0, 1, 1, 0],
        normals: [],
        colors: [0x40102030, 0xffff0080],
      },
      positionVertexBuffer: null,
      faces: [[0, 1, 2]],
      commands: [
        { kind: ModelCommandKind.SELECT_MATERIAL, materialIndex: 0 },
        { kind: ModelCommandKind.SELECT_TRANSFORM, transformIndex: 3 },
        {
          kind: ModelCommandKind.TRANSFORM_VERTICES,
          cacheIndex: 0,
          firstVertex: 0,
          vertexCount: 2,
        },
        { kind: ModelCommandKind.DRAW_FACES, firstFace: 0, faceCount: 1 },
      ],
      scale: 2,
      readByteCount: bytes.byteLength,
    })
    expect(Object.isFrozen(model.commands)).toBe(true)
  })

  it('defaults the scale to one and leaves missing sections empty', () => {
    // Arrange
    const bytes = new Uint8Array(MATERIALS)

    // Act
    const model = parseModel(bytes)

    // Assert
    expect([model.scale, model.vertexBuffer, model.faces, model.commands]).toEqual([
      1,
      null,
      [],
      [],
    ])
  })

  it('reads normals after the texture coordinates of a normal vertex buffer', () => {
    // Arrange
    const bytes = new Uint8Array([
      0x29,
      ...arrayHeader(1),
      ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap(shortFloat),
      0x06,
    ])

    // Act
    const model = parseModel(bytes)

    // Assert
    expect(model.vertexBuffer?.normals).toEqual([6, 7, 8])
  })

  it('keeps only the low sixteen bits of a vertex count', () => {
    // Arrange
    const bytes = new Uint8Array([0x28, 0x07, 0x04, 0x00, 0x00, 0x01, 0x00, 0x08, 0x05])

    // Act
    const parse = () => parseModel(bytes)

    // Assert
    expect(parse).toThrow(new TokenReaderError(TokenReaderFailure.EXPECTED_INTEGER, 7))
  })

  it('rejects a second section of the same kind as an unexpected keyword', () => {
    // Arrange
    const bytes = new Uint8Array([...MATERIALS, ...MATERIALS])

    // Act
    const parse = () => parseModel(bytes)

    // Assert
    expect(parse).toThrow(
      new TokenReaderError(TokenReaderFailure.UNEXPECTED_KEYWORD, MATERIALS.length + 1)
    )
  })

  it('rejects an unknown keyword as a syntax error', () => {
    // Arrange
    const bytes = new Uint8Array([0x30])

    // Act
    const parse = () => parseModel(bytes)

    // Assert
    expect(parse).toThrow(new TokenReaderError(TokenReaderFailure.SYNTAX_ERROR, 1))
  })

  it('lets pushes and pops overwrite one transform slot until a draw moves past it', () => {
    // Arrange
    const commands = [
      [0x2f, ...byteInteger(5)],
      [0x2f, ...byteInteger(6)],
      [0x30],
      [0x2d, ...byteInteger(0), ...byteInteger(1)],
    ]

    // Act
    const parsed = parseCommands(commands)

    // Assert
    expect(parsed).toEqual([
      { kind: ModelCommandKind.SELECT_TRANSFORM, transformIndex: 5 },
      { kind: ModelCommandKind.DRAW_FACES, firstFace: 0, faceCount: 1 },
    ])
  })

  it('drops a transform that no later command moves past', () => {
    // Arrange
    const commands = [
      [0x27, ...byteInteger(1)],
      [0x32, ...byteInteger(2)],
    ]

    // Act
    const parsed = parseCommands(commands)

    // Assert
    expect(parsed).toEqual([{ kind: ModelCommandKind.SELECT_MATERIAL, materialIndex: 1 }])
  })

  it('stores a vertex count of zero as sixty-four', () => {
    // Arrange
    const commands = [[0x31, ...byteInteger(0), ...byteInteger(9), ...byteInteger(0)]]

    // Act
    const parsed = parseCommands(commands)

    // Assert
    expect(parsed).toEqual([
      { kind: ModelCommandKind.TRANSFORM_VERTICES, cacheIndex: 0, firstVertex: 9, vertexCount: 64 },
    ])
  })

  it('rejects vertices that would overflow the 64-entry cache as unsupported', () => {
    // Arrange
    const bytes = new Uint8Array(
      commandList([[0x31, ...byteInteger(60), ...byteInteger(0), ...byteInteger(5)]])
    )

    // Act
    const parse = () => parseModel(bytes)

    // Assert
    expect(parse).toThrow(new TokenReaderError(TokenReaderFailure.UNSUPPORTED, 13))
  })

  it('stores only seven bits of a face count but rejects counts above 255', () => {
    // Arrange
    const validCommands = [[0x2d, ...byteInteger(0), ...byteInteger(0x81)]]
    const invalidBytes = new Uint8Array(commandList([[0x2d, ...byteInteger(0), 0x0e, 0x00, 0x01]]))

    // Act
    const parsed = parseCommands(validCommands)
    const parseInvalid = () => parseModel(invalidBytes)

    // Assert
    expect(parsed).toEqual([{ kind: ModelCommandKind.DRAW_FACES, firstFace: 0, faceCount: 1 }])
    expect(parseInvalid).toThrow(new TokenReaderError(TokenReaderFailure.UNSUPPORTED, 12))
  })

  it('restores the last vertex count operand when the last transform is popped', () => {
    // Arrange
    const commands = [
      [0x31, ...byteInteger(0), ...byteInteger(0), ...byteInteger(7)],
      [0x2f, ...byteInteger(5)],
      [0x30],
      [0x27, ...byteInteger(0)],
    ]

    // Act
    const parsed = parseCommands(commands)

    // Assert
    expect(parsed[1]).toEqual({ kind: ModelCommandKind.SELECT_TRANSFORM, transformIndex: 7 })
  })

  it('refuses to pop the last transform before any vertex command', () => {
    // Arrange
    const bytes = new Uint8Array(commandList([[0x2f, ...byteInteger(5)], [0x30]]))

    // Act
    const parse = () => parseModel(bytes)

    // Assert
    expect(parse).toThrow(UnportableModelError)
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'parses every model in the original LEGO.JAM to its last byte',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.toUpperCase().endsWith('.GDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        return { path, byteLength: bytes.byteLength, model: parseModel(bytes) }
      })

      // Assert
      expect(results).toHaveLength(812)
      for (const { path, byteLength, model } of results) {
        expect({ path, readByteCount: model.readByteCount }).toEqual({
          path,
          readByteCount: byteLength,
        })
      }
    }
  )
})
