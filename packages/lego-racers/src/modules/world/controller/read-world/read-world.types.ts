import type { MaterialAnimationReference, Vector3, WorldInstance } from '../../types/world.types.ts'

export type WorldCounts = {
  readonly animations: number
  readonly meshes: number
  readonly materialAssignments: number
  readonly skeletons: number
  readonly bspTrees: number
  readonly bspVolumes: number
  readonly skeletonInstances: number
}

export type InstanceCommonFields = Omit<WorldInstance<never>, 'levels'>

export type InstanceState = {
  readonly handleCommonKeyword: (keyword: number) => boolean
  readonly getCommonFields: () => InstanceCommonFields
}

export type Orientation = {
  readonly forward: Vector3
  readonly up: Vector3
}

export type MaterialAnimationReferences = readonly MaterialAnimationReference[]

export type NameOrIndex = {
  readonly index: number
  readonly name: string
}

export type LevelledInstanceKeywords = {
  readonly keyword36Value: number
  readonly isKeyword4cSet: boolean
}
