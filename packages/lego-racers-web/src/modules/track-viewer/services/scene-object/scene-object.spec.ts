import type { Scene, SceneInstance, SceneMaterial } from '@lego-games/lego-racers/scene'
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
          firstCommand: 0,
          vertexIndices: new Uint32Array([1, 0, 2]),
          transformIndices: new Uint8Array(3),
        },
      ],
    },
    {
      name: 'hand',
      path: 'GAMEDATA\\RACEC0R0\\HAND.GDB',
      vertexCount: 3,
      positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
      textureCoordinates: new Float32Array(6),
      colors: new Uint8Array(12).fill(255),
      normals: null,
      materialIndices: [0],
      drawBatches: [
        {
          materialSlot: 0,
          firstCommand: 0,
          vertexIndices: new Uint32Array([0, 1, 2]),
          transformIndices: new Uint8Array([1, 1, 1]),
        },
      ],
    },
  ],
  materialAssignments: [],
  bspTrees: [],
  // A root and a child bone; the child moves along x over ten frames.
  skeletons: [
    {
      name: 'arm',
      path: 'GAMEDATA\\RACEC0R0\\ARM.SDB',
      skeleton: {
        bones: [
          { name: 'root', position: null, quaternion: null, parentIndex: null },
          { name: 'hand', position: [0, 0, 0], quaternion: null, parentIndex: 0 },
        ],
        readByteCount: 0,
      },
    },
  ],
  animations: [
    {
      name: 'arm',
      path: 'GAMEDATA\\RACEC0R0\\ARM.ADB',
      animation: {
        positions: [
          [0, 0, 0],
          [10, 0, 0],
        ],
        rotations: [],
        times: [0, 10],
        tracks: [
          {
            rotationStart: 0,
            rotationTimeStart: 0,
            rotationCount: 0,
            positionStart: 0,
            positionTimeStart: 0,
            positionCount: 0,
          },
          {
            rotationStart: 0,
            rotationTimeStart: 0,
            rotationCount: 0,
            positionStart: 0,
            positionTimeStart: 0,
            positionCount: 2,
          },
        ],
        clips: [
          {
            name: 'swing',
            framesPerMillisecond: 1,
            velocity: [0, 0, 0],
            firstTrackIndex: 0,
            frameCount: 11,
            loopLength: 10,
          },
        ],
      },
    },
  ],
  instances: [
    {
      name: 'rock01',
      kind: SceneInstanceKind.MESH,
      worldPath: 'GAMEDATA\\RACEC0R0\\RRTRK.WDB',
      startClipIndex: null,
      levels: [
        {
          meshIndex: 0,
          skeletonIndex: null,
          animationIndex: null,
          materialAssignmentIndex: null,
          bspTreeIndex: null,
          squaredDistance: 0,
        },
      ],
      position: { x: 10, y: 0, z: 0 },
      rotation: [0, 1, 0, -1, 0, 0, 0, 0, 1],
    },
    {
      name: 'arm01',
      kind: SceneInstanceKind.SKELETON,
      worldPath: 'GAMEDATA\\RACEC0R0\\BACKGRD.WDB',
      startClipIndex: 0,
      levels: [
        {
          meshIndex: 1,
          skeletonIndex: 0,
          animationIndex: 0,
          materialAssignmentIndex: null,
          bspTreeIndex: null,
          squaredDistance: 0,
        },
      ],
      position: { x: 5, y: 6, z: 7 },
      rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    },
    {
      name: 'camera dummy',
      kind: SceneInstanceKind.SKELETON,
      worldPath: 'GAMEDATA\\RACEC0R0\\RRTRK.WDB',
      startClipIndex: null,
      levels: [
        {
          meshIndex: -1,
          skeletonIndex: 0,
          animationIndex: 0,
          materialAssignmentIndex: null,
          bspTreeIndex: null,
          squaredDistance: 0,
        },
      ],
      position: { x: 0, y: 0, z: 0 },
      rotation: [1, 0, 0, 0, 1, 0, 0, 0, 1],
    },
  ],
  cameras: [],
  ambientLights: [],
  directionalLights: [],
}

const TRACK_OPTIONS = {
  includeInstance: (instance: SceneInstance) => instance.name === 'rock01',
  isBackground: false,
}

describe('createSceneObject', () => {
  it('places each batch with the instance transform and the material state', () => {
    // Arrange
    const scene = SCENE

    // Act
    const sceneObject = createSceneObject(scene, TRACK_OPTIONS)

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
    const sceneObject = createSceneObject(scene, TRACK_OPTIONS)

    // Assert
    const mesh = sceneObject.group.children[0]!.children[0] as Mesh
    const colors = [...(mesh.geometry.getAttribute('color').array as Uint8Array)]
    expect(colors).toEqual([255, 0, 0, 255, 255, 0, 0, 255, 255, 0, 0, 255])
    expect(sceneObject.bounds.isEmpty()).toBe(false)
  })

  it('moves the vertices of a skeleton instance with the bone matrices of its animation', () => {
    // Arrange
    const sceneObject = createSceneObject(SCENE, {
      includeInstance: (instance) => instance.name === 'arm01',
      isBackground: false,
    })
    const mesh = sceneObject.group.children[0]!.children[0] as Mesh
    const positions = mesh.geometry.getAttribute('position').array

    // Act
    const before = positions[0]
    sceneObject.animate(5)

    // Assert
    expect(before).toBe(0)
    expect(positions[0]).toBe(5)
    expect(positions[3]).toBe(6)
    expect(sceneObject.animatedInstanceCount).toBe(1)
    sceneObject.dispose()
  })

  it('leaves out an instance without a mesh and one the options exclude', () => {
    // Arrange
    // Act
    const sceneObject = createSceneObject(SCENE, {
      includeInstance: (instance) => instance.worldPath.endsWith('RRTRK.WDB'),
      isBackground: false,
    })

    // Assert
    expect(sceneObject.group.children.map((child) => child.name)).toEqual(['rock01'])
    expect(sceneObject.animatedInstanceCount).toBe(0)
  })

  it('draws a background instance at its group origin, without the depth test, in order', () => {
    // Arrange
    // Act
    const sceneObject = createSceneObject(SCENE, {
      includeInstance: (instance) => instance.worldPath.endsWith('BACKGRD.WDB'),
      isBackground: true,
    })

    // Assert
    const instanceGroup = sceneObject.group.children[0]!
    const mesh = instanceGroup.children[0] as Mesh
    const material = mesh.material as MeshBasicMaterial
    expect(new Vector3().applyMatrix4(instanceGroup.matrix).toArray()).toEqual([0, 0, 0])
    expect(material.depthTest).toBe(false)
    expect(material.depthWrite).toBe(false)
    expect(mesh.renderOrder).toBe(1)
  })

  it('swaps the material of a slot for every batch that reads it (a material animation write)', () => {
    // Arrange
    const sceneWithSecondMaterial: Scene = {
      ...SCENE,
      materials: [MATERIAL, { ...MATERIAL, name: 'moss' }],
    }
    const sceneObject = createSceneObject(sceneWithSecondMaterial, TRACK_OPTIONS)
    const mesh = sceneObject.group.children[0]!.children[0] as Mesh
    const first = mesh.material

    // Act
    const isSwapped = sceneObject.setMaterialSlot('rock01', 0, 0, 'moss')
    const isUnknownMaterialSwapped = sceneObject.setMaterialSlot('rock01', 0, 0, 'lava')
    const isUnknownInstanceSwapped = sceneObject.setMaterialSlot('missing', 0, 0, 'moss')

    // Assert
    expect(isSwapped).toBe(true)
    expect(isUnknownMaterialSwapped).toBe(false)
    expect(isUnknownInstanceSwapped).toBe(false)
    expect(mesh.material).not.toBe(first)
    sceneObject.dispose()
  })
})
