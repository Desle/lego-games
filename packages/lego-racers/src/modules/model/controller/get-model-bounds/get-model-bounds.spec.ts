import { createFloatArithmetic, FpuPrecision } from '../../../simulation-math/index.ts'
import { ModelCommandKind } from '../../types/model-command-kind/model-command-kind.ts'
import { VertexFormat } from '../../types/vertex-format/vertex-format.ts'
import type { Model } from '../../types/model.types.ts'
import { getModelBounds } from './get-model-bounds.ts'

const ARITHMETIC = createFloatArithmetic(FpuPrecision.SINGLE)

const createModel = (positions: readonly number[], firstVertex: number, scale: number): Model => ({
  materialNames: [],
  vertexBuffer: {
    format: VertexFormat.POSITION_TEXTURE_COLOR,
    vertexCount: positions.length / 3,
    positions,
    textureCoordinates: [],
    normals: [],
    colors: [],
  },
  positionVertexBuffer: null,
  faces: [],
  commands: [
    {
      kind: ModelCommandKind.TRANSFORM_VERTICES,
      cacheIndex: 0,
      firstVertex,
      vertexCount: positions.length / 3 - firstVertex,
    },
  ],
  scale,
  readByteCount: 0,
})

describe('getModelBounds', () => {
  it('centres the sphere on the middle of the extent and scales both', () => {
    // Arrange
    const model = createModel([0, 0, 0, 2, 4, 6], 0, 0.5)

    // Act
    const bounds = getModelBounds(ARITHMETIC, model)

    // Assert
    expect(bounds?.centre).toEqual({ x: 0.5, y: 1, z: 1.5 })
    expect(bounds?.radius).toBeCloseTo(Math.sqrt(14) * 0.5, 6)
  })

  it('ignores vertices no transform command names', () => {
    // Arrange
    const model = createModel([100, 100, 100, 0, 0, 0, 2, 0, 0], 1, 1)

    // Act
    const bounds = getModelBounds(ARITHMETIC, model)

    // Assert
    expect(bounds?.centre).toEqual({ x: 1, y: 0, z: 0 })
    expect(bounds?.radius).toBe(1)
  })

  it('has no sphere without a transform command', () => {
    // Arrange
    const model: Model = { ...createModel([0, 0, 0], 0, 1), commands: [] }

    // Act
    const bounds = getModelBounds(ARITHMETIC, model)

    // Assert
    expect(bounds).toBeNull()
  })
})
