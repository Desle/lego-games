// One level of a world instance as the world module reads it (mesh and BSP tree levels share these fields).
export type InstanceLevelInput = {
  readonly meshIndex: number
  readonly distance: number
}

export type SortedLevel = {
  readonly meshIndex: number
  readonly squaredDistance: number
}

// One world's section sizes, and where its meshes and material assignments start in the scene's lists.
export type SceneCounts = {
  readonly meshOffset: number
  readonly materialAssignmentOffset: number
  readonly meshCount: number
  readonly materialAssignmentCount: number
  readonly bspTreeCount: number
}
