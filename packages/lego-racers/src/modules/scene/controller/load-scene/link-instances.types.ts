// One level of a world instance as the world module reads it (mesh and BSP tree levels share these fields).
export type InstanceLevelInput = {
  readonly meshIndex: number
  readonly distance: number
}

// What reordering levels by distance needs.
export type DistanceLevel = {
  readonly squaredDistance: number
}

export type SortedLevel = {
  readonly meshIndex: number
  readonly bspTreeIndex: number | null
  readonly squaredDistance: number
}

// A skeleton instance level in the order the engine keeps them: nearest first.
export type SortedSkeletonLevel = {
  readonly meshIndex: number
  readonly skeletonIndex: number
  readonly animationIndex: number
  readonly squaredDistance: number
}

// One world's section sizes, and where its lists start in the scene's lists.
export type SceneCounts = {
  readonly worldPath: string
  readonly meshOffset: number
  readonly materialAssignmentOffset: number
  readonly skeletonOffset: number
  readonly bspTreeOffset: number
  readonly animationOffset: number
  readonly meshCount: number
  readonly materialAssignmentCount: number
  readonly skeletonCount: number
  readonly bspTreeCount: number
}

// What reading the material assignment slots of an instance needs.
export type MaterialAssignedInstance = {
  readonly materialAssignmentIndices: readonly number[]
}
