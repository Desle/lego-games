import {
  BinaryToken,
  TokenReaderError,
  TokenReaderFailure,
  createTokenReader,
} from '../../../token-reader/index.ts'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openJamArchive } from '../../../jam-archive/index.ts'
import { WorldOverflowError } from '../../types/world-errors/world-errors.ts'
import { WorldKeyword } from '../../types/world-keyword/world-keyword.ts'
import { readWorld, readWorldFromReader } from './read-world.ts'

const ORIGINAL_JAM_PATH = resolve(
  import.meta.dirname,
  '../../../../../../../original-files/Lego_Racers_Win_Files_EN/Game Files/LEGO.JAM'
)

const getFloatBytes = (value: number): number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setFloat32(0, value, true)
  return [BinaryToken.FLOAT, ...bytes]
}

const getIntegerBytes = (value: number): number[] => {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setInt32(0, value, true)
  return [BinaryToken.INTEGER, ...bytes]
}

const getStringBytes = (value: string): number[] => [
  BinaryToken.STRING,
  ...new TextEncoder().encode(value),
  0,
]

const getArrayHeaderBytes = (count: number): number[] => [
  BinaryToken.LEFT_BRACKET,
  ...getIntegerBytes(count),
  BinaryToken.RIGHT_BRACKET,
  BinaryToken.LEFT_CURLY,
]

const getNameListBytes = (keyword: number, names: readonly string[]): number[] => [
  keyword,
  ...getArrayHeaderBytes(names.length),
  ...names.flatMap(getStringBytes),
  BinaryToken.RIGHT_CURLY,
]

const getVectorBytes = (x: number, y: number, z: number): number[] => [
  ...getFloatBytes(x),
  ...getFloatBytes(y),
  ...getFloatBytes(z),
]

const getMeshInstanceBytes = (contents: readonly number[]): number[] => [
  WorldKeyword.MESH_INSTANCE,
  ...getArrayHeaderBytes(1),
  WorldKeyword.MESH_INSTANCE,
  ...getStringBytes('rkbflag'),
  BinaryToken.LEFT_CURLY,
  ...contents,
  BinaryToken.RIGHT_CURLY,
  BinaryToken.RIGHT_CURLY,
]

const getMeshLevelBytes = (meshIndex: number, distance: number): number[] => [
  WorldKeyword.MESH,
  ...getIntegerBytes(meshIndex),
  ...getFloatBytes(distance),
]

// GAMEDATA\RACEC0R0\LOCAL.WDB from the English LEGO.JAM.
const LOCAL_WORLD_BYTES = new Uint8Array([
  0x27, 0x07, 0x04, 0x02, 0x00, 0x00, 0x00, 0x08, 0x05, 0x02, 0x65, 0x6d, 0x69, 0x74, 0x63, 0x30,
  0x72, 0x30, 0x00, 0x02, 0x69, 0x67, 0x64, 0x5f, 0x6d, 0x61, 0x70, 0x00, 0x06, 0x28, 0x07, 0x04,
  0x02, 0x00, 0x00, 0x00, 0x08, 0x05, 0x02, 0x65, 0x6d, 0x69, 0x74, 0x63, 0x30, 0x72, 0x30, 0x00,
  0x02, 0x69, 0x67, 0x64, 0x5f, 0x6d, 0x61, 0x70, 0x00, 0x06, 0x3d, 0x07, 0x04, 0x01, 0x00, 0x00,
  0x00, 0x08, 0x05, 0x02, 0x65, 0x6d, 0x69, 0x74, 0x63, 0x30, 0x72, 0x30, 0x00, 0x06,
])

describe('readWorld', () => {
  it('reads an empty file as an empty world', () => {
    // Arrange
    const bytes = new Uint8Array(0)

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.textures).toEqual([])
    expect(world.meshInstances).toEqual([])
    expect(world.cameras).toEqual([])
  })

  it('reads the name lists of an original file', () => {
    // Arrange
    const bytes = LOCAL_WORLD_BYTES

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.textures).toEqual(['emitc0r0', 'igd_map'])
    expect(world.materials).toEqual(['emitc0r0', 'igd_map'])
    expect(world.materialAnimations).toEqual(['emitc0r0'])
  })

  it('keeps only the first eight characters of a name, as strncpy(8) does', () => {
    // Arrange
    const bytes = new Uint8Array(getNameListBytes(WorldKeyword.MESH, ['abcdefghijk']))

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.meshes).toEqual(['abcdefgh'])
  })

  it('rejects a section that appears twice', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...getNameListBytes(WorldKeyword.TEXTURE, ['first']),
      ...getNameListBytes(WorldKeyword.TEXTURE, ['second']),
    ])

    // Act
    const read = () => readWorld(bytes)

    // Assert
    expect(read).toThrow(TokenReaderError)
    expect(read).toThrow(/Unexpected keyword/)
  })

  it('rejects a section with a count of zero', () => {
    // Arrange
    const bytes = new Uint8Array(getNameListBytes(WorldKeyword.TEXTURE, []))

    // Act
    const read = () => readWorld(bytes)

    // Assert
    expect(read).toThrow(/Expected int/)
  })

  it('skips top-level tokens it has no handler for', () => {
    // Arrange
    const bytes = new Uint8Array([
      BinaryToken.LEFT_CURLY,
      ...getIntegerBytes(7),
      WorldKeyword.POSITION,
      ...getNameListBytes(WorldKeyword.SKELETON, ['camDUM']),
    ])

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.skeletons).toEqual(['camDUM'])
  })

  it('reads a mesh instance with the defaults of 0x1002cc30 for missing fields', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...getNameListBytes(WorldKeyword.MESH, ['rkbflag']),
      ...getMeshInstanceBytes([
        ...getMeshLevelBytes(0, 600),
        WorldKeyword.POSITION,
        ...getVectorBytes(1, 2, 3),
        WorldKeyword.KEYWORD_3F,
        ...getFloatBytes(0.5),
        ...getFloatBytes(0),
      ]),
    ])

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.meshInstances).toEqual([
      {
        name: 'rkbflag',
        levels: [{ meshIndex: 0, distance: 600 }],
        materialAssignmentIndices: [-1, -1, -1],
        position: { x: 1, y: 2, z: 3 },
        forward: { x: 1, y: 0, z: 0 },
        up: { x: 0, y: 0, z: 1 },
        materialAnimationReferences: [],
        keyword3fValues: [0.5, 0],
        isKeyword42Set: false,
        keyword36Value: 1,
        isKeyword4cSet: false,
      },
    ])
  })

  it('stores the largest float for a negative level distance', () => {
    // Arrange
    const bytes = new Uint8Array(getMeshInstanceBytes(getMeshLevelBytes(0, -1)))

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.meshInstances[0]?.levels[0]?.distance).toBe(3.4028234663852886e38)
  })

  it('rejects a mesh index beyond the mesh list', () => {
    // Arrange
    const bytes = new Uint8Array([
      ...getNameListBytes(WorldKeyword.MESH, ['rkbflag']),
      ...getMeshInstanceBytes(getMeshLevelBytes(1, 600)),
    ])

    // Act
    const read = () => readWorld(bytes)

    // Assert
    expect(read).toThrow(/Invalid value/)
  })

  it('does not check a mesh index while the mesh list is still missing', () => {
    // Arrange
    const bytes = new Uint8Array(getMeshInstanceBytes(getMeshLevelBytes(9, 600)))

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.meshInstances[0]?.levels).toEqual([{ meshIndex: 9, distance: 600 }])
  })

  it('refuses a fourth level, which the original would write past its arrays', () => {
    // Arrange
    const bytes = new Uint8Array(
      getMeshInstanceBytes([0, 1, 2, 3].flatMap((meshIndex) => getMeshLevelBytes(meshIndex, 1)))
    )

    // Act
    const read = () => readWorld(bytes)

    // Assert
    expect(read).toThrow(WorldOverflowError)
  })

  it('reports an unknown keyword inside an entry as a syntax error', () => {
    // Arrange
    const bytes = new Uint8Array(getMeshInstanceBytes([WorldKeyword.CAMERA]))

    // Act
    const read = () => readWorld(bytes)

    // Assert
    expect(read).toThrow(new TokenReaderError(TokenReaderFailure.SYNTAX_ERROR, 21))
  })

  it('negates the second orientation vector of a camera and aims it at its target', () => {
    // Arrange
    const bytes = new Uint8Array([
      WorldKeyword.CAMERA,
      ...getArrayHeaderBytes(1),
      WorldKeyword.CAMERA,
      ...getStringBytes('Camera01'),
      BinaryToken.LEFT_CURLY,
      WorldKeyword.POSITION,
      ...getVectorBytes(1, 2, 3),
      WorldKeyword.ORIENTATION,
      ...getVectorBytes(0, 1, 0),
      ...getVectorBytes(0, 0, 1),
      WorldKeyword.TARGET,
      ...getVectorBytes(1.5, 2, 0),
      WorldKeyword.KEYWORD_46,
      ...getFloatBytes(800),
      BinaryToken.RIGHT_CURLY,
      BinaryToken.RIGHT_CURLY,
    ])

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.cameras).toEqual([
      {
        name: 'Camera01',
        skeletonInstanceIndex: -1,
        keyword2fValue: 0,
        keyword35Index: 0,
        keyword35Name: '',
        position: { x: 1, y: 2, z: 3 },
        forward: { x: 0.5, y: 0, z: -3 },
        negatedUp: { x: -0, y: -0, z: -1 },
        nearPlane: 1,
        farPlane: 800,
        fieldOfViewDegrees: 65,
      },
    ])
  })

  it('reads light colours as bytes with an opaque fourth byte', () => {
    // Arrange
    const bytes = new Uint8Array([
      WorldKeyword.DIRECTIONAL_LIGHT,
      ...getArrayHeaderBytes(1),
      WorldKeyword.DIRECTIONAL_LIGHT,
      ...getStringBytes('Direct01'),
      BinaryToken.LEFT_CURLY,
      WorldKeyword.COLOR,
      ...getIntegerBytes(180),
      ...getIntegerBytes(256),
      ...getIntegerBytes(-1),
      WorldKeyword.DIRECTION,
      ...getVectorBytes(0, 0, -1),
      BinaryToken.RIGHT_CURLY,
      BinaryToken.RIGHT_CURLY,
    ])

    // Act
    const world = readWorld(bytes)

    // Assert
    expect(world.directionalLights).toEqual([
      { colorBytes: [180, 0, 255, 255], direction: { x: 0, y: 0, z: -1 } },
    ])
  })

  it.skipIf(!existsSync(ORIGINAL_JAM_PATH))(
    'reads every WDB file in the original LEGO.JAM and consumes exactly its bytes',
    () => {
      // Arrange
      const archive = openJamArchive(new Uint8Array(readFileSync(ORIGINAL_JAM_PATH)))
      const paths = archive.getFilePaths().filter((path) => path.endsWith('.WDB'))

      // Act
      const results = paths.map((path) => {
        const bytes = archive.readFile(path)
        const reader = createTokenReader(bytes)
        const world = readWorldFromReader(reader)
        return { path, world, isFullyConsumed: reader.getPosition() === bytes.byteLength }
      })

      // Assert
      expect(results).toHaveLength(133)
      expect(results.filter((result) => !result.isFullyConsumed)).toEqual([])
      const collide = results.find((result) => result.path === 'GAMEDATA\\RACEC0R0\\COLLIDE.WDB')
      expect(collide?.world.bspVolumes).toEqual(['collide', 'chckpt00', 'startfin'])
      expect(collide?.world.bspVolumeInstances[2]?.position).toEqual({
        x: 362.0537109375,
        y: 217.0001220703125,
        z: 46.94730758666992,
      })
      const camera = results.find((result) => result.path === 'MENUDATA\\CAM.WDB')
      expect(camera?.world.cameras[0]?.farPlane).toBe(800)
    }
  )
})
