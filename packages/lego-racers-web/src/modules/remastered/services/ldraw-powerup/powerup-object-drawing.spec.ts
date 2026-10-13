import type { ModelScene } from '@lego-games/lego-racers/scene'
import {
  BACK_FACES_VARIANT,
  POSED_BONE_KEY,
  POWER_UP_BRICK_MODEL_NAME,
} from '../../../../shared/viewer-extensions/effect-model-names.ts'
import type { LDrawModelIndex } from '../ldraw-models/ldraw-model-index.types.ts'
import {
  createPowerUpObjectDrawing,
  getEffectModelDrawingSource,
  preparePowerUpObjects,
} from './powerup-object-drawing.ts'

const INDEX: LDrawModelIndex = {
  cars: {},
  chassis: {},
  drivers: {},
  powerUps: { DMISSILE: 'powerups/DMISSILE.ldr', PUBRICKY: 'powerups/PUBRICKY.ldr' },
  particles: {},
}

describe('getEffectModelDrawingSource', () => {
  it('draws a power-up object from its file, and nothing in place of its inside', () => {
    // Arrange
    const rocket = { modelName: 'DMISSILE', variant: null }
    const shieldInside = { modelName: 'DMISSILE', variant: BACK_FACES_VARIANT }

    // Act
    const sources = [rocket, shieldInside].map((request) =>
      getEffectModelDrawingSource(request, INDEX)
    )

    // Assert
    expect(sources).toEqual([
      { kind: 'file', file: 'powerups/DMISSILE.ldr' },
      { kind: 'nothing', file: null },
    ])
  })

  it('keeps the original of a power-up object without a file, inside and out', () => {
    // Arrange
    const requests = [
      { modelName: 'SHEOUT0', variant: null },
      { modelName: 'SHEOUT0', variant: BACK_FACES_VARIANT },
      { modelName: 'GRAPPLE', variant: null },
    ]

    // Act
    const sources = requests.map((request) => getEffectModelDrawingSource(request, INDEX))

    // Assert
    expect(sources).toEqual([null, null, null])
  })

  it('draws a pickup brick from its part in every look, whatever the folder holds', () => {
    // Arrange
    const request = { modelName: POWER_UP_BRICK_MODEL_NAME, variant: 'shield' }

    // Act
    const source = getEffectModelDrawingSource(request, INDEX)

    // Assert
    expect(source).toEqual({ kind: 'pickup_part', file: null })
  })
})

// The twin turbo's burner: the same triangle on bone 1 and on bone 2.
const TWIN_BURNER: ModelScene = {
  meshScales: [1],
  scene: {
    worldPaths: [],
    textures: [],
    materials: [],
    meshes: [
      {
        name: 'dt2cburn',
        path: 'GAMEDATA\\COMMON\\DT2CBURN.GDB',
        vertexCount: 6,
        positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0]),
        textureCoordinates: new Float32Array(12),
        colors: null,
        normals: null,
        materialIndices: [],
        boundingSphere: null,
        drawBatches: [
          {
            materialSlot: 0,
            firstCommand: 0,
            vertexIndices: new Uint32Array([0, 1, 2, 3, 4, 5]),
            transformIndices: new Uint8Array([1, 1, 1, 2, 2, 2]),
          },
        ],
      },
    ],
    materialAssignments: [],
    bspTrees: [],
    skeletons: [],
    animations: [],
    instances: [],
    sprites: [],
    cameras: [],
    ambientLights: [],
    directionalLights: [],
  },
}

describe('createPowerUpObjectDrawing', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("draws the file once for each group of the original's mesh, each posed by its group's bone", () => {
    // Arrange: a file still being read
    vi.stubGlobal('fetch', () => new Promise<Response>(() => undefined))

    // Act
    const drawing = createPowerUpObjectDrawing('powerups/DT2CBURN.ldr', TWIN_BURNER)

    // Assert
    expect(drawing?.children.map((part): unknown => part.userData[POSED_BONE_KEY])).toEqual([1, 2])
  })
})

describe('an empty power-up file', () => {
  afterEach(() => vi.unstubAllGlobals())

  it("leaves the original's model: a file with only its header places nothing", async () => {
    // Arrange: the builder's header of an item saved with no part
    const header = '0 Racers power-up object ENHANER\n0 Name: ENHANER.ldr\n0 BFC CERTIFY CCW\n'
    vi.stubGlobal('fetch', () => Promise.resolve(new Response(header)))
    const index: LDrawModelIndex = { ...INDEX, powerUps: { ENHANER: 'powerups/ENHANER.ldr' } }

    // Act
    await preparePowerUpObjects(index)
    const sources = [null, BACK_FACES_VARIANT].map((variant) =>
      getEffectModelDrawingSource({ modelName: 'ENHANER', variant }, index)
    )

    // Assert
    expect(sources).toEqual([null, null])
  })
})
