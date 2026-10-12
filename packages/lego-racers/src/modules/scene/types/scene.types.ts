import type { EnumValues } from '../../../shared/types/enum.types.ts'
import type { BspTree } from '../../bsp-tree/index.ts'
import type { Skeleton } from '../../skeleton/index.ts'
import type { SkeletalAnimation } from '../../skeletal-animation/index.ts'
import type {
  BlendFactor as BlendFactorValues,
  CompareFunction as CompareFunctionValues,
  MissingBitmapReason as MissingBitmapReasonValues,
  SceneInstanceKind as SceneInstanceKindValues,
  ShadeMode as ShadeModeValues,
  TextureAddressing as TextureAddressingValues,
  TextureFilter as TextureFilterValues,
  TextureOperation as TextureOperationValues,
} from './scene-enums/scene-enums.ts'

export type ShadeMode = EnumValues<typeof ShadeModeValues>
export type TextureOperation = EnumValues<typeof TextureOperationValues>
export type CompareFunction = EnumValues<typeof CompareFunctionValues>
export type BlendFactor = EnumValues<typeof BlendFactorValues>
export type TextureFilter = EnumValues<typeof TextureFilterValues>
export type TextureAddressing = EnumValues<typeof TextureAddressingValues>
export type SceneInstanceKind = EnumValues<typeof SceneInstanceKindValues>
export type MissingBitmapReason = EnumValues<typeof MissingBitmapReasonValues>

export type SceneVector = {
  readonly x: number
  readonly y: number
  readonly z: number
}

// Row-major 3×3: row 0 forward, row 1 up × forward, row 2 up (GolDP.dll 0x10026b50).
export type SceneRotation = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export type SceneBitmap = {
  readonly width: number
  readonly height: number
  // RGBA, rows top to bottom; the colour-keyed palette entry has alpha 0.
  readonly colors: Uint8Array
}

export type SceneTexture = {
  readonly name: string
  // The archive path the engine opens for the image.
  readonly bitmapPath: string
  readonly bitmap: SceneBitmap | null
  readonly missingBitmapReason: MissingBitmapReason | null
  // TDB keyword 0x2c: the palette colour (R, G, B) that becomes transparent.
  readonly colorKey: readonly [number, number, number] | null
  readonly flags: number
}

// What GolDP.dll 0x1000a2c0 sets on the Direct3D device for one material.
export type SceneRenderState = {
  readonly shading: ShadeMode
  readonly colorOperation: TextureOperation
  readonly alphaOperation: TextureOperation
  // Opacity replaces the vertex alpha (0..255); null keeps the vertex colour's alpha.
  readonly diffuseAlpha: number | null
  // A textured material without modulation draws with a constant white diffuse colour.
  readonly isDiffuseWhite: boolean
  readonly isAlphaTestEnabled: boolean
  readonly alphaFunction: CompareFunction
  readonly alphaReference: number
  readonly isBlendEnabled: boolean
  readonly sourceBlend: BlendFactor
  readonly destinationBlend: BlendFactor
  readonly filter: TextureFilter
  readonly addressing: TextureAddressing
}

export type SceneMaterial = {
  readonly name: string
  readonly libraryPath: string
  readonly flags: number
  readonly textureIndex: number | null
  readonly ambientColor: readonly [number, number, number, number]
  readonly diffuseColor: readonly [number, number, number, number]
  readonly renderState: SceneRenderState
}

// The triangles drawn between two material selections of one model.
export type SceneDrawBatch = {
  // Index into the model's material list (or the instance's material assignment).
  readonly materialSlot: number
  // The index of the select_material command that opened the batch (0 for faces drawn before any material).
  readonly firstCommand: number
  // Three vertex-buffer indices per triangle, read through the 64-entry vertex cache.
  readonly vertexIndices: Uint32Array
  // The transform selected when each corner's vertex was transformed into the cache.
  readonly transformIndices: Uint8Array
}

export type SceneMesh = {
  readonly name: string
  readonly path: string
  readonly vertexCount: number
  // x, y, z per vertex
  readonly positions: Float32Array
  // u, v per vertex
  readonly textureCoordinates: Float32Array
  // R, G, B, A per vertex; null when the vertex format has no colour.
  readonly colors: Uint8Array | null
  // x, y, z per vertex; null when the vertex format has no normal.
  readonly normals: Float32Array | null
  readonly materialIndices: readonly number[]
  readonly drawBatches: readonly SceneDrawBatch[]
}

// A BSP tree the world lists (`.BDB`); its leaves name runs of the draw commands of the instance's mesh.
export type SceneBspTree = {
  readonly name: string
  readonly path: string
  readonly tree: BspTree
}

export type SceneMaterialAssignment = {
  readonly name: string
  readonly path: string
  readonly materialIndices: readonly number[]
}

// A skeleton the world lists (`.SDB`): the bones a skeleton instance's mesh vertices select through the draw
// commands' transforms.
export type SceneSkeleton = {
  readonly name: string
  readonly path: string
  readonly skeleton: Skeleton
}

// An animation the world lists (`.ADB`), named as the pose sampling reads it.
export type SceneAnimation = {
  readonly name: string
  readonly path: string
  readonly animation: SkeletalAnimation
}

export type SceneInstanceLevel = {
  // -1 for a skeleton instance level without a mesh (a camera's skeleton).
  readonly meshIndex: number
  // Skeleton instance levels only: indices into the scene's skeleton and animation lists.
  readonly skeletonIndex: number | null
  readonly animationIndex: number | null
  readonly materialAssignmentIndex: number | null
  // BSP tree instance levels only: the index into the scene's BSP tree list.
  readonly bspTreeIndex: number | null
  // Squared distance, or the largest float for "always".
  readonly squaredDistance: number
}

export type SceneInstance = {
  readonly name: string
  readonly kind: SceneInstanceKind
  // The world that defined the instance.
  readonly worldPath: string
  // The animation clip a skeleton instance starts playing (world keyword 0x35, resolved by 0x1002e640);
  // null when it plays none.
  readonly startClipIndex: number | null
  readonly levels: readonly SceneInstanceLevel[]
  readonly position: SceneVector
  readonly rotation: SceneRotation
}

// A world sprite (`0x37`, GolDP.dll 0x1002d950): a rectangle that turns to the camera, drawn after the world's instances.
export type SceneSprite = {
  // The world that defined the sprite.
  readonly worldPath: string
  // Null when the material assignment's entry does not exist (the sprite then draws nothing).
  readonly materialIndex: number | null
  readonly position: SceneVector
  // Keyword 0x38: the axis the sprite turns around instead of facing the camera whole; null faces it whole.
  readonly axis: SceneVector | null
  readonly width: number
  readonly height: number
  // The sprite is drawn only when the squared distance to the camera does not exceed this (infinity for "always").
  readonly squaredDistance: number
}

export type SceneCamera = {
  readonly name: string
  readonly position: SceneVector
  readonly forward: SceneVector
  readonly up: SceneVector
  // World camera keywords 0x45, 0x46 and 0x47: the clipping planes and the vertical field of view in degrees (confirmed
  // by the original's menu draws: the matrices of the main menu, the racer showcase and the race cinemas).
  readonly nearPlane: number
  readonly farPlane: number
  readonly fieldOfViewDegrees: number
}

export type SceneAmbientLight = {
  readonly color: readonly [number, number, number]
}

export type SceneDirectionalLight = {
  readonly color: readonly [number, number, number]
  readonly direction: SceneVector
}

export type Scene = {
  // The worlds loaded into the scene, in load order.
  readonly worldPaths: readonly string[]
  readonly textures: readonly SceneTexture[]
  readonly materials: readonly SceneMaterial[]
  readonly meshes: readonly SceneMesh[]
  readonly materialAssignments: readonly SceneMaterialAssignment[]
  readonly bspTrees: readonly SceneBspTree[]
  readonly skeletons: readonly SceneSkeleton[]
  readonly animations: readonly SceneAnimation[]
  readonly instances: readonly SceneInstance[]
  readonly sprites: readonly SceneSprite[]
  readonly cameras: readonly SceneCamera[]
  readonly ambientLights: readonly SceneAmbientLight[]
  readonly directionalLights: readonly SceneDirectionalLight[]
}
