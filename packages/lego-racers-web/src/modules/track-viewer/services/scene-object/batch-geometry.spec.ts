import type { SceneDrawBatch, SceneMesh, SceneRenderState } from '@lego-games/lego-racers/scene'
import {
  BlendFactor,
  CompareFunction,
  ShadeMode,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from '@lego-games/lego-racers/scene'
import type { BufferAttribute } from 'three'
import { createBatchGeometry } from './batch-geometry.ts'

const renderState: SceneRenderState = {
  shading: ShadeMode.GOURAUD,
  colorOperation: TextureOperation.MODULATE,
  alphaOperation: TextureOperation.MODULATE,
  diffuseAlpha: null,
  isDiffuseWhite: false,
  isAlphaTestEnabled: false,
  alphaFunction: CompareFunction.ALWAYS,
  alphaReference: 0,
  isBlendEnabled: false,
  sourceBlend: BlendFactor.ONE,
  destinationBlend: BlendFactor.ZERO,
  filter: TextureFilter.LINEAR,
  addressing: TextureAddressing.WRAP,
}

const batch: SceneDrawBatch = {
  materialSlot: 0,
  firstCommand: 0,
  vertexIndices: Uint32Array.from([0, 1, 2]),
  transformIndices: new Uint8Array(3),
}

const getMesh = (colors: Uint8Array | null): SceneMesh => ({
  name: 'triangle',
  path: '',
  vertexCount: 3,
  positions: new Float32Array(9),
  textureCoordinates: new Float32Array(6),
  colors,
  normals: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]),
  materialIndices: [0],
  boundingSphere: null,
  drawBatches: [batch],
})

const getColor = (mesh: SceneMesh, ambient: readonly [number, number, number, number]) => {
  const geometry = createBatchGeometry(mesh, batch, renderState, ambient)
  const color = geometry.getAttribute('color') as BufferAttribute
  return [color.getX(0), color.getY(0), color.getZ(0), color.getW(0)].map((value) =>
    Math.round(value * 255)
  )
}

describe('createBatchGeometry colours', () => {
  it('gives a model with normals and no colours its material ambient scaled by the ambient light (0x10011e60)', () => {
    // Arrange
    const mesh = getMesh(null)

    // Act
    const color = getColor(mesh, [128, 16, 255, 200])

    // Assert
    expect(color).toEqual([127, 15, 254, 200])
  })

  it('keeps the vertex colours of a prelit model', () => {
    // Arrange
    const mesh = getMesh(Uint8Array.from([10, 20, 30, 255, 10, 20, 30, 255, 10, 20, 30, 255]))

    // Act
    const color = getColor(mesh, [128, 16, 255, 200])

    // Assert
    expect(color).toEqual([10, 20, 30, 255])
  })
})
