import type { Scene, SceneMaterial } from '@lego-games/lego-racers/scene'
import {
  BlendFactor,
  CompareFunction,
  ShadeMode,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from '@lego-games/lego-racers/scene'
import type { Sky } from '@lego-games/lego-racers/sky'
import type { BufferAttribute, MeshBasicMaterial } from 'three'
import { createSkyObject } from './sky-object.ts'

const SKY_MATERIAL: SceneMaterial = {
  name: 'skymat',
  libraryPath: 'GAMEDATA\\COMMON\\RACERFX.MDB',
  flags: 0,
  textureIndex: null,
  ambientColor: [255, 255, 255, 255],
  diffuseColor: [255, 255, 255, 255],
  renderState: {
    shading: ShadeMode.GOURAUD,
    colorOperation: TextureOperation.SELECT_DIFFUSE,
    alphaOperation: TextureOperation.SELECT_DIFFUSE,
    diffuseAlpha: null,
    isDiffuseWhite: false,
    isAlphaTestEnabled: false,
    alphaFunction: CompareFunction.GREATER,
    alphaReference: 0,
    isBlendEnabled: false,
    sourceBlend: BlendFactor.ONE,
    destinationBlend: BlendFactor.ZERO,
    filter: TextureFilter.LINEAR,
    addressing: TextureAddressing.WRAP,
  },
}

const SCENE: Scene = {
  worldPaths: [],
  textures: [],
  materials: [SKY_MATERIAL],
  meshes: [],
  materialAssignments: [],
  bspTrees: [],
  skeletons: [],
  animations: [],
  instances: [],
  sprites: [],
  cameras: [],
  ambientLights: [],
  directionalLights: [],
}

const SKY: Sky = {
  settings: [
    {
      name: 'dusk',
      keyframes: [
        { integer: 1000, firstBytes: [0, 0, 0], secondBytes: [0, 0, 0], thirdBytes: [0, 0, 0] },
        { integer: 1000, firstBytes: [100, 0, 0], secondBytes: [0, 0, 0], thirdBytes: [0, 0, 0] },
      ],
    },
  ],
  selectedSettingName: 'dusk',
  float: null,
  readByteCount: 0,
}

describe('createSkyObject', () => {
  it('draws the 44 triangles of the dome without the depth test, before everything else', () => {
    // Arrange
    // Act
    const sky = createSkyObject(SKY, SCENE)

    // Assert
    const material = sky?.mesh.material as MeshBasicMaterial
    expect(sky?.mesh.geometry.getAttribute('position').count).toBe(44 * 3)
    expect(material.depthTest).toBe(false)
    expect(material.depthWrite).toBe(false)
    expect(sky?.mesh.renderOrder).toBe(-1)
    sky?.dispose()
  })

  it('has no sky without a skymat material', () => {
    // Arrange
    const scene = { ...SCENE, materials: [] }

    // Act
    const sky = createSkyObject(SKY, scene)

    // Assert
    expect(sky).toBeNull()
  })

  it('centres the dome below the camera and recolours it as the keyframes run', () => {
    // Arrange
    const sky = createSkyObject(SKY, SCENE)

    // Act
    const placement = sky?.place({ x: 1, y: 2, z: 3 })
    sky?.animate(500)

    // Assert
    expect(sky?.mesh.position.toArray()).toEqual([1, 2, -7])
    expect(placement?.backdrop.z).toBe(33)
    const colors = sky?.mesh.geometry.getAttribute('color') as BufferAttribute
    expect(colors.array[67 * 4]).toBe(50)
  })
})
