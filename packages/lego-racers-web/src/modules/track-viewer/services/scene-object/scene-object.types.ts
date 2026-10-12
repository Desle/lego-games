import type {
  Scene,
  SceneInstance,
  SceneMaterial,
  SceneInstanceLevel,
  SceneMesh,
} from '@lego-games/lego-racers/scene'
import type { SkeletonAnimationState } from '@lego-games/lego-racers/skeletal-animation'
import type { SceneLights } from './vertex-lighting.types.ts'
import type {
  ColourShiftLike,
  FrustumView,
  Vector3Like,
} from '../race-viewport/race-viewport.types.ts'
import type {
  Box3,
  BufferGeometry,
  DataTexture,
  Group,
  Material,
  MaterialParameters,
  Mesh,
} from 'three'

export type SceneObject = {
  readonly group: Group
  // Puts a track event's colour shift on the prelit meshes (the vertex buffer's 0x10017050: every channel becomes
  // (channel >> shift) + bias, clamped to 255) or takes it off (null).
  readonly setColourShift: (shift: ColourShiftLike | null) => void
  // The same for the instances with this name only (a cinema's vertex effect on one model).
  readonly setInstanceColourShift: (name: string, shift: ColourShiftLike | null) => void
  // Shows, for every instance with several levels, the level the squared distance to this camera position selects
  // (GolDP.dll 0x10027cc0), and none past the last.
  // An instance the race moves (hazards, clips) shows the level its own distances and sphere select, and none when its
  // sphere is outside the frustum (GolDP.dll 0x100240b0).
  readonly selectLevels: (camera: Vector3Like, view?: FrustumView) => void
  // The distances and the sphere the simulation holds for the instances with this name (every world's, by name).
  readonly setInstanceRuntime: (name: string, runtime: InstanceRuntime) => unknown
  // Shows, for every BSP tree instance, only the leaves the camera's visibility list names and the frustum does not
  // reject (GolDP.dll 0x100092a0).
  readonly selectVisibleLeaves: (view: FrustumView) => void
  // Puts the skeleton instance with this name in the given clip state (the race simulation drives its clips).
  readonly setSkeletonState: (name: string, state: SkeletonAnimationState) => void
  // The instances' world-space bounds, for framing the camera.
  readonly bounds: Box3
  // Advances every animated instance by this many whole milliseconds.
  readonly animate: (deltaMilliseconds: number) => void
  readonly animatedInstanceCount: number
  // Lights the skeleton models that have normals and no vertex colours with these lights again (null: none, as in a race).
  readonly setLights: (lights: SceneLights | null) => void
  // Poses every skeleton instance from this animation state (a racer's figure, whose clock the race keeps).
  readonly setAnimationState: (state: SkeletonAnimationState) => void
  readonly dispose: () => void
}

// What the race simulation holds of an instance that decides whether it is drawn: the squared distances of its levels
// (a hazard sets them to hide it) and, for an animated skeleton instance, the sphere it is culled by (0x10023ef0).
export type InstanceRuntime = {
  // Where the simulation holds the instance (a mirrored race negates y, as the camera's world does).
  readonly position: Vector3Like
  readonly levelSquaredDistances: readonly number[]
  readonly sphere: { readonly centre: Vector3Like; readonly radius: number } | null
}

export type SceneObjectOptions = {
  readonly includeInstance: (instance: SceneInstance) => boolean
  // The background is drawn before the track without the depth test, in the order the engine draws it, with
  // each instance at the origin of its group (GolDP.dll sets every background instance to one position).
  readonly isBackground: boolean
}

export type TextureCache = Map<string, DataTexture>

// What building the three.js objects of a scene shares: the scene and the caches of textures, materials and geometries.
export type SceneObjectContext = {
  readonly scene: Scene
  readonly isBackground: boolean
  readonly textureCache: TextureCache
  readonly materials: Map<string, Material>
  readonly geometries: Map<string, BufferGeometry>
  // Counts the meshes created so far, for the background's draw order.
  readonly nextDrawOrder: () => number
}

// An instance as three.js objects, with the function that moves it if it is animated.
export type InstanceObject = {
  readonly group: Group
  readonly animate: ((deltaMilliseconds: number) => void) | null
  readonly setState: ((state: SkeletonAnimationState) => void) | null
}

// The level of an instance that is drawn, with its mesh.
export type InstanceLevelMesh = {
  readonly level: SceneInstanceLevel
  readonly mesh: SceneMesh
  readonly meshIndex: number
}

// three.js's own parameter names, so the boolean keeps its library name.
export type BlendingParameters = Pick<
  MaterialParameters,
  'blending' | 'blendSrc' | 'blendDst' | 'blendSrcAlpha' | 'blendDstAlpha' | 'transparent'
>

// The three.js material of a batch, with the scene material it came from.
export type BatchMaterial = {
  readonly material: Material
  readonly materialIndex: number
  readonly sceneMaterial: SceneMaterial
}

// A draw batch of a skeleton instance: its own geometry, the vertices before the bones move them and the
// bone each corner selected.
export type SkeletonBatch = {
  readonly geometry: BufferGeometry
  readonly transformIndices: Uint8Array
  readonly restPositions: Float32Array
  readonly restNormals: Float32Array | null
}

export type SkeletonBatchMesh = {
  readonly batch: SkeletonBatch
  readonly mesh: Mesh
}

// The meshes of one level of a BSP tree instance, one per draw batch.
export type BspLevelMeshes = {
  readonly meshes: readonly Mesh[]
}
