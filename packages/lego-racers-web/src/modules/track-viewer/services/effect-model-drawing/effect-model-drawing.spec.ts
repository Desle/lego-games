import type { ModelScene, SceneMaterial } from '@lego-games/lego-racers/scene'
import {
  BlendFactor,
  CompareFunction,
  SceneInstanceKind,
  ShadeMode,
  TextureAddressing,
  TextureFilter,
  TextureOperation,
} from '@lego-games/lego-racers/scene'
import {
  advanceSkeletonAnimation,
  createSkeletonAnimationState,
} from '@lego-games/lego-racers/skeletal-animation'
import type { SkeletalAnimation } from '@lego-games/lego-racers/skeletal-animation'
import { Group, Mesh, Vector3 } from 'three'
import type { BufferAttribute, Object3D } from 'three'
import {
  clearViewerExtensions,
  NEUTRAL_EXTENSION,
  registerViewerExtension,
} from '../../../../shared/viewer-extensions/viewer-extensions.ts'
import { createModelObject } from '../model-object/model-object.ts'
import { getEffectModelName, showEffectModelDrawing } from './effect-model-drawing.ts'

const MATERIAL: SceneMaterial = {
  name: 'brick',
  libraryPath: 'GAMEDATA\\COMMON\\BRICK.MDB',
  flags: 0,
  textureIndex: null,
  ambientColor: [255, 255, 255, 255],
  diffuseColor: [255, 255, 255, 255],
  renderState: {
    shading: ShadeMode.FLAT,
    colorOperation: TextureOperation.SELECT_DIFFUSE,
    alphaOperation: TextureOperation.SELECT_DIFFUSE,
    diffuseAlpha: null,
    isDiffuseWhite: false,
    isAlphaTestEnabled: false,
    alphaFunction: CompareFunction.ALWAYS,
    alphaReference: 0,
    isBlendEnabled: false,
    sourceBlend: BlendFactor.ONE,
    destinationBlend: BlendFactor.ZERO,
    filter: TextureFilter.POINT,
    addressing: TextureAddressing.WRAP,
  },
}

// One bone that turns a quarter about z over ten frames (the w and z of the quaternions), the way a brick's clip turns it.
const ANIMATION: SkeletalAnimation = {
  positions: [],
  rotations: [
    [0, 0, 0, 1],
    [0, 0, Math.SQRT1_2, Math.SQRT1_2],
  ],
  times: [0, 10],
  tracks: [
    {
      rotationStart: 0,
      rotationTimeStart: 0,
      rotationCount: 2,
      positionStart: 0,
      positionTimeStart: 0,
      positionCount: 0,
    },
  ],
  clips: [
    {
      name: 'turn',
      framesPerMillisecond: 1,
      velocity: [0, 0, 0],
      boundingSphere: [0, 0, 0, 1],
      firstTrackIndex: 0,
      frameCount: 11,
      loopLength: 10,
    },
  ],
}

const MODEL: ModelScene = {
  meshScales: [0.5],
  scene: {
    worldPaths: [],
    textures: [],
    materials: [MATERIAL],
    meshes: [
      {
        name: 'brick',
        path: 'GAMEDATA\\COMMON\\BRICK.GDB',
        vertexCount: 3,
        positions: new Float32Array([2, 0, 0, 0, 2, 0, 0, 0, 2]),
        textureCoordinates: new Float32Array(6),
        colors: new Uint8Array(12).fill(255),
        normals: null,
        materialIndices: [0],
        boundingSphere: null,
        drawBatches: [
          {
            materialSlot: 0,
            firstCommand: 0,
            vertexIndices: new Uint32Array([0, 1, 2]),
            transformIndices: new Uint8Array(3),
          },
        ],
      },
    ],
    materialAssignments: [],
    bspTrees: [],
    skeletons: [
      {
        name: 'brick',
        path: 'GAMEDATA\\COMMON\\BRICK.SDB',
        skeleton: {
          bones: [{ name: 'brick', position: null, quaternion: null, parentIndex: null }],
          readByteCount: 0,
        },
      },
    ],
    animations: [{ name: 'brick', path: 'GAMEDATA\\COMMON\\BRICK.ADB', animation: ANIMATION }],
    instances: [
      {
        name: 'brick',
        kind: SceneInstanceKind.SKELETON,
        worldPath: 'GAMEDATA\\COMMON\\BRICK.WDB',
        startClipIndex: 0,
        textureScrollPerSecond: null,
        levels: [
          {
            meshIndex: 0,
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
    sprites: [],
    cameras: [],
    ambientLights: [],
    directionalLights: [],
  },
}

const REQUEST = { modelName: 'BRICK', variant: null, model: MODEL }

const getIsMesh = (object: Object3D): object is Mesh => object instanceof Mesh

const getRounded = (point: Vector3): readonly number[] =>
  point.toArray().map((value) => Number(value.toFixed(4)))

// Where the drawing puts a point of its own frame once the model's group is placed.
const getDrawnPoint = (marker: Group, group: Group, point: Vector3): readonly number[] => {
  group.updateMatrixWorld(true)
  return getRounded(point.clone().applyMatrix4(marker.matrixWorld))
}

// Where the model's own (hidden) mesh puts its first vertex.
const getMeshVertex = (group: Group): readonly number[] => {
  group.updateMatrixWorld(true)
  let vertex = new Vector3()
  group.traverse((child) => {
    if (!getIsMesh(child)) return
    const positions = child.geometry.getAttribute('position') as BufferAttribute
    vertex = new Vector3().fromBufferAttribute(positions, 0).applyMatrix4(child.matrixWorld)
  })
  return getRounded(vertex)
}

describe('showEffectModelDrawing', () => {
  afterEach(() => {
    clearViewerExtensions()
  })

  it('keeps the model when no extension draws it', () => {
    // Arrange
    const modelObject = createModelObject(MODEL)

    // Act
    const shown = showEffectModelDrawing(modelObject, REQUEST)

    // Assert
    expect(shown).toBe(modelObject)
  })

  it('turns the drawing with the pose of the bone its mesh hangs on, frame after frame', () => {
    // Arrange: the drawing marks the mesh's frame, its unit along x being the file's vertex (2, 0, 0)
    const marker = new Group()
    registerViewerExtension({ ...NEUTRAL_EXTENSION, getEffectModelDrawing: () => marker })
    const shown = showEffectModelDrawing(createModelObject(MODEL), REQUEST)
    const start = createSkeletonAnimationState(ANIMATION, 0)
    const vertex = new Vector3(1, 0, 0)

    // Act
    shown.object.setAnimationState(start)
    const atStart = getDrawnPoint(marker, shown.group, vertex)
    shown.object.setAnimationState(advanceSkeletonAnimation(start, ANIMATION, 5))
    const turned = getDrawnPoint(marker, shown.group, vertex)
    const meshVertexTurned = getMeshVertex(shown.group)

    // Assert: the drawing turned an eighth with the bone, onto the mesh's own vertex (scaled by 0.5)
    expect(atStart).toEqual([1, 0, 0])
    expect(turned).not.toEqual(atStart)
    expect(turned).toEqual(meshVertexTurned)
  })
})

describe('getEffectModelName', () => {
  it('names a model by the stem of its mesh file', () => {
    // Arrange
    const model = MODEL

    // Act
    const name = getEffectModelName(model)

    // Assert
    expect(name).toBe('BRICK')
  })
})
