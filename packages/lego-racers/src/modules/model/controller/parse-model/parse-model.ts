import {
  BinaryToken,
  createTokenReader,
  TokenReaderFailure,
  type TokenReader,
} from '../../../token-reader/index.ts'
import { UnportableModelError } from '../../types/model-errors/model-errors.ts'
import { ModelCommandKind } from '../../types/model-command-kind/model-command-kind.ts'
import { ModelCommandKeyword, ModelKeyword } from '../../types/model-keyword/model-keyword.ts'
import type {
  Model,
  ModelCommand,
  ModelFace,
  ModelVertexBuffer,
  VertexFormat as VertexFormatValue,
} from '../../types/model.types.ts'
import { VertexFormat } from '../../types/vertex-format/vertex-format.ts'

const MATERIAL_NAME_LENGTH = 8
const MAXIMUM_TRANSFORM_DEPTH = 10
const VERTEX_CACHE_SIZE = 0x40
const MAXIMUM_DRAW_FACE_COUNT = 0xff

const readFloats = (reader: TokenReader, target: number[], count: number): void => {
  for (let index = 0; index < count; index++) target.push(reader.readFloat())
}

// 0x10025f90: `[ count ] { "name" ... }`; each name is cut to eight characters by strncpy.
const readMaterialNames = (reader: TokenReader): readonly string[] => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const names: string[] = []
  for (let index = 0; index < count >>> 0; index++) {
    names.push(reader.readString().slice(0, MATERIAL_NAME_LENGTH))
  }
  reader.expectRightCurly()
  return Object.freeze(names)
}

const createVertexBuffer = (
  format: VertexFormatValue,
  vertexCount: number,
  positions: readonly number[],
  textureCoordinates: readonly number[],
  normals: readonly number[],
  colors: readonly number[]
): ModelVertexBuffer =>
  Object.freeze({
    format,
    vertexCount,
    positions: Object.freeze(positions),
    textureCoordinates: Object.freeze(textureCoordinates),
    normals: Object.freeze(normals),
    colors: Object.freeze(colors),
  })

// The vertex count is stored in a short, so only its low sixteen bits count.
const readVertexCount = (reader: TokenReader): number => {
  reader.expectLeftBracket()
  const vertexCount = reader.readInteger() & 0xffff
  if (vertexCount === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  reader.expectRightBracket()
  reader.expectLeftCurly()
  return vertexCount
}

// 0x100156f0 (position, texture), 0x10016ba0 (+ normal), 0x10005fc0 (+ color)
const readVertexBuffer = (reader: TokenReader, format: VertexFormatValue): ModelVertexBuffer => {
  const vertexCount = readVertexCount(reader)
  const positions: number[] = []
  const textureCoordinates: number[] = []
  const normals: number[] = []
  const colors: number[] = []
  for (let vertex = 0; vertex < vertexCount; vertex++) {
    readFloats(reader, positions, 3)
    readFloats(reader, textureCoordinates, 2)
    if (format === VertexFormat.POSITION_TEXTURE_NORMAL) readFloats(reader, normals, 3)
    if (format === VertexFormat.POSITION_TEXTURE_COLOR) {
      const red = reader.readInteger() & 0xff
      const green = reader.readInteger() & 0xff
      const blue = reader.readInteger() & 0xff
      const alpha = reader.readInteger() & 0xff
      colors.push(((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0)
    }
  }
  reader.expectRightCurly()
  return createVertexBuffer(format, vertexCount, positions, textureCoordinates, normals, colors)
}

// 0x1002be90
const readPositionVertexBuffer = (reader: TokenReader): ModelVertexBuffer => {
  const vertexCount = reader.readArrayCount() & 0xffff
  if (vertexCount === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const positions: number[] = []
  for (let vertex = 0; vertex < vertexCount; vertex++) readFloats(reader, positions, 3)
  reader.expectRightCurly()
  return createVertexBuffer(VertexFormat.POSITION, vertexCount, positions, [], [], [])
}

// 0x1002b3c0: three integers per face, each stored in a byte.
const readFaces = (reader: TokenReader): readonly ModelFace[] => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const faces: ModelFace[] = []
  for (let index = 0; index < count >>> 0; index++) {
    const first = reader.readInteger() & 0xff
    const second = reader.readInteger() & 0xff
    const third = reader.readInteger() & 0xff
    faces.push(Object.freeze([first, second, third] as const))
  }
  reader.expectRightCurly()
  return Object.freeze(faces)
}

const createSelectTransform = (transformIndex: number): ModelCommand =>
  Object.freeze({
    kind: ModelCommandKind.SELECT_TRANSFORM,
    transformIndex: transformIndex & 0xffffff,
  })

// 0x10027430. A transform command fills the current slot without advancing; the next
// material, vertex or face command moves past it, so a trailing transform is dropped.
const readCommands = (reader: TokenReader): readonly ModelCommand[] => {
  const count = reader.readArrayCount()
  if (count === 0) reader.fail(TokenReaderFailure.EXPECTED_INTEGER)
  const commands: ModelCommand[] = []
  const transformStack: number[] = []
  let commandCount = 0
  let isTransformPending = false
  // The stack slot just below the transform stack holds the last vertex count operand.
  let lastVertexCountOperand: number | null = null

  const advancePastPendingTransform = (): void => {
    if (!isTransformPending) return
    commandCount += 1
    isTransformPending = false
  }

  const setCommand = (command: ModelCommand): void => {
    commands[commandCount] = command
  }

  for (let index = 0; index < count >>> 0; index++) {
    switch (reader.getNextToken()) {
      case ModelCommandKeyword.SELECT_MATERIAL: {
        advancePastPendingTransform()
        const materialIndex = reader.readInteger() & 0xffffff
        setCommand(Object.freeze({ kind: ModelCommandKind.SELECT_MATERIAL, materialIndex }))
        commandCount += 1
        break
      }
      case ModelCommandKeyword.DRAW_FACES: {
        advancePastPendingTransform()
        const firstFace = reader.readInteger()
        const faceCount = reader.readInteger()
        if (faceCount >>> 0 > MAXIMUM_DRAW_FACE_COUNT) reader.fail(TokenReaderFailure.UNSUPPORTED)
        setCommand(
          Object.freeze({
            kind: ModelCommandKind.DRAW_FACES,
            firstFace: firstFace & 0xffff,
            faceCount: faceCount & 0x7f,
          })
        )
        commandCount += 1
        break
      }
      case ModelCommandKeyword.TRANSFORM_VERTICES: {
        advancePastPendingTransform()
        const cacheIndex = reader.readInteger()
        if (cacheIndex >>> 0 >= VERTEX_CACHE_SIZE) reader.fail(TokenReaderFailure.UNSUPPORTED)
        const firstVertex = reader.readInteger()
        const vertexCountOperand = reader.readInteger()
        lastVertexCountOperand = vertexCountOperand
        if ((vertexCountOperand + cacheIndex) >>> 0 > VERTEX_CACHE_SIZE) {
          reader.fail(TokenReaderFailure.UNSUPPORTED)
        }
        setCommand(
          Object.freeze({
            kind: ModelCommandKind.TRANSFORM_VERTICES,
            cacheIndex: cacheIndex & 0x3f,
            firstVertex: firstVertex & 0xffff,
            vertexCount: ((vertexCountOperand - 1) & 0x3f) + 1,
          })
        )
        commandCount += 1
        break
      }
      case ModelCommandKeyword.PUSH_TRANSFORM: {
        const transformIndex = reader.readInteger()
        if (transformStack.length >= MAXIMUM_TRANSFORM_DEPTH) {
          reader.fail(TokenReaderFailure.UNEXPECTED_KEYWORD)
        }
        transformStack.push(transformIndex)
        isTransformPending = true
        setCommand(createSelectTransform(transformIndex))
        break
      }
      case ModelCommandKeyword.POP_TRANSFORM: {
        if (transformStack.length < 1) reader.fail(TokenReaderFailure.UNEXPECTED_KEYWORD)
        transformStack.pop()
        isTransformPending = true
        const restoredIndex =
          transformStack.length > 0
            ? transformStack[transformStack.length - 1]
            : lastVertexCountOperand
        if (restoredIndex === null || restoredIndex === undefined) {
          throw new UnportableModelError(
            'Popping the last transform reads an uninitialised stack slot',
            reader.getPosition()
          )
        }
        setCommand(createSelectTransform(restoredIndex))
        break
      }
      case ModelCommandKeyword.SET_TRANSFORM:
        isTransformPending = true
        setCommand(createSelectTransform(reader.readInteger()))
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }
  reader.expectRightCurly()
  return Object.freeze(commands.slice(0, commandCount))
}

const getVertexFormat = (keyword: number): VertexFormatValue => {
  if (keyword === ModelKeyword.POSITION_TEXTURE_NORMAL_VERTICES) {
    return VertexFormat.POSITION_TEXTURE_NORMAL
  }
  if (keyword === ModelKeyword.POSITION_TEXTURE_COLOR_VERTICES) {
    return VertexFormat.POSITION_TEXTURE_COLOR
  }
  return VertexFormat.POSITION_TEXTURE
}

// GolDP.dll 0x100270e0 (called by 0x100068e0): reads keywords until the end of the file.
export const parseModel = (bytes: Uint8Array): Model => {
  const reader = createTokenReader(bytes)
  let materialNames: readonly string[] | null = null
  let vertexBuffer: ModelVertexBuffer | null = null
  let positionVertexBuffer: ModelVertexBuffer | null = null
  let faces: readonly ModelFace[] | null = null
  let commands: readonly ModelCommand[] | null = null
  // 0x10027020 initialises the scale to 1.0.
  let scale = 1

  const failIfLoaded = (value: unknown): void => {
    if (value !== null) reader.fail(TokenReaderFailure.UNEXPECTED_KEYWORD)
  }

  for (
    let keyword = reader.getNextToken();
    keyword !== BinaryToken.END_OF_FILE;
    keyword = reader.getNextToken()
  ) {
    switch (keyword) {
      case ModelKeyword.MATERIALS:
        failIfLoaded(materialNames)
        materialNames = readMaterialNames(reader)
        break
      case ModelKeyword.POSITION_TEXTURE_VERTICES:
      case ModelKeyword.POSITION_TEXTURE_NORMAL_VERTICES:
      case ModelKeyword.POSITION_TEXTURE_COLOR_VERTICES:
        failIfLoaded(vertexBuffer)
        vertexBuffer = readVertexBuffer(reader, getVertexFormat(keyword))
        break
      case ModelKeyword.FACES:
        failIfLoaded(faces)
        faces = readFaces(reader)
        break
      case ModelKeyword.COMMANDS:
        failIfLoaded(commands)
        commands = readCommands(reader)
        break
      case ModelKeyword.SCALE:
        scale = reader.readFloat()
        break
      case ModelKeyword.POSITION_VERTICES:
        failIfLoaded(positionVertexBuffer)
        positionVertexBuffer = readPositionVertexBuffer(reader)
        break
      default:
        reader.fail(TokenReaderFailure.SYNTAX_ERROR)
    }
  }

  return Object.freeze({
    materialNames: materialNames ?? Object.freeze([]),
    vertexBuffer,
    positionVertexBuffer,
    faces: faces ?? Object.freeze([]),
    commands: commands ?? Object.freeze([]),
    scale,
    readByteCount: reader.getPosition(),
  })
}
