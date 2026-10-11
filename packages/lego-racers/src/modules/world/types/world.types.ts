export type Vector3 = {
  readonly x: number
  readonly y: number
  readonly z: number
}

export type MaterialAnimationReference = {
  readonly materialAnimationIndex: number
  readonly entryIndex: number
  readonly value: number
  readonly levelIndex: number
}

export type MeshLevel = {
  readonly meshIndex: number
  readonly distance: number
}

export type SkeletonLevel = {
  readonly meshIndex: number
  readonly skeletonIndex: number
  readonly animationIndex: number
  readonly distance: number
}

export type BspTreeLevel = {
  readonly meshIndex: number
  readonly bspTreeIndex: number
  readonly distance: number
}

export type WorldInstance<Level> = {
  readonly name: string
  readonly levels: readonly Level[]
  readonly materialAssignmentIndices: readonly number[]
  readonly position: Vector3
  readonly forward: Vector3
  readonly up: Vector3
  readonly materialAnimationReferences: readonly MaterialAnimationReference[]
  readonly keyword3fValues: readonly number[] | null
  readonly isKeyword42Set: boolean
}

export type MeshInstance = WorldInstance<MeshLevel> & {
  readonly keyword36Value: number
  readonly isKeyword4cSet: boolean
}

export type SkeletonInstance = WorldInstance<SkeletonLevel> & {
  readonly keyword35Index: number
  readonly keyword35Name: string
  readonly keyword36Value: number
  readonly isKeyword4cSet: boolean
}

export type BspTreeInstance = WorldInstance<BspTreeLevel>

export type BspVolumeInstance = {
  readonly name: string
  readonly bspVolumeIndex: number
  readonly materialAssignmentIndex: number
  readonly position: Vector3
  readonly forward: Vector3
  readonly up: Vector3
}

export type SpriteMaterialAssignment = {
  readonly materialAssignmentIndex: number
  readonly entryIndex: number
}

export type SpriteMaterialAnimation = {
  readonly materialAnimationIndex: number
  readonly entryIndex: number
}

export type Sprite = {
  readonly materialName: string
  readonly position: Vector3
  readonly keyword38Vector: Vector3 | null
  readonly keyword3aValue: number
  readonly keyword3bValue: number
  readonly keyword3cValue: number
  readonly materialAssignment: SpriteMaterialAssignment | null
  readonly materialAnimation: SpriteMaterialAnimation | null
}

export type Camera = {
  readonly name: string
  readonly skeletonInstanceIndex: number
  readonly keyword2fValue: number
  readonly keyword35Index: number
  readonly keyword35Name: string
  readonly position: Vector3
  readonly forward: Vector3
  readonly negatedUp: Vector3
  readonly nearPlane: number
  readonly farPlane: number
  readonly fieldOfViewDegrees: number
}

export type AmbientLight = {
  readonly colorBytes: readonly number[]
}

export type DirectionalLight = {
  readonly colorBytes: readonly number[]
  readonly direction: Vector3
}

export type World = {
  readonly textures: readonly string[]
  readonly materials: readonly string[]
  readonly animations: readonly string[]
  readonly meshes: readonly string[]
  readonly materialAssignments: readonly string[]
  readonly skeletons: readonly string[]
  readonly bspTrees: readonly string[]
  readonly materialAnimations: readonly string[]
  readonly bspVolumes: readonly string[]
  readonly meshInstances: readonly MeshInstance[]
  readonly skeletonInstances: readonly SkeletonInstance[]
  readonly bspTreeInstances: readonly BspTreeInstance[]
  readonly bspVolumeInstances: readonly BspVolumeInstance[]
  readonly sprites: readonly Sprite[]
  readonly cameras: readonly Camera[]
  readonly ambientLights: readonly AmbientLight[]
  readonly directionalLights: readonly DirectionalLight[]
}
