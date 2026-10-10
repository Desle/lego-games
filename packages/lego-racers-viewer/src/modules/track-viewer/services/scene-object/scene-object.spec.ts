import type { Scene, SceneMaterial } from '@lego-games/lego-racers/scene'
import {
  BlendFactor,
  CompareFunction,
  SceneInstanceKind,
  ShadeMode,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from '@lego-games/lego-racers/scene'
import type { Mesh, MeshBasicMaterial } from 'three'
import { CustomBlending, FrontSide, NearestFilter, Vector3 } from 'three'
import { createSceneObject } from './scene-object.ts'

const MATERIAL: SceneMaterial = {
  name: 'stone',
  libraryPath: 'GAMEDATA\\RACEC0R0\\RRTRK.MDB',
  flags: 0,
  textureIndex: 0,
  ambientColor: [255, 255, 255, 255],
  diffuseColor: [255, 255, 255, 255],
  renderState: {
    shading: ShadeMode.FLAT,
    colorOperation: TextureOperation.MODULATE,
    alphaOperation: TextureOperation.MODULATE,
    diffuseAlpha: null,
    isDiffuseWhite: false,
    isAlphaTestEnabled: false,
    alphaFunction: CompareFunction.ALWAYS,
    alphaReference: 0,
    isBlendEnabled: true,
    sourceBlend: BlendFactor.SOURCE_ALPHA,
    destinationBlend: BlendFactor.ONE,
    filter: TextureFilter.POINT,
    addressing: TextureAddressing.WRAP,
  },
}

// One triangle, its second corner red, placed at (10, 0, 0) with forward along y.
const SCENE: Scene = {
  worldPaths: ['GAMEDATA\\RACEC0R0\\RRTRK.WDB'],
  textures: [
    {
      name: 'stone',
      bitmapPath: 'GAMEDATA\\RACEC0R0\\STONE.BMP',
      bitmap: { width: 1, height: 1, colors: new Uint8Array([9, 9, 9, 255]) },
      missingBitmapReason: null,
      colorKey: null,
      flags: 0x80c,
    },
  ],
  materials: [MATERIAL],
  meshes: [
    {
      name: 'rock',
      path: 'GAMEDATA\\RACEC0R0\\ROCK.GDB',
      vertexCount: 3,
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      textureCoordinates: new Float32Array(6),
      colors: new Uint8Array([255, 255, 255, 255, 255, 0, 0, 255, 255, 255, 255, 255]),
      normals: null,
      materialIndices: [0],
      drawBatches: [
        {
          materialSlot: 0,
          vertexIndices: new Uint32Array([1, 0, 2]),
          transformIndices: new Uint8Array(3),
        },
      ],
    },
  ],
  materialAssignments: [],
  instances: [
    {
      name: 'rock01',
      kind: SceneInstanceKind.MESH,
      levels: [{ meshIndex: 0, materialAssignmentIndex: null, squaredDistance: 0 }],
      position: { x: 10, y: 0, z: 0 },
      rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1],
    },
  ],
  cameras: [],
  ambientLights: [],
  directionalLights: [],
}

describe('createSceneObject', () => {
  it('places each batch with the instance transform and the material state', () => {
    // Arrange
    const scene = SCENE

    // Act
    const sceneObject = createSceneObject(scene)

    // Assert
    const instanceGroup = sceneObject.group.children[0]!
    const mesh = instanceGroup.children[0] as Mesh
    const material = mesh.material as MeshBasicMaterial
    const corner = new Vector3(1, 0, 0).applyMatrix4(instanceGroup.matrix)
    expect(corner.toArray()).toEqual([10, 1, 0])
    expect(material.side).toBe(FrontSide)
    expect(material.blending).toBe(CustomBlending)
    expect(material.map?.magFilter).toBe(NearestFilter)
    sceneObject.dispose()
  })

  it('gives every corner of a flat-shaded face the first corner colour', () => {
    // Arrange
    const scene = SCENE

    // Act
    const sceneObject = createSceneObject(scene)

    // Assert
    const mesh = sceneObject.group.children[0]!.children[0] as Mesh
    const colors = [...(mesh.geometry.getAttribute('color').array as Uint8Array)]
    expect(colors).toEqual([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255])
    expect(sceneObject.bounds.isEmpty()).toBe(false)
  })
})
