import { BinaryToken, TokenReaderFailure } from '../../../token-reader/index.ts'
import type { TokenReader } from '../../../token-reader/index.ts'
import { WorldOverflowError } from '../../types/world-errors/world-errors.ts'
import { WorldKeyword } from '../../types/world-keyword/world-keyword.ts'
import type {
  AmbientLight,
  BspTreeInstance,
  BspTreeLevel,
  BspVolumeInstance,
  Camera,
  DirectionalLight,
  MeshInstance,
  MeshLevel,
  SkeletonInstance,
  SkeletonLevel,
  Sprite,
  SpriteMaterialAnimation,
  SpriteMaterialAssignment,
  Vector3,
} from '../../types/world.types.ts'
import type {
  InstanceState,
  MaterialAnimationReferences,
  Orientation,
  WorldCounts,
} from './read-world.types.ts'

const NAME_LENGTH = 8
const LEVEL_COUNT = 3
const MAXIMUM_MATERIAL_ASSIGNMENT_SLOT = 2
// 0x7f7fffff at GolDP.dll 0x100576e4 and 0x100576e8.
const MAXIMUM_FLOAT = 3.4028234663852886e38
const OPAQUE_ALPHA = 0xff
const BYTE_MASK = 0xff

const ZERO_VECTOR: Vector3 = Object.freeze({ x: 0, y: 0, z: 0 })
const DEFAULT_FORWARD: Vector3 = Object.freeze({ x: 1, y: 0, z: 0 })
const DEFAULT_UP: Vector3 = Object.freeze({ x: 0, y: 0, z: 1 })
const DEFAULT_CAMERA_NEGATED_UP: Vector3 = Object.freeze({ x: 0, y: 0, z: -1 })
const DEFAULT_KEYWORD_36_VALUE = 1
const DEFAULT_CAMERA_KEYWORD_45_VALUE = 1
const DEFAULT_CAMERA_KEYWORD_46_VALUE = 100
const DEFAULT_CAMERA_KEYWORD_47_VALUE = 65

export const truncateName = (name: string) => name.slice(0, NAME_LENGTH)

const toSignedShort = (value: number) => (value << 16) >> 16

const getDistance = (value: number) => (value >= 0 ? value : MAXIMUM_FLOAT)

export const readVector3 = (reader: TokenReader): Vector3 => {
  const x = reader.readFloat()
  const y = reader.readFloat()
  const z = reader.readFloat()
  return Object.freeze({ x, y, z })
}

const readOrientation = (reader: TokenReader): Orientation => {
  const forward = readVector3(reader)
  const up = readVector3(reader)
  return Object.freeze({ forward, up })
}

const negateVector = (vector: Vector3): Vector3 =>
  Object.freeze({ x: -vector.x, y: -vector.y, z: -vector.z })

const subtractVectors = (left: Vector3, right: Vector3): Vector3 =>
  Object.freeze({
    x: Math.fround(left.x - right.x),
    y: Math.fround(left.y - right.y),
    z: Math.fround(left.z - right.z),
  })

// Index checks compare unsigned and are skipped while the referenced list is still empty.
const checkIndex = (reader: TokenReader, index: number, count: number): void => {
  if (count !== 0 && index >>> 0 >= count) reader.fail(TokenReaderFailure.INVALID_VALUE)
}

const readCheckedIndex = (reader: TokenReader, count: number): number => {
  const index = reader.readInteger()
  checkIndex(reader, index, count)
  return index
}

const readEntryHeader = (reader: TokenReader, keyword: number): string => {
  reader.expectToken(keyword)
  let name = ''
  if (reader.getNextToken() === BinaryToken.STRING) {
    name = truncateName(reader.getStringValue())
  } else {
    reader.pushBackToken()
  }
  reader.expectLeftCurly()
  return name
}

const readEntries = <Entry>(reader: TokenReader, readEntry: () => Entry): readonly Entry[] => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const entries: Entry[] = []
  for (let index = 0; index < count >>> 0; index++) entries.push(readEntry())
  reader.expectRightCurly()
  return Object.freeze(entries)
}

// 0x1002c7b0 and its siblings: a counted list of names, each copied with strncpy(8).
export const readNameList = (reader: TokenReader): readonly string[] =>
  readEntries(reader, () => truncateName(reader.readString()))

// 0x1002dbe0
const readMaterialAnimationReferences = (reader: TokenReader): MaterialAnimationReferences =>
  readEntries(reader, () => {
    const materialAnimationIndex = reader.readInteger()
    const entryIndex = reader.readInteger()
    const value = reader.readInteger()
    const levelIndex = reader.readInteger()
    return Object.freeze({ materialAnimationIndex, entryIndex, value, levelIndex })
  })

const assertLevelSlotAvailable = (reader: TokenReader, levelCount: number): void => {
  if (levelCount >= LEVEL_COUNT) {
    throw new WorldOverflowError('More than three levels in one entry', reader.getPosition())
  }
}

const createInstanceState = (
  reader: TokenReader,
  name: string,
  counts: WorldCounts
): InstanceState => {
  const materialAssignmentIndices = [-1, -1, -1]
  let position = ZERO_VECTOR
  let orientation: Orientation = Object.freeze({ forward: DEFAULT_FORWARD, up: DEFAULT_UP })
  let materialAnimationReferences: MaterialAnimationReferences | null = null
  let keyword3fValues: readonly number[] | null = null
  let isKeyword42Set = false

  const readMaterialAssignment = (): void => {
    const materialAssignmentIndex = readCheckedIndex(reader, counts.materialAssignments)
    const slot = reader.readInteger()
    if (slot > MAXIMUM_MATERIAL_ASSIGNMENT_SLOT) reader.fail(TokenReaderFailure.INVALID_VALUE)
    if (slot < 0) {
      throw new WorldOverflowError('Negative material assignment slot', reader.getPosition())
    }
    materialAssignmentIndices[slot] = materialAssignmentIndex
  }

  const handleCommonKeyword = (keyword: number): boolean => {
    switch (keyword) {
      case WorldKeyword.MATERIAL_ASSIGNMENT:
        readMaterialAssignment()
        return true
      case WorldKeyword.POSITION:
        position = readVector3(reader)
        return true
      case WorldKeyword.ORIENTATION:
        orientation = readOrientation(reader)
        return true
      case WorldKeyword.MATERIAL_ANIMATION_REFERENCE:
        if (materialAnimationReferences !== null) {
          reader.fail(TokenReaderFailure.UNEXPECTED_KEYWORD)
        }
        materialAnimationReferences = readMaterialAnimationReferences(reader)
        return true
      case WorldKeyword.KEYWORD_3F: {
        const first = reader.readFloat()
        const second = reader.readFloat()
        keyword3fValues = Object.freeze([first, second])
        return true
      }
      case WorldKeyword.KEYWORD_42:
        isKeyword42Set = true
        return true
      default:
        return false
    }
  }

  const getCommonFields = () =>
    Object.freeze({
      name,
      materialAssignmentIndices: Object.freeze([...materialAssignmentIndices]),
      position,
      forward: orientation.forward,
      up: orientation.up,
      materialAnimationReferences: materialAnimationReferences ?? Object.freeze([]),
      keyword3fValues,
      isKeyword42Set,
    })

  return Object.freeze({ handleCommonKeyword, getCommonFields })
}

// 0x1002cc30
export const readMeshInstances = (
  reader: TokenReader,
  counts: WorldCounts
): readonly MeshInstance[] =>
  readEntries(reader, () => {
    const state = createInstanceState(
      reader,
      readEntryHeader(reader, WorldKeyword.MESH_INSTANCE),
      counts
    )
    const levels: MeshLevel[] = []
    let keyword36Value = DEFAULT_KEYWORD_36_VALUE
    let isKeyword4cSet = false
    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      if (state.handleCommonKeyword(keyword)) continue
      switch (keyword) {
        case WorldKeyword.MESH: {
          const meshIndex = readCheckedIndex(reader, counts.meshes)
          assertLevelSlotAvailable(reader, levels.length)
          const distance = getDistance(reader.readFloat())
          levels.push(Object.freeze({ meshIndex, distance }))
          break
        }
        case WorldKeyword.KEYWORD_36:
          keyword36Value = reader.readFloat()
          break
        case WorldKeyword.KEYWORD_4C:
          isKeyword4cSet = true
          break
        default:
          reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      }
    }
    return Object.freeze({
      ...state.getCommonFields(),
      levels: Object.freeze(levels),
      keyword36Value,
      isKeyword4cSet,
    })
  })

// 0x1002cfa0
export const readSkeletonInstances = (
  reader: TokenReader,
  counts: WorldCounts
): readonly SkeletonInstance[] =>
  readEntries(reader, () => {
    const state = createInstanceState(
      reader,
      readEntryHeader(reader, WorldKeyword.SKELETON_INSTANCE),
      counts
    )
    const levels: SkeletonLevel[] = []
    let keyword35Index = -1
    let keyword35Name = ''
    let keyword36Value = DEFAULT_KEYWORD_36_VALUE
    let isKeyword4cSet = false

    const readLevel = (meshIndex: number): void => {
      const skeletonIndex = readCheckedIndex(reader, counts.skeletons)
      const animationIndex = readCheckedIndex(reader, counts.animations)
      assertLevelSlotAvailable(reader, levels.length)
      const distance = getDistance(reader.readFloat())
      levels.push(Object.freeze({ meshIndex, skeletonIndex, animationIndex, distance }))
    }

    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      if (state.handleCommonKeyword(keyword)) continue
      switch (keyword) {
        case WorldKeyword.SKELETON:
          readLevel(-1)
          break
        case WorldKeyword.MESH_SKELETON:
          readLevel(readCheckedIndex(reader, counts.meshes))
          break
        case WorldKeyword.KEYWORD_35:
          if (reader.getNextToken() === BinaryToken.STRING) {
            keyword35Index = -1
            keyword35Name = truncateName(reader.getStringValue())
          } else {
            reader.pushBackToken()
            keyword35Index = reader.readInteger()
            keyword35Name = ''
          }
          break
        case WorldKeyword.KEYWORD_36:
          keyword36Value = reader.readFloat()
          break
        case WorldKeyword.KEYWORD_4C:
          isKeyword4cSet = true
          break
        default:
          reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      }
    }
    return Object.freeze({
      ...state.getCommonFields(),
      levels: Object.freeze(levels),
      keyword35Index,
      keyword35Name,
      keyword36Value,
      isKeyword4cSet,
    })
  })

// 0x1002d400
export const readBspTreeInstances = (
  reader: TokenReader,
  counts: WorldCounts
): readonly BspTreeInstance[] =>
  readEntries(reader, () => {
    const state = createInstanceState(
      reader,
      readEntryHeader(reader, WorldKeyword.BSP_TREE_INSTANCE),
      counts
    )
    const levels: BspTreeLevel[] = []
    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      if (state.handleCommonKeyword(keyword)) continue
      if (keyword !== WorldKeyword.MESH_BSP_TREE) reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      const meshIndex = readCheckedIndex(reader, counts.meshes)
      const bspTreeIndex = readCheckedIndex(reader, counts.bspTrees)
      assertLevelSlotAvailable(reader, levels.length)
      const distance = getDistance(reader.readFloat())
      levels.push(Object.freeze({ meshIndex, bspTreeIndex, distance }))
    }
    return Object.freeze({ ...state.getCommonFields(), levels: Object.freeze(levels) })
  })

// 0x1002d720
export const readBspVolumeInstances = (
  reader: TokenReader,
  counts: WorldCounts
): readonly BspVolumeInstance[] =>
  readEntries(reader, () => {
    const name = readEntryHeader(reader, WorldKeyword.BSP_VOLUME_INSTANCE)
    let bspVolumeIndex = 0
    let materialAssignmentIndex = -1
    let position = ZERO_VECTOR
    let orientation: Orientation = Object.freeze({ forward: DEFAULT_FORWARD, up: DEFAULT_UP })
    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      switch (keyword) {
        case WorldKeyword.MATERIAL_ASSIGNMENT:
          materialAssignmentIndex = readCheckedIndex(reader, counts.materialAssignments)
          break
        case WorldKeyword.POSITION:
          position = readVector3(reader)
          break
        case WorldKeyword.ORIENTATION:
          orientation = readOrientation(reader)
          break
        case WorldKeyword.BSP_VOLUME:
          bspVolumeIndex = readCheckedIndex(reader, counts.bspVolumes)
          break
        default:
          reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      }
    }
    return Object.freeze({
      name,
      bspVolumeIndex,
      materialAssignmentIndex,
      position,
      forward: orientation.forward,
      up: orientation.up,
    })
  })

const readShortPair = (reader: TokenReader): readonly number[] => {
  const first = toSignedShort(reader.readInteger())
  const second = toSignedShort(reader.readInteger())
  return Object.freeze([first, second])
}

// 0x1002d950
export const readSprites = (reader: TokenReader): readonly Sprite[] =>
  readEntries(reader, () => {
    reader.expectToken(WorldKeyword.SPRITE)
    reader.expectLeftCurly()
    let materialName = ''
    let position = ZERO_VECTOR
    let keyword38Vector: Vector3 | null = null
    let keyword3aValue = 0
    let keyword3bValue = 0
    let keyword3cValue = MAXIMUM_FLOAT
    let materialAssignment: SpriteMaterialAssignment | null = null
    let materialAnimation: SpriteMaterialAnimation | null = null
    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      switch (keyword) {
        case WorldKeyword.MATERIAL_ASSIGNMENT: {
          const [materialAssignmentIndex = 0, entryIndex = 0] = readShortPair(reader)
          materialAssignment = Object.freeze({ materialAssignmentIndex, entryIndex })
          break
        }
        case WorldKeyword.POSITION:
          position = readVector3(reader)
          break
        case WorldKeyword.KEYWORD_38:
          keyword38Vector = readVector3(reader)
          break
        case WorldKeyword.MATERIAL_NAME:
          materialName = truncateName(reader.readString())
          break
        case WorldKeyword.KEYWORD_3A:
          keyword3aValue = reader.readFloat()
          break
        case WorldKeyword.KEYWORD_3B:
          keyword3bValue = reader.readFloat()
          break
        case WorldKeyword.KEYWORD_3C:
          keyword3cValue = reader.readFloat()
          break
        case WorldKeyword.MATERIAL_ANIMATION_REFERENCE: {
          const [materialAnimationIndex = 0, entryIndex = 0] = readShortPair(reader)
          materialAnimation = Object.freeze({ materialAnimationIndex, entryIndex })
          break
        }
        default:
          reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      }
    }
    return Object.freeze({
      materialName,
      position,
      keyword38Vector,
      keyword3aValue,
      keyword3bValue,
      keyword3cValue,
      materialAssignment,
      materialAnimation,
    })
  })

// 0x1002dc80
export const readCameras = (reader: TokenReader, counts: WorldCounts): readonly Camera[] =>
  readEntries(reader, () => {
    const name = readEntryHeader(reader, WorldKeyword.CAMERA)
    let skeletonInstanceIndex = -1
    let keyword2fValue = 0
    let keyword35Index = 0
    let keyword35Name = ''
    let position = ZERO_VECTOR
    let forward = DEFAULT_FORWARD
    let negatedUp = DEFAULT_CAMERA_NEGATED_UP
    let keyword45Value = DEFAULT_CAMERA_KEYWORD_45_VALUE
    let keyword46Value = DEFAULT_CAMERA_KEYWORD_46_VALUE
    let keyword47Value = DEFAULT_CAMERA_KEYWORD_47_VALUE
    let target: Vector3 | null = null
    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      switch (keyword) {
        case WorldKeyword.SKELETON_INSTANCE:
          skeletonInstanceIndex = readCheckedIndex(reader, counts.skeletonInstances)
          keyword2fValue = reader.readInteger()
          break
        case WorldKeyword.POSITION:
          position = readVector3(reader)
          break
        case WorldKeyword.ORIENTATION:
          forward = readVector3(reader)
          negatedUp = negateVector(readVector3(reader))
          break
        case WorldKeyword.KEYWORD_35:
          if (reader.getNextToken() === BinaryToken.STRING) {
            keyword35Index = -1
            keyword35Name = truncateName(reader.getStringValue())
          } else {
            reader.pushBackToken()
            keyword35Index = reader.readInteger()
            keyword35Name = ''
          }
          break
        case WorldKeyword.TARGET:
          target = readVector3(reader)
          break
        case WorldKeyword.KEYWORD_45:
          keyword45Value = reader.readFloat()
          break
        case WorldKeyword.KEYWORD_46:
          keyword46Value = reader.readFloat()
          break
        case WorldKeyword.KEYWORD_47:
          keyword47Value = reader.readFloat()
          break
        default:
          reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      }
    }
    if (target !== null) forward = subtractVectors(target, position)
    return Object.freeze({
      name,
      skeletonInstanceIndex,
      keyword2fValue,
      keyword35Index,
      keyword35Name,
      position,
      forward,
      negatedUp,
      keyword45Value,
      keyword46Value,
      keyword47Value,
    })
  })

const readColorBytes = (reader: TokenReader): readonly number[] => {
  const first = reader.readInteger() & BYTE_MASK
  const second = reader.readInteger() & BYTE_MASK
  const third = reader.readInteger() & BYTE_MASK
  return Object.freeze([first, second, third, OPAQUE_ALPHA])
}

const readLightHeader = (reader: TokenReader, keyword: number): void => {
  reader.expectToken(keyword)
  if (reader.getNextToken() !== BinaryToken.STRING) reader.pushBackToken()
  reader.expectLeftCurly()
}

const UNSET_COLOR_BYTES: readonly number[] = Object.freeze([0, 0, 0, 0])

// 0x1002df90
export const readAmbientLights = (reader: TokenReader): readonly AmbientLight[] =>
  readEntries(reader, () => {
    readLightHeader(reader, WorldKeyword.AMBIENT_LIGHT)
    let colorBytes = UNSET_COLOR_BYTES
    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      if (keyword !== WorldKeyword.COLOR) reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      colorBytes = readColorBytes(reader)
    }
    return Object.freeze({ colorBytes })
  })

// 0x1002e0d0
export const readDirectionalLights = (reader: TokenReader): readonly DirectionalLight[] =>
  readEntries(reader, () => {
    readLightHeader(reader, WorldKeyword.DIRECTIONAL_LIGHT)
    let colorBytes = UNSET_COLOR_BYTES
    let direction = ZERO_VECTOR
    for (
      let keyword = reader.getNextToken();
      keyword !== BinaryToken.RIGHT_CURLY;
      keyword = reader.getNextToken()
    ) {
      if (keyword === WorldKeyword.COLOR) {
        colorBytes = readColorBytes(reader)
      } else if (keyword === WorldKeyword.DIRECTION) {
        direction = readVector3(reader)
      } else {
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
      }
    }
    return Object.freeze({ colorBytes, direction })
  })
